import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'svelte/compiler';
import ts from 'typescript';
import { artifacts, exportedNames } from './surface';

const root = fileURLToPath(new URL('../..', import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'metriccanvas-pack-check-'));
const results = [];

type ExportEntry = { types: string; default: string; svelte?: string; import?: string };
type Manifest = {
  name: string;
  version: string;
  exports: Record<string, ExportEntry>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

/** 发布代码的相对引用必须指向包内现存文件，不能依赖 bundler 补扩展名。 */
function checkImports(code: string, file: string, packageRoot: string) {
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
  function visit(node: ts.Node) {
    let literal: ts.Node | undefined;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) literal = node.moduleSpecifier;
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) literal = node.arguments[0];
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) literal = node.argument.literal;
    if (literal && ts.isStringLiteral(literal) && literal.text.startsWith('.')) {
      const target = resolve(dirname(file), literal.text);
      assert(target.startsWith(packageRoot + '/'), `${file} escapes the package: ${literal.text}`);
      assert(existsSync(target), `${file} has a missing relative import: ${literal.text}`);
      assert(/\.(js|svelte)$/.test(target), `${file} has an uncompiled import: ${literal.text}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

try {
  for (const [name, artifact] of Object.entries(artifacts)) {
    const cwd = dirname(join(root, artifact.manifest));
    const archive = join(temp, name.slice('@metriccanvas/'.length) + '.tgz');
    execFileSync('pnpm', ['pack', '--out', archive], { cwd, stdio: 'pipe' });
    const unpacked = join(temp, name.slice('@metriccanvas/'.length));
    mkdirSync(unpacked);
    execFileSync('tar', ['-xzf', archive, '-C', unpacked]);
    const packageRoot = join(unpacked, 'package');
    const manifest: Manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
    assert.deepEqual(Object.keys(manifest.exports).sort(), Object.keys(artifact.entries).sort(), `${name} export subpaths drifted`);
    assert(!JSON.stringify(manifest).includes('workspace:'), `${name} still has workspace protocol dependencies`);

    for (const [subpath, source] of Object.entries(artifact.entries)) {
      const entry = manifest.exports[subpath]!;
      assert(entry.types.startsWith('./dist/') && entry.default.startsWith('./dist/'), `${name}${subpath} does not export dist`);
      for (const path of Object.values(entry)) assert(existsSync(join(packageRoot, path)), `${name}${subpath} missing ${path}`);
      const declarations = exportedNames(join(packageRoot, entry.types));
      const sourceNames = exportedNames(join(root, source));
      assert.deepEqual([...new Set(declarations)].sort(), [...new Set(sourceNames)].sort(), `${name}${subpath} declaration exports drifted`);
      if (name !== '@metriccanvas/embed') {
        // embed 的最终 bundle 会重命名内部变量；其导出由声明与现有实际浏览器回归覆盖。
        const jsNames = exportedNames(join(packageRoot, entry.default));
        const values = exportedNames(join(root, source), new Set(), true);
        assert.deepEqual([...new Set(jsNames)].sort(), [...new Set(values)].sort(), `${name}${subpath} runtime exports drifted`);
      }
    }

    const files = readdirSync(packageRoot, { recursive: true, withFileTypes: true }).filter((file) => file.isFile());
    let components = 0;
    for (const file of files) {
      const path = join(file.parentPath, file.name);
      const relative = path.slice(packageRoot.length + 1);
      assert(relative.startsWith('dist/') || /^(?:package\.json|README(?:\.md)?|LICENSE(?:\.md)?)$/i.test(relative), `Unexpected packed file: ${relative}`);
      assert(!(/\.(test|spec)\.|\.map$/.test(relative) || (/\.ts$/.test(relative) && !/\.d\.ts$/.test(relative))), `Source/test included: ${relative}`);
      if (!/\.(?:js|ts|svelte)$/.test(relative)) continue;
      const code = readFileSync(path, 'utf8');
      assert(!code.includes('.svelte-kit/package-input') && !code.includes(root), `Workspace path leaked: ${relative}`);
      if (relative.endsWith('.svelte')) {
        // 没有 preprocess：集成应用只用标准 Svelte 编译器即可消费。
        const compiled = compile(code, { filename: path, generate: 'client' });
        checkImports(compiled.js.code, path, packageRoot);
        components++;
      } else if (name !== '@metriccanvas/embed') checkImports(code, path, packageRoot);
    }
    if (name === '@metriccanvas/page') {
      const dependencies = { ...manifest.dependencies, ...manifest.peerDependencies };
      assert(!('echarts' in dependencies) && !('svelte' in dependencies));
    }
    results.push({ name, version: manifest.version, entries: Object.keys(manifest.exports).length, files: files.length, components });
  }
  console.log(JSON.stringify({ packages: results }, null, 2));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
