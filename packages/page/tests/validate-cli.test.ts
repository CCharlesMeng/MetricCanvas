import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('validate CLI', () => {
  it.each(['empty', 'nested', 'wrong', 'duplicate'] as const)('递归目录场景：%s', kind => {
    const directory = mkdtempSync(join(tmpdir(), 'page-folders-'));
    const raw = JSON.parse(readFileSync('pages/capabilities/layout/demo.json', 'utf8'));
    const files = kind === 'empty' ? [] : kind === 'duplicate'
      ? ['demo.json', 'nested/deep/demo.json'] : ['nested/deep/demo.json'];
    try {
      for (const file of files) {
        const target = join(directory, file);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, JSON.stringify(kind === 'wrong' ? { ...raw, id: 'wrong' } : raw));
      }
      const result = spawnSync(process.execPath, ['--import', 'tsx', 'packages/page/src/validate-cli.ts', directory], { encoding: 'utf8' });
      expect(result.status, result.stderr).toBe(kind === 'nested' ? 0 : kind === 'wrong' ? 1 : 2);
      const expected = {
        empty: '没有找到页面文档', nested: '共 1 个页面文档,1 通过,0 失败',
        wrong: '与 Page.id(wrong)不一致', duplicate: '重复页面 ID demo'
      };
      expect(result.stdout + result.stderr).toContain(expected[kind]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it('直接校验裸 Page fixtures', () => {
    const root = resolve(import.meta.dirname, '../../..');
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'packages/page/src/validate-cli.ts',
        'packages/page/fixtures/contract-valid'
      ],
      { cwd: root, encoding: 'utf8' }
    );

    expect(result.status, result.stderr).toBe(0);
    const count = readdirSync(resolve(root, 'packages/page/fixtures/contract-valid')).filter(file => file.endsWith('.json')).length;
    expect(result.stdout).toContain(`共 ${count} 个页面文档,${count} 通过,0 失败`);
  });
});
