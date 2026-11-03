import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const files = readdirSync(dist, { recursive: true }).filter((file) => /\.[cm]?js$/.test(file));

test('distribution contains about ten bounded JS files and the two stable entries', () => {
  assert(files.length >= 10 && files.length <= 14, `Expected 10–14 JS files, got ${files.length}`);
  for (const entry of ['metriccanvas-runtime.es.js', 'metriccanvas-runtime.global.js']) {
    assert(files.includes(entry), `Missing public entry ${entry}`);
    assert(statSync(resolve(dist, entry)).size < 10_000, `${entry} must remain a small entry`);
  }
  const sizes = files.map((file) => ({ file, bytes: statSync(resolve(dist, file)).size }));
  for (const { file, bytes } of sizes) {
    assert(bytes <= 1_000_000, `${file}: ${bytes} bytes exceeds the 1,000,000-byte chunk budget`);
  }
  const largest = sizes.reduce((left, right) => left.bytes >= right.bytes ? left : right);
  console.info(JSON.stringify({ baseline: 'embed-distribution', maxJsBytes: 1_000_000, jsFiles: files.length, largest }));
});

test('every static and lazy ESM dependency resolves inside the copied distribution', () => {
  for (const file of files.filter((name) => name !== 'metriccanvas-runtime.global.js')) {
    const fullPath = resolve(dist, file);
    const source = ts.createSourceFile(file, readFileSync(fullPath, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      let specifier;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier;
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        specifier = node.arguments[0];
      }
      if (specifier && ts.isStringLiteral(specifier)) {
        assert(specifier.text.startsWith('.'), `${file} contains an external dependency: ${specifier.text}`);
        const target = resolve(dirname(fullPath), specifier.text);
        assert(target.startsWith(dist), `${file} escapes dist`);
        assert(statSync(target).isFile(), `${file} has a missing dependency: ${specifier.text}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
});
