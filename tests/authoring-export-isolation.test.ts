import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const isolated = mkdtempSync(path.join(tmpdir(), 'metriccanvas-contract-export-'));
// CI measured 36–38s for nine exports combined. Budget each independent scenario
// separately; keep the existing subprocess ceiling instead of widening all tests.
const scenarioTimeout = 30_000;
const versionedFiles = [
  'contracts/metriccanvas/manifest.json',
  'metriccanvas-authoring/contract-snapshot/manifest.json',
  'metriccanvas-authoring/contract-lock.json'
];
afterAll(() => rmSync(isolated, { recursive: true, force: true }));

function runExport(args = ['--check'], cwd = isolated) {
  return spawnSync(process.execPath, ['--import', 'tsx', 'tools/scripts/export-authoring-contracts.ts', ...args], {
    cwd, encoding: 'utf8', timeout: 30_000
  });
}

function withChangedFile(relative: string, content: string, verify: () => void, cwd = isolated) {
  const file = path.join(cwd, relative);
  const original = readFileSync(file);
  try {
    writeFileSync(file, content);
    verify();
  } finally {
    writeFileSync(file, original);
  }
}

describe.sequential('当前契约检查无需旧服务源码', () => {
  beforeAll(() => {
    for (const relative of ['tools/scripts', 'docs/page-metadata', 'tools/fixtures/legacy-contracts', 'packages/page', 'packages/engine/widgets/src/components/map-chart/maps/china.json', 'packages/engine/widgets/src/components/map-chart/maps/world.json', 'contracts', 'metriccanvas-authoring']) {
      mkdirSync(path.dirname(path.join(isolated, relative)), { recursive: true });
      cpSync(path.join(root, relative), path.join(isolated, relative), {
        recursive: true,
        filter: (source) => !['node_modules', '__pycache__', '.venv', 'venv'].includes(path.basename(source))
      });
    }
    const referenceMap = JSON.parse(readFileSync(path.join(root, 'docs/page-metadata/reference-map.json'), 'utf8')) as { modules: Record<string, { sources: string[] }> };
    for (const relative of new Set(Object.values(referenceMap.modules).flatMap(module => module.sources))) {
      mkdirSync(path.dirname(path.join(isolated, relative)), { recursive: true });
      cpSync(path.join(root, relative), path.join(isolated, relative));
    }
    mkdirSync(path.join(isolated, 'docs'), { recursive: true });
    for (const relative of ['docs/schema-metadata.schema.json', 'package.json', 'tsconfig.base.json']) {
      cpSync(path.join(root, relative), path.join(isolated, relative));
    }
    // 复用已安装工具和 page 的第三方依赖；旧 workspace 源码不复制。
    symlinkSync(path.join(root, 'node_modules'), path.join(isolated, 'node_modules'), 'dir');
    symlinkSync(path.join(root, 'packages/page/node_modules'), path.join(isolated, 'packages/page/node_modules'), 'dir');
  }, scenarioTimeout);

  it('无旧链时可运行', () => {
    for (const relative of ['packages/server', 'apps', 'metriccanvas-page-assets']) {
      expect(existsSync(path.join(isolated, relative))).toBe(false);
    }
    const clean = runExport();
    expect(clean.stderr, clean.stderr).toBe('');
    expect(clean.status).toBe(0);
    expect(clean.stdout).toContain('authoring contract export current');
  }, scenarioTimeout);

  it('拒绝冻结历史向量篡改', () => {
    withChangedFile('tools/fixtures/legacy-contracts/build-page-conformance.json', '{}\n', () => {
      const result = runExport();
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('Frozen legacy vector changed');
    });
  }, scenarioTimeout);

  it('拒绝参考手册作者漂移', () => {
    withChangedFile('docs/page-metadata/components/gauge.md', '# changed reference\n', () => {
      const result = runExport();
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('page/reference/components/gauge.md');
    });
  }, scenarioTimeout);

  it('拒绝产品页面 Schema 漂移', () => {
    withChangedFile('contracts/metriccanvas/page/schema.json', '{}\n', () => {
      const result = runExport();
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('contracts/metriccanvas/page/schema.json');
    });
  }, scenarioTimeout);

  it.each(versionedFiles)('拒绝产品版本漂移：%s', file => {
    const pageManifest = JSON.parse(readFileSync(path.join(isolated, 'packages/page/package.json'), 'utf8'));
    const manifest = JSON.parse(readFileSync(path.join(isolated, file), 'utf8'));
    withChangedFile(file, JSON.stringify({ ...manifest, productContractVersion: '9.9.9' }), () => {
      const result = runExport();
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(`${file}: productContractVersion=9.9.9; @metriccanvas/page version=${pageManifest.version}`);
    });
  }, scenarioTimeout);

  it.each(['platform-authoring.md', 'layouts/report.md', 'layouts/dashboard.md'])('拒绝共享 Skill 作者漂移：%s', file => {
    const relative = `metriccanvas-authoring/skill-shared/${file}`;
    withChangedFile(relative, readFileSync(path.join(isolated,relative),'utf8') + '\nchanged shared reference\n', () => {
      const result = runExport();
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(`skill/metriccanvas-platform-create/references/${file}`);
    });
  }, scenarioTimeout);

  it('拒绝缺少独立 Skill 投影', () => {
    const relative = 'metriccanvas-authoring/skill/metriccanvas-platform-edit/references/layouts/report.md';
    const file = path.join(isolated,relative);
    const original = readFileSync(file);
    try {
      rmSync(file);
      const result = runExport();
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('skill/metriccanvas-platform-edit/references/layouts/report.md');
    } finally { writeFileSync(file,original); }
  }, scenarioTimeout);

  it('拒绝重复 Skill 入口', () => {
    const relative = 'metriccanvas-authoring/bundle.json';
    const bundle = JSON.parse(readFileSync(path.join(isolated,relative),'utf8'));
    bundle.skills.push(bundle.skills[0]);
    withChangedFile(relative,JSON.stringify(bundle),()=>{
      const result = runExport();
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('Invalid or duplicate Skill entry');
    });
  }, scenarioTimeout);

  it('旧单入口配置仍可导出且不改旧 Skill 主文', () => {
    const legacyRoot = mkdtempSync(path.join(tmpdir(),'metriccanvas-legacy-skill-'));
    try {
      cpSync(isolated,legacyRoot,{recursive:true,verbatimSymlinks:true});
      const manifest = path.join(legacyRoot,'metriccanvas-authoring/bundle.json');
      const bundle = JSON.parse(readFileSync(manifest,'utf8'));
      delete bundle.skills;
      writeFileSync(manifest,JSON.stringify(bundle));
      const entrypoint = path.join(legacyRoot,'metriccanvas-authoring',bundle.skill.entrypoint);
      const original = readFileSync(entrypoint,'utf8');
      const generated = runExport([],legacyRoot);
      expect(generated.status,generated.stderr).toBe(0);
      const checked = runExport(['--check'],legacyRoot);
      expect(checked.status,checked.stderr).toBe(0);
      expect(checked.stdout).toContain('authoring contract export current');
      expect(readFileSync(entrypoint,'utf8')).toBe(original);
    } finally { rmSync(legacyRoot,{recursive:true,force:true}); }
  }, scenarioTimeout);

  it('包版本变更后拒绝旧导出并可重新生成', () => {
    // Regeneration rewrites multiple projections. Give this mutating scenario its
    // own copy so ordering/shuffling cannot contaminate other drift assertions.
    const regenerationRoot = mkdtempSync(path.join(tmpdir(), 'metriccanvas-contract-regeneration-'));
    try {
      cpSync(isolated, regenerationRoot, { recursive: true, verbatimSymlinks: true });
      const pageManifest = JSON.parse(readFileSync(path.join(regenerationRoot, 'packages/page/package.json'), 'utf8'));
      withChangedFile('packages/page/package.json', JSON.stringify({ ...pageManifest, version: '9.9.9' }), () => {
        const stale = runExport(['--check'], regenerationRoot);
        expect(stale.status).not.toBe(0);
        expect(stale.stderr).toContain(`productContractVersion=${pageManifest.version}; @metriccanvas/page version=9.9.9`);
        const regenerated = runExport([], regenerationRoot);
        expect(regenerated.stderr, regenerated.stderr).toBe('');
        expect(regenerated.status).toBe(0);
        for (const file of versionedFiles) {
          expect(JSON.parse(readFileSync(path.join(regenerationRoot, file), 'utf8')).productContractVersion).toBe('9.9.9');
        }
      }, regenerationRoot);
    } finally {
      rmSync(regenerationRoot, { recursive: true, force: true });
    }
  }, scenarioTimeout);
});
