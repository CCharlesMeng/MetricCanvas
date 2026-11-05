import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const files = readdirSync(dist, { recursive: true }).filter((file) => /\.[cm]?js$/.test(file));

test('copied distribution declares its ESM package scope for integrating bundlers', () => {
  assert.equal(JSON.parse(readFileSync(resolve(dist, 'package.json'), 'utf8')).type, 'module');
});

test('packaged images cannot reintroduce external asset URLs', () => {
  const images = readdirSync(dist, { recursive: true }).filter(file => /\.(?:svg|png|jpe?g|gif|webp|avif|ico)$/i.test(file));
  assert.deepEqual(images, [], 'Imported images must be embedded as data URLs');
});

test('chart and workbook dependencies retain their reduced bundle budgets', () => {
  for (const { prefix, limit } of [
    { prefix: 'chunks/charts~', limit: 600_000 },
    { prefix: 'chunks/excel~', limit: 100_000 }
  ]) {
    const chunks = files.filter(file => file.startsWith(prefix));
    assert(chunks.length > 0, `Missing dependency chunks: ${prefix}`);
    const bytes = chunks.reduce((total, file) => total + statSync(resolve(dist, file)).size, 0);
    assert(bytes <= limit, `${prefix}: ${bytes} bytes exceeds the ${limit}-byte dependency budget`);
  }
});

test('ExcelJS remains a development reader rather than a runtime dependency', () => {
  const engine = JSON.parse(readFileSync(new URL('../../engine/package.json', import.meta.url), 'utf8'));
  assert.equal(engine.dependencies.exceljs, undefined);
  assert.equal(engine.dependencies['write-excel-file'], '4.1.1');
  assert(files.every(file => !file.includes('exceljs')), 'ExcelJS must not be present in runtime chunks');
});

test('distribution contains about ten bounded JS files and the two stable entries', () => {
  assert(files.length >= 10 && files.length <= 16, `Expected 10–16 JS files, got ${files.length}`);
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

test('every ESM dependency and module-relative URL resolves inside the copied distribution', () => {
  for (const file of files.filter((name) => name !== 'metriccanvas-runtime.global.js')) {
    const fullPath = resolve(dist, file);
    const source = ts.createSourceFile(file, readFileSync(fullPath, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      let specifier;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier;
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        specifier = node.arguments[0];
      }
      if (ts.isNewExpression(node) && node.expression.getText(source) === 'URL'
        && node.arguments?.[1]?.getText(source) === 'import.meta.url') {
        specifier = node.arguments[0];
      }
      if (specifier && (ts.isStringLiteral(specifier) || ts.isNoSubstitutionTemplateLiteral(specifier))) {
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
