import { afterAll, describe, expect, it } from 'vitest';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const isolated = mkdtempSync(path.join(tmpdir(), 'metriccanvas-contract-export-'));
afterAll(() => rmSync(isolated, { recursive: true, force: true }));

function check() {
  return spawnSync(process.execPath, ['--import', 'tsx', 'tools/scripts/export-authoring-contracts.ts', '--check'], {
    cwd: isolated, encoding: 'utf8', timeout: 30_000
  });
}

function withChangedFile(relative: string, content: string, verify: () => void) {
  const file = path.join(isolated, relative);
  const original = readFileSync(file);
  try {
    writeFileSync(file, content);
    verify();
  } finally {
    writeFileSync(file, original);
  }
}

describe('当前契约检查无需旧服务源码', () => {
  it('无旧链时可运行，拒绝历史预期篡改和当前产品契约漂移', () => {
    for (const relative of ['tools/scripts', 'tools/fixtures/legacy-contracts', 'packages/page', 'contracts', 'metriccanvas-authoring']) {
      cpSync(path.join(root, relative), path.join(isolated, relative), {
        recursive: true,
        filter: (source) => !['node_modules', '__pycache__', '.venv', 'venv'].includes(path.basename(source))
      });
    }
    mkdirSync(path.join(isolated, 'docs'));
    for (const relative of ['docs/schema-metadata.schema.json', 'package.json', 'tsconfig.base.json']) {
      cpSync(path.join(root, relative), path.join(isolated, relative));
    }
    // 复用已安装工具和 page 的第三方依赖；旧 workspace 源码不复制。
    symlinkSync(path.join(root, 'node_modules'), path.join(isolated, 'node_modules'), 'dir');
    symlinkSync(path.join(root, 'packages/page/node_modules'), path.join(isolated, 'packages/page/node_modules'), 'dir');
    for (const relative of ['packages/server', 'apps', 'metriccanvas-page-assets']) {
      expect(existsSync(path.join(isolated, relative))).toBe(false);
    }
    const clean = check();
    expect(clean.stderr, clean.stderr).toBe('');
    expect(clean.status).toBe(0);
    expect(clean.stdout).toContain('authoring contract export current');

    withChangedFile('tools/fixtures/legacy-contracts/build-page-conformance.json', '{}\n', () => {
      const result = check();
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('Frozen legacy vector changed');
    });
    withChangedFile('contracts/metriccanvas/page/schema.json', '{}\n', () => {
      const result = check();
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('contracts/metriccanvas/page/schema.json');
    });
  }, 30_000);
});
