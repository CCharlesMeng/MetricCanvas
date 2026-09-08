import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { preprocess } from 'svelte/compiler';
import ts from 'typescript';

const root = fileURLToPath(new URL('../..', import.meta.url));
const sources = {
  page: { src: '.' },
  engine: Object.fromEntries(['runtime', 'widgets', 'runtime-ui', 'data-gateway'].map((part) => [`${part}/src`, `${part}/src`])),
  'metric-canvas': { src: '.' }
};
const name = process.argv[2];
if (!Object.hasOwn(sources, name)) throw new Error(`Unknown package: ${name}`);
const cwd = join(root, 'packages', name);
const input = join(cwd, '.svelte-kit/package-input');
await rm(input, { recursive: true, force: true });
await mkdir(input, { recursive: true });

/** 只改打包副本：仓内继续使用源码，发布包的 ESM 路径必须可由 Node 直接解析。 */
async function specifierFor(value, originalFile) {
  if (!value.startsWith('.')) return value;
  if (/\.svg(?:\?inline)?$/.test(value)) return value.replace(/\?inline$/, '') + '.js';
  if (value.endsWith('.json')) return value + '.js';
  if (value.endsWith('.svelte') || value.endsWith('.js')) return value;
  if (value.endsWith('.ts')) return value.slice(0, -3) + '.js';
  for (const suffix of ['.ts', '/index.ts']) {
    if (await stat(resolve(dirname(originalFile), value + suffix)).then((s) => s.isFile(), () => false)) {
      return value + suffix.replace(/\.ts$/, '.js');
    }
  }
  throw new Error(`Unresolved relative import ${value} in ${relative(root, originalFile)}`);
}

async function rewriteImports(code, filename) {
  const source = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const literals = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      literals.push(node.moduleSpecifier);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0]) {
      literals.push(node.arguments[0]);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      literals.push(node.argument.literal);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  const edits = [];
  for (const literal of literals) {
    if (!ts.isStringLiteral(literal)) throw new Error(`Nonliteral module import in ${filename}`);
    const value = await specifierFor(literal.text, filename);
    if (value !== literal.text) edits.push({ start: literal.getStart(source), end: literal.end, value: JSON.stringify(value) });
  }
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    code = code.slice(0, edit.start) + edit.value + code.slice(edit.end);
  }
  return code;
}

async function stage(from, to) {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const source = join(from, entry.name);
    const destination = join(to, entry.name);
    if (entry.isDirectory()) { await stage(source, destination); continue; }
    // 协议 CLI 是仓内工具；说明、测试与构建脚本不进入库代码。
    if (entry.name === 'validate-cli.ts' || /\.(test|spec)\.|\.md$/.test(entry.name)) continue;
    const content = await readFile(source, 'utf8');
    if (entry.name.endsWith('.svg')) {
      const uri = `data:image/svg+xml;base64,${Buffer.from(content).toString('base64')}`;
      await writeFile(destination + '.ts', `const url: string = ${JSON.stringify(uri)};\nexport default url;\n`);
    } else if (entry.name.endsWith('.json')) {
      // 保持地图的动态模块边界，避免要求集成应用安装 JSON / SVG loader。
      await writeFile(destination + '.ts', `const data: unknown = ${JSON.stringify(JSON.parse(content))};\nexport default data;\n`);
    } else if (entry.name.endsWith('.svelte')) {
      const transformed = await preprocess(content, { script: async ({ content }) => ({ code: await rewriteImports(content, source) }) }, { filename: source });
      await writeFile(destination, transformed.code);
    } else if (entry.name.endsWith('.ts')) {
      await writeFile(destination, await rewriteImports(content, source));
    } else {
      await cp(source, destination);
    }
  }
}

try {
  for (const [from, to] of Object.entries(sources[name])) await stage(join(cwd, from), join(input, to));
  const require = createRequire(import.meta.url);
  const cli = join(dirname(require.resolve('@sveltejs/package/package.json')), 'svelte-package.js');
  execFileSync(process.execPath, [cli, '--input', '.svelte-kit/package-input', '--output', 'dist', '--tsconfig', 'tsconfig.build.json'], { cwd, stdio: 'inherit' });
} finally {
  await rm(input, { recursive: true, force: true });
  await rm(join(cwd, '.svelte-kit/__package__'), { recursive: true, force: true });
}
