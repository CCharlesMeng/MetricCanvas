import { afterAll, describe, expect, it } from 'vitest';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const isolated = mkdtempSync(path.join(tmpdir(), 'metriccanvas-contract-export-'));
afterAll(() => rmSync(isolated, { recursive: true, force: true }));

function runExport(args = ['--check']) {
  return spawnSync(process.execPath, ['--import', 'tsx', 'tools/scripts/export-authoring-contracts.ts', ...args], {
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
    const clean = runExport();
    expect(clean.stderr, clean.stderr).toBe('');
    expect(clean.status).toBe(0);
    expect(clean.stdout).toContain('authoring contract export current');

    withChangedFile('tools/fixtures/legacy-contracts/build-page-conformance.json', '{}\n', () => {
      const result = runExport();
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('Frozen legacy vector changed');
    });
    withChangedFile('contracts/metriccanvas/page/schema.json', '{}\n', () => {
      const result = runExport();
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('contracts/metriccanvas/page/schema.json');
    });

    const pageManifest = JSON.parse(readFileSync(path.join(isolated, 'packages/page/package.json'), 'utf8'));
    const versionedFiles = [
      'contracts/metriccanvas/manifest.json',
      'metriccanvas-authoring/contract-snapshot/manifest.json',
      'metriccanvas-authoring/contract-lock.json'
    ];
    for (const file of versionedFiles) {
      const manifest = JSON.parse(readFileSync(path.join(isolated, file), 'utf8'));
      withChangedFile(file, JSON.stringify({ ...manifest, productContractVersion: '9.9.9' }), () => {
        const result = runExport();
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain(`${file}: productContractVersion=9.9.9; @metriccanvas/page version=${pageManifest.version}`);
      });
    }

    withChangedFile('packages/page/package.json', JSON.stringify({ ...pageManifest, version: '9.9.9' }), () => {
      const stale = runExport();
      expect(stale.status).not.toBe(0);
      expect(stale.stderr).toContain(`productContractVersion=${pageManifest.version}; @metriccanvas/page version=9.9.9`);
      const regenerated = runExport([]);
      expect(regenerated.stderr, regenerated.stderr).toBe('');
      expect(regenerated.status).toBe(0);
      for (const file of versionedFiles) {
        expect(JSON.parse(readFileSync(path.join(isolated, file), 'utf8')).productContractVersion).toBe('9.9.9');
      }
    });
  }, 30_000);
});
