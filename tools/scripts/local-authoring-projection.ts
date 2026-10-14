import { createHash } from 'node:crypto';
import { builtinModules } from 'node:module';
import { readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { build, type Plugin } from 'esbuild';
import { validateReferenceLinks } from './page-reference';

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
export async function localValidatorOutputs(root: string): Promise<Map<string, string>> {
  const buildRoot = await realpath(root);
  const sourceFiles = new Map<string,string>();
  // Stable virtual module ids remove checkout locations from both generated
  // CommonJS names and minifier decisions, while real resolution uses pnpm.
  const stableModules: Plugin = {
    name: 'local-skill-module-ids',
    setup(builder) {
      builder.onResolve({filter: /.*/}, async args => {
        if (args.pluginData?.physicalResolution) return undefined;
        const resolved = await builder.resolve(args.path, {
          resolveDir: args.resolveDir || buildRoot, kind: args.kind,
          pluginData: {physicalResolution: true}
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
        return {contents: await readFile(physical, 'utf8'), resolveDir: path.dirname(physical),
          loader: physical.endsWith('.ts') ? 'ts' : physical.endsWith('.json') ? 'json' : 'js'};
      });
    }
  };
  const result = await build({
    absWorkingDir: buildRoot, entryPoints: ['tools/scripts/local-authoring-validator.ts'],
    outfile: 'scripts/validate-page.mjs', bundle: true, platform: 'node', format: 'esm',
    write: false, target: 'node22', minify: true, metafile: true, legalComments: 'none',
    banner: {js: 'import {createRequire} from "node:module"; const require = createRequire(import.meta.url);'},
    plugins: [stableModules]
  });
  const builtins = new Set(builtinModules.flatMap(name => [name, `node:${name}`]));
  for (const output of Object.values(result.metafile.outputs)) {
    if (output.imports.some(item => !item.external || !builtins.has(item.path))) {
      throw new Error('Local validator has an external runtime dependency');
    }
  }
  const outputs = new Map<string, string>();
  for (const item of result.outputFiles) {
    outputs.set(path.relative(buildRoot, item.path).split(path.sep).join('/'),
      '// Generated product validator; Node.js >=22; do not edit.\n' + item.text.replace(/^[ \t]+$/gm, '').trimEnd() + '\n');
  }
  // Bundle the actual dependency licenses as well as their code. Source paths
  // stay in the maintainer's build graph, never in the installed knowledge.
  const licenses = new Map<string,string>();
  for (const input of Object.keys(result.metafile.inputs).filter(file => file.includes('node_modules/'))) {
    let folder = path.dirname(sourceFiles.get(input.replace(/^local-skill:/, ''))!);
    while (folder !== path.dirname(folder)) {
      const packageText = await readFile(path.join(folder, 'package.json'), 'utf8').catch(() => undefined);
      const metadata = packageText ? JSON.parse(packageText) : undefined;
      if (metadata?.name && metadata?.version) {
        const key = `${metadata.name} - ${metadata.version} (${metadata.license ?? 'see license'})`;
        if (!licenses.has(key)) {
          const names = (await readdir(folder)).filter(name => /^(?:LICENSE|COPYING)(?:\.|$)/i.test(name)).sort();
          if (!names.length) throw new Error(`Missing bundled dependency license: ${metadata.name}`);
          licenses.set(key, (await Promise.all(names.map(name => readFile(path.join(folder, name), 'utf8')))).join('\n'));
        }
        break;
      }
      folder = path.dirname(folder);
    }
  }
  outputs.set('scripts/THIRD-PARTY-LICENSES.md', '# Bundled dependency licenses\n\n' +
    [...licenses].sort(([a],[b]) => a.localeCompare(b)).map(([name,text]) => `## ${name}\n\n${text.trim()}\n`).join('\n'));
  if (!outputs.has('scripts/validate-page.mjs')) throw new Error('Missing standalone validator');
  return outputs;
}

export function localKnowledgeManifest(outputs: Map<string, string>, schemaVersion: string, productVersion: string): string {
  return json({
    skill: 'metriccanvas-local-authoring', schemaVersion, productContractVersion: productVersion,
    node: '>=22', schemaSha256: hash(outputs.get('references/page-metadata/schema.json')!),
    files: [...outputs].map(([file, content]) => ({file, sha256: hash(content)})).sort((a,b) => a.file.localeCompare(b.file))
  });
}
