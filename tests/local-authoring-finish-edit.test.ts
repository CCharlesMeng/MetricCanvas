import { afterAll, beforeAll, expect, it } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = mkdtempSync(path.join(tmpdir(), 'finish-edit-'));
const skill = path.join(root, 'skill');
const target = path.join(root, 'numeric-value-display.json');
const snapshots: string[] = [];
const fieldAt = '/sections/0/components/3/props/columns/1/field';
function cli(name: string, args: string[]) {
  const result = spawnSync(process.execPath, [path.join(skill, 'scripts', name), ...args], {cwd: root, encoding: 'utf8'});
  const receipt = JSON.parse(result.stdout || result.stderr);
  if (receipt.snapshot) snapshots.push(receipt.snapshot.folder);
  return {code: result.status, receipt};
}
function baseline() {
  cpSync('pages/capabilities/data/numeric-value-display.json', target);
  const result = cli('snapshot-attempt.mjs', [target]).receipt;
  snapshots.push(result.folder);
  return result;
}
function edit() {
  const page = JSON.parse(readFileSync(target, 'utf8'));
  page.sections[0].components[3].props.columns[1].field.format = 'number-1';
  writeFileSync(target, JSON.stringify(page, null, 2));
  return page;
}
function finish(base: any, more: string[] = []) {
  return cli('finish-edit.mjs', ['--page', target, '--baseline', base.file, '--baseline-sha256', base.sha256,
    '--allow', fieldAt, '--expected-layout', 'dashboard', ...more]);
}
beforeAll(() => cpSync('metriccanvas-authoring/skill/metriccanvas-local-authoring', skill, {recursive: true}));
afterAll(() => { for (const folder of snapshots) rmSync(folder, {recursive: true, force: true}); rmSync(root, {recursive: true, force: true}); });
it('仓外一次返回范围比较、冻结产物和完整校验，数字写法/键序不触发伪差异', () => {
  const base = baseline(); edit(); const bytes = readFileSync(target); const result = finish(base);
  expect(result.code).toBe(0);
  expect(result.receipt).toMatchObject({status: 'static-verified', intent: 'not-assessed', runtime: 'not-assessed',
    scope: {ok: true, unexpectedCount: 0, changedPaths: [fieldAt + '/format']}, validation: {exitCode: 0, receipt: {ok: true}}, snapshotIntact: true, currentMatchesSnapshot: true});
  expect(readFileSync(result.receipt.snapshot.file)).toEqual(bytes);
  expect(readFileSync(target)).toEqual(bytes);
});
it('范围外修改即使页面合法也拒绝，保留候选快照', () => {
  const base = baseline(); const page = edit(); page.meta.title = 'unwanted'; writeFileSync(target, JSON.stringify(page));
  const result = finish(base);
  expect(result.code).toBe(1); expect(result.receipt.scope.unexpectedPaths).toContain('/meta/title');
  expect(result.receipt.validation.receipt.ok).toBe(true); expect(readFileSync(result.receipt.snapshot.file, 'utf8')).toContain('unwanted');
});
it('允许范围内非法格式仍被完整产品校验拒绝', () => {
  const base = baseline(); const page = edit(); page.sections[0].components[3].props.columns[1].field.format = 'invented'; writeFileSync(target, JSON.stringify(page));
  const result = finish(base); expect(result.code).toBe(1); expect(result.receipt.scope.ok).toBe(true);
  expect(result.receipt.validation.exitCode).toBe(1); expect(result.receipt.validation.receipt.errors.length).toBeGreaterThan(0);
});
it('不接受变化的原件身份', () => {
  const base = baseline(); edit(); const result = finish({...base, sha256: '0'.repeat(64)});
  expect(result.code).toBe(2); expect(result.receipt.error).toContain('Baseline identity mismatch');
});
it('不能用页面根作为允许范围绕过局部检查', () => {
  const base = baseline(); edit(); const result = finish(base, ['--allow', '/']);
  expect(result.code).toBe(2); expect(result.receipt.error).toContain('non-root');
});
it('非法JSON仍冻结失败现场，比较和完整校验均不通过', () => {
  const base = baseline(); writeFileSync(target, '{invalid'); const result = finish(base);
  expect(result.code).toBe(1); expect(result.receipt.scope.ok).toBe(false); expect(result.receipt.validation.exitCode).toBe(1);
  expect(readFileSync(result.receipt.snapshot.file, 'utf8')).toBe('{invalid');
});
it('类型和数组顺序变化不会被数值/文本等价掩盖', () => {
  const base = baseline(); const page = edit(); page.sections[0].components[3].props.columns.reverse(); writeFileSync(target, JSON.stringify(page));
  const result = finish(base); expect(result.code).toBe(1); expect(result.receipt.scope.unexpectedCount).toBeGreaterThan(0);
});
it.each(['target', 'snapshot'])('校验期间%s变化时不返回成功回执', mode => {
  const base = baseline(); edit();
  const validator = path.join(skill, 'scripts/validate-page.mjs'); const original = readFileSync(validator);
  const victim = mode === 'target' ? JSON.stringify(target) : 'process.argv.at(-1)';
  writeFileSync(validator, `import fs from 'node:fs';const file=${victim};fs.chmodSync(file,0o644);fs.appendFileSync(file,'\\n');console.log(JSON.stringify({ok:true,errors:[]}));`);
  try {
    const result = finish(base); expect(result.code).toBe(1);
    expect(result.receipt[mode === 'target' ? 'currentMatchesSnapshot' : 'snapshotIntact']).toBe(false);
  } finally { writeFileSync(validator, original); }
});
it('布尔true不与数值1视为相同的范围外数据', () => {
  baseline(); const original = JSON.parse(readFileSync(target, 'utf8')); original.dataSources.sample.source.rows[0].amount = 1;
  writeFileSync(target, JSON.stringify(original)); const base = cli('snapshot-attempt.mjs', [target]).receipt; snapshots.push(base.folder);
  const page = edit(); page.dataSources.sample.source.rows[0].amount = true; writeFileSync(target, JSON.stringify(page));
  const result = finish(base); expect(result.code).toBe(1);
  expect(result.receipt.scope.unexpectedPaths).toContain('/dataSources/sample/source/rows/0/amount');
});
it('两个明确目标允许一次验收，保留各自差异路径', () => {
  const base = baseline(); const page = edit(); page.sections[0].components[3].props.columns[2].field = {data: 'main', field: 'rate', format: 'percent-1'};
  writeFileSync(target, JSON.stringify(page));
  const second = '/sections/0/components/3/props/columns/2/field'; const result = finish(base, ['--allow', second]);
  expect(result.code).toBe(0); expect(result.receipt.scope.changedPaths).toEqual([fieldAt + '/format', second]);
});
