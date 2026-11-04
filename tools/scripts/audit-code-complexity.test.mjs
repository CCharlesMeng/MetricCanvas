import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { categoryOf, gateFailures, regressionFailures, summarize, svelteScript } from './audit-code-complexity.mjs';
import { measureSource } from './measure-ts-complexity.mjs';

const file = (functions) => ({ functions: functions.map(selfCC => ({ selfCC })) });
test('uses an unrounded function-weighted average, with 5 excluded', () => {
  assert.equal(summarize([file([1]), file([5, 6])]).average, 4);
  assert.equal(summarize([file([])]).average, null);
  const report = { errors: [], languages: { ts: { maintained: summarize([file([5])]) } } };
  assert.match(gateFailures(report)[0], /must be <5/);
});
test('reports individual hotspots even when the average passes; strict function check is explicit', () => {
  const report = { errors: [], languages: { ts: { maintained: summarize([file([1, 1, 1, 16])]) } } };
  assert.deepEqual(gateFailures(report), []);
  assert.equal(report.languages.ts.maintained.overFunctionMaximum, 1);
  assert.match(gateFailures(report, true)[0], /exceed 15/);
  assert.equal(gateFailures({ ...report, errors: [{ file: 'broken.ts', error: 'parse failure' }] }).length, 1);
});
test('keeps generated and historical code separately visible rather than treating duplicate copies as fixes', () => {
  assert.equal(categoryOf('metriccanvas-authoring/mc-content/scripts/inspect-page.mjs'), 'generated');
  assert.equal(categoryOf('packages/engine/runtime-ui/src/report-pdf-capture.ts'), 'generated');
  assert.equal(categoryOf('metriccanvas-authoring/contracts/authored/publication-contract.ts'), 'production');
  assert.equal(categoryOf('packages/page/tests/page.test.ts'), 'tests');
  assert.equal(categoryOf('tools/scripts/page-reference.ts'), 'tooling');
  assert.equal(categoryOf('docs/evidence/previous/check.mjs'), 'historical');
});
test('parses actual Svelte script blocks, preserves source lines, and explicitly excludes template branches', () => {
  const source = `<!-- <script>broken(</script> -->\n<script module lang="ts">\nexport function outer() { return () => flag ? 1 : 0; }\n</script>\n<script lang="ts">\nconst sample = '<script>not code';\nfunction run(value: number) { if (value) return 1; return 0; }\n</script>\n{#if visible}<p>{sample}</p>{/if}`;
  const script = svelteScript('sample.svelte', source);
  assert.deepEqual(measureSource('sample.ts', script).functions.map(fn => [fn.line, fn.selfCC]), [[3, 1], [3, 2], [7, 2]]);
  assert.throws(() => svelteScript('broken.svelte', '<script>const x = ;</script>'));
});
test('Python inventory includes nested callables and class methods once, and rejects invalid sources', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mc-python-complexity-'));
  const source = join(directory, 'sample.py'), broken = join(directory, 'broken.py');
  writeFileSync(source, 'class Store:\n def read(self, value):\n  if value: return 1\n  return 0\ndef outer():\n def child(value):\n  return 1 if value else 0\n return child\n');
  writeFileSync(broken, 'def broken(:');
  try {
    const output = execFileSync(process.env.METRICCANVAS_PYTHON ?? 'python3', ['tools/scripts/measure-python-complexity.py'], {
      input: JSON.stringify([source, broken]), encoding: 'utf8',
    });
    const report = JSON.parse(output);
    assert.deepEqual(report.files[0].functions.map(fn => [fn.qualifiedName, fn.selfCC]), [['outer', 1], ['outer/child', 2], ['Store.read', 2]]);
    assert.ok(report.files[1].error);
  } finally { rmSync(directory, { recursive: true }); }
});

test('rejects new, increased, moved and duplicated high-complexity functions without treating line shifts as new debt', () => {
  const row = { file: 'source.ts', language: 'typescript-javascript', qualifiedName: 'factory/<anonymous@4:2>', selfCC: 20, line: 4 };
  const shifted = { ...row, qualifiedName: 'factory/<anonymous@40:2>', line: 40 };
  assert.deepEqual(regressionFailures([shifted], [row]), []);
  assert.equal(regressionFailures([{ ...shifted, selfCC: 21 }], [row]).length, 1);
  assert.equal(regressionFailures([{ ...row, file: 'moved.ts' }], [row]).length, 1);
  assert.equal(regressionFailures([{ ...row, qualifiedName: 'renamed' }], [row]).length, 1);
  assert.equal(regressionFailures([row, shifted], [row]).length, 1);
  assert.equal(regressionFailures([row], []).length, 1);
  assert.deepEqual(regressionFailures([{ ...row, selfCC: 18 }], [row]), []);
});
