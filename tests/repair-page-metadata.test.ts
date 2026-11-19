import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { inspectPageDocument } from '../tools/scripts/local-authoring-validator';
import { versionPolicy } from '../packages/page/src/version';

const root = resolve('.');
const folder = mkdtempSync(join(tmpdir(), 'repair-page-test-'));
const script = resolve('.agents/skills/repair-page-metadata/scripts/inspect-page-metadata.ts');
const regionDiagnosisScript = resolve('.agents/skills/repair-page-metadata/scripts/diagnose-region-candidates.ts');
const businessResult = resolve('pages/temporary/business-result-pinned-diagnosis-20261102/business-result-metrics.json');
const standaloneValidator = resolve('metriccanvas-authoring/skill/metriccanvas-local-authoring/scripts/validate-page.mjs');
const sample = JSON.parse(readFileSync('packages/page/fixtures/contract-valid/url-navigation-page.json', 'utf8'));
afterAll(() => rmSync(folder, { recursive: true, force: true }));

function run(args: string[], entrypoint = script) {
  return spawnSync(process.execPath, ['--import', 'tsx', entrypoint, ...args], {
    cwd: root, encoding: 'utf8', timeout: 15_000
  });
}

function fixture(name: string, document: unknown = sample) {
  const directory = mkdtempSync(join(folder, 'case-'));
  const file = join(directory, name);
  writeFileSync(file, JSON.stringify(document));
  return file;
}

describe('repair-page-metadata real CLI', () => {
  it('starts against current product exports and accepts external URL navigation without target pages', () => {
    const file = fixture(`${sample.id}.json`);
    const before = readFileSync(file);
    const result = run([file]);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ scope: 'file', summary: { files: 1, passed: 1, failed: 0, errors: 0 } });
    expect(readFileSync(file)).toEqual(before);
  });

  it.each([true, false])('shares ordered static diagnostics with the standalone validator (valid=%s)', valid => {
    const file = fixture(valid ? `${sample.id}.json` : 'wrong-name.json');
    const repository = run([file]);
    const standalone = spawnSync(process.execPath, [standaloneValidator, file], { encoding: 'utf8', timeout: 15_000 });
    expect(repository.status, repository.stderr).toBe(valid ? 0 : 1);
    expect(standalone.status, standalone.stderr).toBe(repository.status);
    expect(JSON.parse(standalone.stdout).errors).toEqual(JSON.parse(repository.stdout).results[0].errors);
  });

  it.each(['filename', 'version', 'url', 'binding'])('keeps product ordered errors for %s', mode => {
    const page = structuredClone(sample);
    page.schemaVersion = versionPolicy.current;
    if (mode === 'version') page.schemaVersion = `${versionPolicy.major}.999`;
    if (mode === 'url') page.sections[0].components[0].props.actions[0].navigate = { href: 'javascript:alert(1)' };
    if (mode === 'binding') page.sections[0].components[0].props.actions[0].navigate = { href: '/outside', query: { p: { source: 'row', field: 'absent' } } };
    const name = mode === 'filename' ? 'wrong-name.json' : `${page.id}.json`;
    const expected = inspectPageDocument(name, page);
    expect(expected.length).toBeGreaterThan(0);
    const result = run([fixture(name, page)]);
    expect(result.status, result.stderr).toBe(1);
    expect(JSON.parse(result.stdout).results[0].errors).toEqual(expected);
  });

  it('reports invalid JSON without changing its original bytes', () => {
    const file = fixture('broken.json');
    writeFileSync(file, '{ invalid');
    const result = run([file]);
    expect(result.status, result.stderr).toBe(1);
    expect(JSON.parse(result.stdout).results[0].errors).toMatchObject([{ type: 'SCHEMA_ERROR', path: '/' }]);
    expect(readFileSync(file, 'utf8')).toBe('{ invalid');
  });

  it('recursively discovers nested pages and rejects cross-directory duplicate IDs', () => {
    const directory = mkdtempSync(join(folder, 'tree-'));
    mkdirSync(join(directory, 'nested'));
    writeFileSync(join(directory, 'nested', `${sample.id}.json`), JSON.stringify(sample));
    const first = run([directory]);
    expect(first.status, first.stderr).toBe(0);
    expect(JSON.parse(first.stdout).results[0].file).toBe(`nested/${sample.id}.json`);
    writeFileSync(join(directory, `${sample.id}.json`), JSON.stringify(sample));
    const duplicate = run([directory]);
    expect(duplicate.status).toBe(2);
    expect(JSON.parse(duplicate.stderr).error).toContain('重复页面 ID');
  });

  it.each(['missing', 'empty', 'extension', 'arguments'])('returns invocation error for %s', mode => {
    let args = [join(folder, 'absent.json')];
    if (mode === 'empty') args = [mkdtempSync(join(folder, 'empty-'))];
    if (mode === 'extension') args = [fixture('page.txt')];
    if (mode === 'arguments') args = [fixture(`${sample.id}.json`), 'unexpected'];
    const result = run(args);
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stderr).error).toBeTruthy();
  });
});

describe('IOC Region candidate diagnosis', () => {
  it.each([
    ['region=安徽代表处', 'region-candidate-resolution', 'pending', undefined],
    ['rep-office=安徽代表处', 'region-candidate-validation', 'unobserved', 'office'],
  ])('reports the URL stage for %s without echoing candidate values', (search, stage, state, level) => {
    const result = run([businessResult, '--source', 'cloud-service-options', '--search', search], regionDiagnosisScript);
    expect(result.status, result.stderr).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toMatchObject({
      stage, state, schemaVersion: JSON.parse(readFileSync(businessResult, 'utf8')).schemaVersion,
      declaresRegionDependency: false, filterId: 'region', dqeRequest: 'not-observed'
    });
    expect(output.level).toBe(level);
    expect(result.stdout).not.toContain('安徽代表处');
    expect(Buffer.byteLength(result.stdout)).toBeLessThan(1_024);
  });

  it.each([
    ['安徽代表处', 'resolved'],
    ['其他代表处', 'rejected'],
  ])('replays complete synthetic candidate receipts with result %s', (officeValue, state) => {
    const receipts = fixture('receipts.json', {
      geo: { status: 'ready', candidates: [{ level: 'geo', value: '全球', label: '全球' }] },
      'region-dept': { status: 'empty' },
      office: { status: 'ready', candidates: [{ level: 'office', value: officeValue, label: officeValue }] },
    });
    const result = run([businessResult, '--source', 'cloud-service-options', '--search', 'region=安徽代表处', '--region-receipts', receipts], regionDiagnosisScript);
    expect(result.status, result.stderr).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toMatchObject({ stage: 'region-candidate-resolution', state, dqeRequest: 'not-observed', receipts: { geo: 'ready', 'region-dept': 'empty', office: 'ready' } });
    expect(output.level).toBe(state === 'resolved' ? 'office' : undefined);
  });
});
