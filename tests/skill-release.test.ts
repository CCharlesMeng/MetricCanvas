import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const directory = mkdtempSync(join(tmpdir(), 'skill-release-test-'));
const source = resolve('metriccanvas-authoring/skill/metriccanvas-local-authoring');
const archive = join(directory, 'skill.tar.gz');
const receiptFile = `${archive}.release.json`;
const script = resolve('tools/scripts/skill-release.py');
const python = process.env.METRICCANVAS_PYTHON ?? 'python3';
function run(args: string[], env?: NodeJS.ProcessEnv) {
  return spawnSync(python, [script, ...args], { encoding: 'utf8', timeout: 30_000, env });
}
function install(archivePath: string, destination: string) {
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination);
  const result = spawnSync('tar', ['-xzf', archivePath, '-C', destination], { encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
  return join(destination, 'metriccanvas-local-authoring');
}
beforeAll(() => {
  const result = run(['pack', '--source', source, '--output', archive]);
  expect(result.status, result.stderr).toBe(0);
}, 35_000);
afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe('standalone Skill release archive', () => {
  it('records the complete install tree and verifies the actual archive outside the repo', () => {
    const receipt = JSON.parse(readFileSync(receiptFile, 'utf8'));
    expect(receipt.files['SKILL.md']).toBe(createHash('sha256').update(readFileSync(join(source, 'SKILL.md'))).digest('hex'));
    expect(receipt.source.commit).toMatch(/^[a-f0-9]{40}$/);
    expect(typeof receipt.source.uncommitted).toBe('boolean');
    expect(receipt.checks.map((check: { exitCode: number }) => check.exitCode)).toEqual([0, 0, 1]);
    const verified = run(['verify', '--archive', archive]);
    expect(verified.status, verified.stderr).toBe(0);
    expect(JSON.parse(verified.stdout)).toMatchObject({ verified: true, deployment: 'not_run' });
  }, 30_000);

  it('rejects archive corruption and author-file receipt drift', () => {
    const corrupt = join(directory, 'corrupt.tar.gz');
    writeFileSync(corrupt, Buffer.concat([readFileSync(archive), Buffer.from('corrupt')]));
    expect(run(['verify', '--archive', corrupt, '--receipt', receiptFile]).status).toBe(2);
    const receipt = JSON.parse(readFileSync(receiptFile, 'utf8'));
    receipt.files['SKILL.md'] = '0'.repeat(64);
    const changed = join(directory, 'changed.release.json');
    writeFileSync(changed, JSON.stringify(receipt));
    const result = run(['verify', '--archive', archive, '--receipt', changed]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('differs from release receipt');
  }, 30_000);

  it('rejects a downloaded receipt from a different CI commit', () => {
    const receipt = JSON.parse(readFileSync(receiptFile, 'utf8'));
    const result = run(['verify', '--archive', archive], { ...process.env, GITHUB_SHA: '0'.repeat(40) });
    expect(receipt.source.commit).not.toBe('0'.repeat(40));
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('differs from CI SHA');
  });

  it('rejects stale generated files, external symlinks, and overwrite attempts', () => {
    const copy = join(directory, 'source');
    cpSync(source, copy, { recursive: true });
    const example = join(copy, 'assets/layouts/overview-map-led.json');
    const bytes = readFileSync(example);
    writeFileSync(example, '{}');
    const output = join(directory, 'rejected.tar.gz');
    const stale = run(['pack', '--source', copy, '--output', output]);
    expect(stale.status).toBe(2);
    expect(stale.stderr).toContain('Knowledge digest mismatch');
    writeFileSync(example, bytes);
    symlinkSync(script, join(copy, 'external.py'));
    expect(run(['pack', '--source', copy, '--output', output]).status).toBe(2);
    const before = readFileSync(archive);
    expect(run(['pack', '--source', source, '--output', archive]).status).toBe(2);
    expect(readFileSync(archive)).toEqual(before);
  }, 30_000);

  it('replaces and rolls back the whole installation without leaving newer files behind', () => {
    const next = join(directory, 'next-source');
    cpSync(source, next, { recursive: true });
    const entry = readFileSync(join(next, 'SKILL.md'), 'utf8');
    writeFileSync(join(next, 'SKILL.md'), entry.replace(/^  version: .*$/m, '  version: "99.0.0"'));
    writeFileSync(join(next, 'newer-only.txt'), 'synthetic upgrade marker');
    const newer = join(directory, 'newer.tar.gz');
    const packed = run(['pack', '--source', next, '--output', newer],
      { ...process.env, GITHUB_SHA: undefined, GITHUB_ACTIONS: undefined });
    expect(packed.status, packed.stderr).toBe(0);
    expect(JSON.parse(packed.stdout).source).toMatchObject({ kind: 'external-copy', uncommitted: true });
    const destination = join(directory, 'installed');
    const installed = install(newer, destination);
    expect(readFileSync(join(installed, 'SKILL.md'), 'utf8')).toContain('99.0.0');
    expect(existsSync(join(installed, 'newer-only.txt'))).toBe(true);
    install(archive, destination);
    expect(readFileSync(join(installed, 'SKILL.md'), 'utf8')).toBe(entry);
    expect(existsSync(join(installed, 'newer-only.txt'))).toBe(false);
  }, 30_000);
});
