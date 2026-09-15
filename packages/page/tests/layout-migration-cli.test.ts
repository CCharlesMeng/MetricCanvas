import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, expect, it } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'layout-migration-'));
const cli = resolve('tools/scripts/migrate-layout.ts');
afterAll(() => rmSync(dir, { recursive: true, force: true }));

it.each(['report', 'dashboard'])('CLI追加迁移%s且原文不变，重复规范化一致', (layoutForm) => {
  const input = resolve(`packages/page/fixtures/contract-valid/legacy-layout-${layoutForm}.json`);
  const before = readFileSync(input, 'utf8');
  const output = join(dir, `${layoutForm}.json`);
  execFileSync(process.execPath, ['--import', 'tsx', cli, input, output]);
  const normalized = JSON.parse(readFileSync(output, 'utf8'));
  expect(normalized).toMatchObject({ schemaVersion: '6.1', layout: layoutForm });
  expect(normalized).not.toHaveProperty('layoutForm');
  expect(normalized.dataSources).toEqual(JSON.parse(before).dataSources);
  expect(readFileSync(input, 'utf8')).toBe(before);
  const again = join(dir, `${layoutForm}-again.json`);
  execFileSync(process.execPath, ['--import', 'tsx', cli, output, again]);
  expect(readFileSync(again, 'utf8')).toBe(readFileSync(output, 'utf8'));
  for (const target of [input, output]) {
    const saved = readFileSync(target, 'utf8');
    expect(spawnSync(process.execPath, ['--import', 'tsx', cli, input, target]).status).not.toBe(0);
    expect(readFileSync(target, 'utf8')).toBe(saved);
  }
});

it.each(['7.0', '6.4', 'bad'])('CLI拒绝%s且不留下输出', (schemaVersion) => {
  const input = join(dir, `bad-${schemaVersion}.json`);
  const output = join(dir, `bad-${schemaVersion}-output.json`);
  writeFileSync(input, JSON.stringify({ schemaVersion }));
  expect(spawnSync(process.execPath, ['--import', 'tsx', cli, input, output]).status).not.toBe(0);
  expect(existsSync(output)).toBe(false);
  expect(JSON.parse(readFileSync(input, 'utf8'))).toEqual({ schemaVersion });
});
