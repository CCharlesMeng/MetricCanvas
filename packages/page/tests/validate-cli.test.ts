import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('validate CLI', () => {
  it('递归检查嵌套页面，拒绝文件名错配、跨目录重名和空目录', () => {
    const directory = mkdtempSync(join(tmpdir(), 'page-folders-'));
    const run = () => spawnSync(process.execPath, ['--import', 'tsx', 'packages/page/src/validate-cli.ts', directory], { encoding: 'utf8' });
    try {
      expect(run().status).toBe(2);
      mkdirSync(join(directory, 'nested/deep'), { recursive: true });
      const raw = JSON.parse(readFileSync('pages/capabilities/layout/demo.json', 'utf8'));
      writeFileSync(join(directory, 'nested/deep/demo.json'), JSON.stringify(raw));
      expect(run().stdout).toContain('共 1 个页面文档,1 通过,0 失败');
      writeFileSync(join(directory, 'nested/deep/demo.json'), JSON.stringify({ ...raw, id: 'wrong' }));
      expect(run().stderr).toContain('与 Page.id(wrong)不一致');
      writeFileSync(join(directory, 'demo.json'), JSON.stringify(raw));
      const duplicate = run();
      expect(duplicate.status).toBe(2);
      expect(duplicate.stderr).toContain('重复页面 ID demo');
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
