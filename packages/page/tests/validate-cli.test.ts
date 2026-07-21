import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('validate CLI', () => {
  it('直接校验裸 Page fixtures', () => {
    const root = resolve(import.meta.dirname, '../../..');
    const result = spawnSync(
      'pnpm',
      [
        'exec',
        'tsx',
        'packages/page/src/validate-cli.ts',
        'packages/page/fixtures/contract-valid',
        '--catalog',
        'packages/page/fixtures/catalog.json'
      ],
      { cwd: root, encoding: 'utf8' }
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('共 3 个页面文档,3 通过,0 失败');
  });
});
