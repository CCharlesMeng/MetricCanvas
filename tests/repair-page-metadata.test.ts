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
const sample = JSON.parse(readFileSync('packages/page/fixtures/contract-valid/url-navigation-page.json', 'utf8'));
afterAll(() => rmSync(folder, { recursive: true, force: true }));

function run(args: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', script, ...args], {
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
