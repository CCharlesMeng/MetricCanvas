import { upgradePageDocument } from '../../packages/page/src/upgrade-document';
import { createHash } from 'node:crypto';
import { builtinModules } from 'node:module';
import { readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { build, type Plugin } from 'esbuild';
import { normalizePageDocument, validate } from '../../packages/page/src/validate';
import { requiredMinorVersion, supportedVersions, versionPolicy } from '../../packages/page/src/version';
import { validateReferenceLinks } from './page-reference';
import { observeResolution, withLocalBuildCache, type LocalBuildCacheOptions, type LocalBuildResult } from './local-authoring-build-cache';

const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

/** Preserve product semantics, remove online-only routing and non-distributed provenance. */
export function localPageReference(reference: Map<string, string>): Map<string, string> {
  const outputs = new Map(reference);
  const index = JSON.parse(outputs.get('index.json')!);
  index.semanticSourceDigest = hash(json(index.semanticSources));
  delete index.semanticSources;
  for (const module of Object.values(index.modules) as Array<{sources?: string[]}>) delete module.sources;
  for (const example of index.exampleCoverage) delete example.source;
  for (const branch of index.branchCoverage) if (branch.negativeWitness) delete branch.negativeWitness.source;
  outputs.set('index.json', json(index));
  for (const [file, content] of outputs) {
    if (file.startsWith('errors/') && file.endsWith('.json')) {
      const excerpt = JSON.parse(content);
      delete excerpt.fullInput;
      excerpt.note = '仅含错误触发片段，不是完整页面；使用独立校验脚本验证实际文档。';
      outputs.set(file, json(excerpt));
    } else if (file.endsWith('.md')) {
      let text = content.replace(/^- 源码\/验证定位：.*\n/gm, '');
      if (file === 'README.md') {
        text = text.replace(/^仓库中的协议总入口.*$/m,
          '本册包含页面字段语义、生成结构表与完整示例。按下表或模块索引读取，不需要其他目录的文档。');
      }
      if (file === 'params-and-text-values.md') {
        text = text.replace('，使用流程由仓库根目录 `PAGE-PARAMETERS.md` 维护',
          '；按参数类型、查询绑定和文本取值的生成结构表配置，完整示例见本节');
      }
      if (file === 'components/README.md') text = text.split('\n## Schema、确定性装配和运行证据')[0] + '\n';
      if (file === 'actions-and-navigation.md') text = text.replace(/^`t11-evidence\.md`.*\n/m, '');
      if (file === 'page.md') {
        text = text.replace(/^作者版本与可读范围.*?(?=5\.x在读取边界)/m,
          '作者版本以本册 [index.json](index.json) 的 schemaVersion 为准，可读版本以 [schema.json](schema.json) 的 schemaVersion 分支为准。能力下限由独立校验脚本检查。历史页面先校验，再按明确需求修改；不得只改版本号假装完成迁移。');
      }
      if (/(?:packages\/|tools\/|docs\/|metriccanvas-authoring\/|PAGE-(?:METADATA|PARAMETERS)\.md)/.test(text)) {
        throw new Error(`Local Skill reference retains a repository path: ${file}`);
      }
      outputs.set(file, text.trimEnd() + '\n');
    }
  }
  validateReferenceLinks(outputs);
  return outputs;
}

/** One self-contained ESM executable, built from the same validator as the product. */
export async function localValidatorOutputs(root: string, entryPoint = 'tools/scripts/local-authoring-validator.ts',
  outfile = 'scripts/validate-page.mjs', options: LocalBuildCacheOptions = {}): Promise<Map<string, string>> {
  const buildRoot = await realpath(root);
  const implementation = await Promise.all(['local-authoring-projection.ts', 'local-authoring-build-cache.ts'].map(file =>
    readFile(path.join(buildRoot, 'tools/scripts', file), 'utf8')));
  return withLocalBuildCache(buildRoot, {entryPoint, outfile, parameters: validatorBuildParameters, implementation}, options,
    () => buildLocalValidator(buildRoot, entryPoint, outfile));
}

const validatorBuildParameters = {
  bundle: true, platform: 'node' as const, format: 'esm' as const,
  write: false, target: 'node22', minify: true, metafile: true, legalComments: 'none' as const,
  banner: {js: 'import {createRequire} from "node:module"; const require = createRequire(import.meta.url);'}
};

// Stable virtual ids keep checkout locations out of CommonJS names and minifier decisions.
function stableModulePlugin(buildRoot: string, sourceFiles: Map<string, string>, directories: Set<string>, inputDigests: Map<string, string>): Plugin {
  return {
    name: 'local-skill-module-ids',
    setup(builder) {
      builder.onResolve({filter: /.*/}, async args => {
        if (args.pluginData?.physicalResolution) return undefined;
        const resolveDir = args.resolveDir || buildRoot;
        const request = args.kind === 'entry-point' && !path.isAbsolute(args.path) ? `./${args.path}` : args.path;
        observeResolution(buildRoot, resolveDir, request, directories);
        const resolved = await builder.resolve(args.path, {
          resolveDir, kind: args.kind, pluginData: {physicalResolution: true}
        });
        if (resolved.errors.length || resolved.external) return resolved;
        const physical = await realpath(resolved.path);
        const dependency = physical.indexOf('/node_modules/');
        const id = dependency >= 0 ? physical.slice(dependency + 1)
          : `source/${path.relative(buildRoot, physical).split(path.sep).join('/')}`;
        if (id.startsWith('source/../')) throw new Error('Local validator source escapes the product checkout');
        sourceFiles.set(id, physical);
        return {path: id, namespace: 'local-skill'};
      });
      builder.onLoad({filter: /.*/, namespace: 'local-skill'}, async args => {
        const physical = sourceFiles.get(args.path)!;
        const contents = await readFile(physical, 'utf8');
        inputDigests.set(physical, hash(contents));
        return {contents, resolveDir: path.dirname(physical),
          loader: physical.endsWith('.ts') ? 'ts' : physical.endsWith('.json') ? 'json' : 'js'};
      });
    }
  };
}

async function dependencyLicense(folder: string, files: Set<string>, inputDigests: Map<string, string>): Promise<[string, string] | undefined> {
  while (folder !== path.dirname(folder)) {
    const metadataFile = path.join(folder, 'package.json');
    const packageText = await readFile(metadataFile, 'utf8').catch(() => undefined);
    const metadata = packageText ? JSON.parse(packageText) : undefined;
    if (metadata?.name && metadata?.version) {
      files.add(metadataFile);
      inputDigests.set(metadataFile, hash(packageText!));
      const names = (await readdir(folder)).filter(name => /^(?:LICENSE|COPYING)(?:\.|$)/i.test(name)).sort();
      if (!names.length) throw new Error(`Missing bundled dependency license: ${metadata.name}`);
      const texts = await Promise.all(names.map(async name => {
        const file = path.join(folder, name);
        files.add(file);
        const contents = await readFile(file, 'utf8');
        inputDigests.set(file, hash(contents));
        return contents;
      }));
      return [`${metadata.name} - ${metadata.version} (${metadata.license ?? 'see license'})`, texts.join('\n')];
    }
    folder = path.dirname(folder);
  }
}

async function bundledLicenses(inputs: string[], sourceFiles: Map<string, string>, files: Set<string>, inputDigests: Map<string, string>): Promise<string> {
  const licenses = new Map<string, string>();
  for (const input of inputs.filter(file => file.includes('node_modules/'))) {
    const license = await dependencyLicense(path.dirname(sourceFiles.get(input.replace(/^local-skill:/, ''))!), files, inputDigests);
    if (license && !licenses.has(license[0])) licenses.set(...license);
  }
  return ('# Bundled dependency licenses\n\n' + [...licenses].sort(([a],[b]) => a.localeCompare(b))
    .map(([name,text]) => `## ${name}\n\n${text.trim()}\n`).join('\n')).trimEnd() + '\n';
}

async function buildLocalValidator(buildRoot: string, entryPoint: string, outfile: string): Promise<LocalBuildResult> {
  const sourceFiles = new Map<string, string>();
  const directories = new Set<string>();
  const inputDigests = new Map<string, string>();
  const result = await build({absWorkingDir: buildRoot, entryPoints: [entryPoint], outfile, ...validatorBuildParameters,
    plugins: [stableModulePlugin(buildRoot, sourceFiles, directories, inputDigests)]});
  const builtins = new Set(builtinModules.flatMap(name => [name, `node:${name}`]));
  for (const output of Object.values(result.metafile!.outputs)) {
    if (output.imports.some(item => !item.external || !builtins.has(item.path))) {
      throw new Error('Local validator has an external runtime dependency');
    }
  }
  const outputs = new Map<string, string>();
  for (const item of result.outputFiles!) {
    outputs.set(path.relative(buildRoot, item.path).split(path.sep).join('/'),
      '// Generated product validator; Node.js >=22; do not edit.\n' + item.text.replace(/^[ \t]+$/gm, '').trimEnd() + '\n');
  }
  const files = new Set(sourceFiles.values());
  outputs.set('scripts/THIRD-PARTY-LICENSES.md', await bundledLicenses(Object.keys(result.metafile!.inputs), sourceFiles, files, inputDigests));
  if (!outputs.has(outfile)) throw new Error('Missing standalone validator');
  return {outputs, files, directories, inputDigests};
}

export function localKnowledgeManifest(outputs: Map<string, string>, schemaVersion: string, productVersion: string): string {
  return json({
    skill: 'metriccanvas-local-authoring', schemaVersion, productContractVersion: productVersion,
    node: '>=22', schemaSha256: hash(outputs.get('references/page-metadata/schema.json')!),
    files: [...outputs].map(([file, content]) => ({file, sha256: hash(content)})).sort((a,b) => a.file.localeCompare(b.file))
  });
}

function stableExampleVersion(document: unknown, originalVersion: unknown): string {
  const declared = typeof originalVersion === 'string' && /^6\.(0|[1-9]\d*)$/.test(originalVersion)
    ? Number(originalVersion.split('.')[1]) : 0;
  const floor = Math.max(declared, requiredMinorVersion(document));
  const version = supportedVersions().find(version => version.startsWith('6.') && Number(version.split('.')[1]) >= floor);
  if (!version) throw new Error(`No supported example version for required minor ${floor}`);
  return version;
}

export function referenceProjection(outputs: Map<string, string>): Map<string, string> {
  return new Map([...outputs].filter(([file]) => file.startsWith('page/reference/')).map(([file, content]) => {
    const relative = file.slice('page/reference/'.length);
    // Valid recommended examples retain their declared capability floor. Only
    // legacy authoring shapes or an actual validation failure need rewriting.
    if (relative.startsWith('examples/') && relative.endsWith('.json')) {
      const parsed = JSON.parse(content);
      if (String(parsed.schemaVersion).startsWith('6.') && !parsed.iocHeader && !parsed.dashboardToolbar && validate(parsed).length === 0) return [relative, content];
      const needsUpgrade = parsed.iocHeader || String(parsed.schemaVersion).startsWith('5.');
      const upgraded=needsUpgrade?upgradePageDocument(parsed):undefined;
      if(upgraded&&!upgraded.ok)throw new Error(`Invalid IOC Skill example: ${relative}`);
      const {dashboardToolbar:_legacyToolbar,...candidate}=upgraded?.ok?upgraded.document:parsed;
      const normalized = normalizePageDocument({...candidate, schemaVersion: versionPolicy.current});
      if (!normalized.ok) throw new Error(`Invalid current Skill example: ${relative}`);
      const document = {...normalized.document, schemaVersion: stableExampleVersion(normalized.document, parsed.schemaVersion)};
      const errors = validate(document);
      if (errors.length) throw new Error(`Invalid current Skill example ${relative}: ${JSON.stringify(errors)}`);
      return [relative, JSON.stringify(document, null, 2) + '\n'];
    }
    return [relative, content];
  }));
}
