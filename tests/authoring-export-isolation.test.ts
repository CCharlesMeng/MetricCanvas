import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const isolated = mkdtempSync(path.join(tmpdir(), 'metriccanvas-contract-export-'));
// Cold CI generation now builds the complete MC package and registered tool graph.
// Scope this build deadline here; page checking and migration budgets are separate.
const scenarioTimeout = 90_000;
const versionedFiles = [
  'contracts/metriccanvas/manifest.json',
  'metriccanvas-authoring/contract-snapshot/manifest.json',
  'metriccanvas-authoring/contract-lock.json'
];
afterAll(() => rmSync(isolated, { recursive: true, force: true }));

function runExport(args = ['--check'], cwd = isolated) {
  return spawnSync(process.execPath, ['--import', 'tsx', 'tools/scripts/export-authoring-contracts.ts', ...args], {
    cwd, encoding: 'utf8', timeout: scenarioTimeout
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
    for (const relative of ['tools/scripts', 'tools/mc-content', 'docs/page-metadata', 'pages', 'service', 'tools/fixtures/legacy-contracts', 'packages/page', 'packages/engine/widgets/src/components/map-chart/maps/china.json', 'packages/engine/widgets/src/components/map-chart/maps/world.json', 'contracts', 'metriccanvas-authoring']) {
      mkdirSync(path.dirname(path.join(isolated, relative)), { recursive: true });
      cpSync(path.join(root, relative), path.join(isolated, relative), {
        recursive: true,
        filter: (source) => !['node_modules', '__pycache__', '.venv', 'venv', 'local-runs'].includes(path.basename(source))
      });
    }
    const referenceMap = JSON.parse(readFileSync(path.join(root, 'docs/page-metadata/reference-map.json'), 'utf8')) as { modules: Record<string, { sources: string[] }> };
    for (const relative of new Set(Object.values(referenceMap.modules).flatMap(module => module.sources))) {
      mkdirSync(path.dirname(path.join(isolated, relative)), { recursive: true });
      cpSync(path.join(root, relative), path.join(isolated, relative));
    }
    mkdirSync(path.join(isolated, 'docs'), { recursive: true });
    for (const relative of ['docs/schema-metadata.schema.json', 'docs/schema-metadata.md', 'docs/examples/schema-metadata.example.json', 'pnpm-lock.yaml', 'package.json', 'tsconfig.base.json']) {
      mkdirSync(path.dirname(path.join(isolated, relative)), {recursive: true});
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

  it('本地模型评估产物不影响交付锁', () => {
    const localRun = path.join(isolated, 'metriccanvas-authoring/test-harness/model-evals/local-runs/lock-regression');
    mkdirSync(localRun, { recursive: true });
    try {
      writeFileSync(path.join(localRun, 'report.json'), '{"local":true}\n');
      const checked = runExport();
      expect(checked.status, checked.stderr).toBe(0);
    } finally { rmSync(localRun, { recursive: true, force: true }); }
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

  it.each(['tools.md', 'layouts/report.md', 'layouts/dashboard.md'])('拒绝共享 Skill 作者漂移：%s', file => {
    const relative = `metriccanvas-authoring/skill/metriccanvas-platform-authoring/references/${file}`;
    withChangedFile(relative, readFileSync(path.join(isolated,relative),'utf8') + '\nchanged shared reference\n', () => {
      const result = runExport();
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('bundle.lock.json: stale');
    });
  }, scenarioTimeout);

  it('拒绝缺少独立 Skill 投影', () => {
    const relative = 'metriccanvas-authoring/skill/metriccanvas-platform-authoring/references/layouts/report.md';
    const file = path.join(isolated,relative);
    const original = readFileSync(file);
    try {
      rmSync(file);
      const result = runExport();
      expect(result.status).not.toBe(0);
      // The target workflow no longer directly links this retained projection; the bundle inventory still guards it.
      expect(result.stderr).toContain('bundle.lock.json: stale');
    } finally { writeFileSync(file,original); }
  }, scenarioTimeout);

  it.each(['references/page-metadata/schema.json', 'references/knowledge.json', 'references/page-patterns/dashboard-detail.json', 'scripts/validate-page.mjs', 'references/authoring-knowledge/model.json', 'scripts/read-knowledge.mjs', 'scripts/analyze-data.mjs', 'scripts/upgrade-page.mjs'])('拒绝独立本地 Skill 生成内容漂移：%s', file => {
    const relative = `metriccanvas-authoring/skill/metriccanvas-local-authoring/${file}`;
    withChangedFile(relative, readFileSync(path.join(isolated,relative),'utf8') + '\nchanged generated content\n', () => {
      const result = runExport();
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(`skill/metriccanvas-local-authoring/${file}`);
    });
  }, scenarioTimeout);

  it('生成器保留作者参考且只清理生成子树', () => {
    const folder = mkdtempSync(path.join(tmpdir(), 'metriccanvas-ownership-'));
    try {
      cpSync(isolated, folder, {recursive:true, verbatimSymlinks:true});
      const authored = path.join(folder, 'metriccanvas-authoring/skill/metriccanvas-platform-authoring/references/private.md');
      writeFileSync(authored, '# Authored extension\n');
      const localAuthored = path.join(folder, 'metriccanvas-authoring/skill/metriccanvas-local-authoring/references/local-workflow.md');
      const localOriginal = readFileSync(localAuthored, 'utf8');
      writeFileSync(localAuthored, localOriginal + '\nLocal authored extension\n');
      const stale = path.join(folder, 'metriccanvas-authoring/skill/metriccanvas-page-builder/references/page-metadata/stale.md');
      writeFileSync(stale, '# Stale projection\n');
      const staleTopic = path.join(folder, 'metriccanvas-authoring/skill/metriccanvas-local-authoring/references/authoring-knowledge/stale.json');
      writeFileSync(staleTopic, '{}\n');
      const result = runExport([], folder);
      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(authored, 'utf8')).toBe('# Authored extension\n');
      expect(readFileSync(localAuthored, 'utf8')).toBe(localOriginal + '\nLocal authored extension\n');
      expect(existsSync(stale)).toBe(false);
      expect(existsSync(staleTopic)).toBe(false);
      expect(runExport(['--check'], folder).status).toBe(0);
    } finally { rmSync(folder, {recursive:true, force:true}); }
    // A fresh copy plus generation and a separate check need two scenario budgets;
    // each subprocess still has its own unchanged 30s ceiling.
  }, scenarioTimeout * 2);

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

  it('Schema 升级后整包重新生成，旧页面保留且可另目录迁移', () => {
    const folder = mkdtempSync(path.join(tmpdir(), 'metriccanvas-schema-release-'));
    try {
      cpSync(isolated, folder, { recursive: true, verbatimSymlinks: true });
      const policyFile = path.join(folder, 'packages/page/src/version.ts');
      const policy = readFileSync(policyFile, 'utf8');
      const match = /const CURRENT_MINOR = (\d+);/.exec(policy)!;
      const manifestFile = path.join(folder, 'metriccanvas-authoring/mc-content/mc-content.version.json');
      const previous = JSON.parse(readFileSync(manifestFile, 'utf8'));
      const expected = previous.alignedWith.pageSchemaVersion.split('.')[0] + '.' + (Number(match[1]) + 1);
      const oldFile = path.join(folder, 'pages/capabilities/layout/mc-layout-business-report.json');
      const bytes = readFileSync(oldFile);
      writeFileSync(policyFile, policy.replace(match[0], `const CURRENT_MINOR = ${Number(match[1]) + 1};`));
      // A real schema release also supplies the new version's product semantics.
      const referenceFile = path.join(folder, 'docs/page-metadata/reference-map.json');
      const reference = JSON.parse(readFileSync(referenceFile, 'utf8'));
      reference.enumNotes[expected] = '仅用于隔离回归的增量版本，不修改主工作树。';
      writeFileSync(referenceFile, JSON.stringify(reference));
      const generated = runExport([], folder);
      expect(generated.status, generated.stderr).toBe(0);
      const current = JSON.parse(readFileSync(manifestFile, 'utf8'));
      expect(current.alignedWith.pageSchemaVersion).toBe(expected);
      expect(current.contentSha256).not.toBe(previous.contentSha256);
      const scripts = path.join(folder, 'metriccanvas-authoring/mc-content/scripts');
      const inspected = spawnSync(process.execPath, [path.join(scripts, 'inspect-page.mjs'), oldFile], { cwd: tmpdir(), encoding: 'utf8' });
      expect(inspected.status, inspected.stderr).toBe(0);
      expect(JSON.parse(inspected.stdout)).toMatchObject({ readable: true, targetVersion: expected, upgrade: { possible: true } });
      const destination = path.join(folder, 'new-migration');
      const migrated = spawnSync(process.execPath, [path.join(scripts, 'upgrade-page.mjs'), oldFile, '--out-dir', destination], { cwd: tmpdir(), encoding: 'utf8' });
      expect(migrated.status, migrated.stdout).toBe(0);
      expect(readFileSync(oldFile)).toEqual(bytes);
      expect(readFileSync(path.join(destination, 'original/mc-layout-business-report.json'))).toEqual(bytes);
      expect(JSON.parse(readFileSync(path.join(destination, 'page/mc-layout-business-report.json'), 'utf8')).schemaVersion).toBe(expected);
    } finally { rmSync(folder, { recursive: true, force: true }); }
  }, scenarioTimeout * 2);

  it('MC 事实只维护一处，同时生成内容包和兼容参考', () => {
    const folder = mkdtempSync(path.join(tmpdir(), 'metriccanvas-content-source-'));
    try {
      cpSync(isolated, folder, { recursive: true, verbatimSymlinks: true });
      const source = path.join(folder, 'tools/mc-content/runtime/tool-behavior.md');
      const marker = '\nMC single-source projection acceptance.\n';
      writeFileSync(source, readFileSync(source, 'utf8') + marker);
      const generated = runExport([], folder);
      expect(generated.status, generated.stderr).toBe(0);
      expect(readFileSync(path.join(folder, 'metriccanvas-authoring/mc-content/runtime/tool-behavior.md'), 'utf8')).toContain(marker);
      expect(readFileSync(path.join(folder, 'metriccanvas-authoring/skill/metriccanvas-platform-authoring/references/tools.md'), 'utf8')).toContain(marker);
    } finally { rmSync(folder, { recursive: true, force: true }); }
  }, scenarioTimeout);

  it('包版本变更后拒绝旧导出并可重新生成', () => {
    // Two separately bounded exports and a fresh copy need a combined scenario budget.
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
  }, scenarioTimeout * 2);

  it('产品新增字段/枚举但无语义说明时生成失败，写出前不破坏已有 MC', () => {
    const folder = mkdtempSync(path.join(tmpdir(), 'metriccanvas-source-gap-'));
    try {
      cpSync(isolated, folder, {recursive: true, verbatimSymlinks: true});
      const source = path.join(folder, 'packages/page/src/schema/page.ts');
      const before = readFileSync(path.join(folder, 'metriccanvas-authoring/mc-content/mc-content.version.json'));
      writeFileSync(source, readFileSync(source, 'utf8').replace('description: z.string().optional()', "description: z.string().optional(), mcProbe: z.enum(['unmapped-a', 'unmapped-b']).optional()"));
      const result = runExport([], folder);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/semantic|coverage|Unmapped|Missing/i);
      expect(readFileSync(path.join(folder, 'metriccanvas-authoring/mc-content/mc-content.version.json'))).toEqual(before);
    } finally { rmSync(folder, {recursive: true, force: true}); }
  }, scenarioTimeout);

  it('结构不变的语义修复使旧 MC 失效，重新生成后同源主题更新', () => {
    const folder = mkdtempSync(path.join(tmpdir(), 'metriccanvas-semantic-change-'));
    try {
      cpSync(isolated, folder, {recursive: true, verbatimSymlinks: true});
      const source = path.join(folder, 'docs/page-metadata/components/table.md');
      const marker = 'MC semantic-only source mutation.';
      writeFileSync(source, readFileSync(source, 'utf8').replace(/(# .+\n)/, '$1\n' + marker + '\n'));
      expect(runExport(['--check'], folder).status).not.toBe(0);
      expect(runExport([], folder).status).toBe(0);
      expect(readFileSync(path.join(folder, 'metriccanvas-authoring/mc-content/knowledge/table.overview.json'), 'utf8')).toContain(marker);
    } finally { rmSync(folder, {recursive: true, force: true}); }
  }, scenarioTimeout * 2);

  it('活动 query 工具参数变动进入完整 inputSchema，内部 Adapter 不改变公共 MC', () => {
    const folder = mkdtempSync(path.join(tmpdir(), 'metriccanvas-registration-change-'));
    try {
      cpSync(isolated, folder, {recursive: true, verbatimSymlinks: true});
      const internal = path.join(folder, 'metriccanvas-authoring/tool/metriccanvas_authoring/adapters/mc_probe.py');
      writeFileSync(internal, 'raise RuntimeError("PRIVATE_MC_PROBE_ERROR")\n');
      expect(runExport(['--check'], folder).status).toBe(0);
      const source = path.join(folder, 'metriccanvas-authoring/tool/metriccanvas_authoring/entrypoints/mcp/platform_mcp.py');
      writeFileSync(source, readFileSync(source, 'utf8').replace('result_ref: str | None = None) -> ToolResult:', 'result_ref: str | None = None, mc_probe: bool = False) -> ToolResult:'));
      expect(runExport([], folder).status).toBe(0);
      const tool = JSON.parse(readFileSync(path.join(folder, 'metriccanvas-authoring/mc-content/tool-contracts/query_data.json'), 'utf8'));
      expect(tool.inputSchema.properties.mc_probe).toMatchObject({type: 'boolean', default: false});
    } finally { rmSync(folder, {recursive: true, force: true}); }
  }, scenarioTimeout * 2);


  it('隔离新 minor 加入真实字段语义后，旧页检查与迁移均保留原件', () => {
    const folder = mkdtempSync(path.join(tmpdir(), 'metriccanvas-semantic-release-'));
    try {
      cpSync(isolated, folder, {recursive: true, verbatimSymlinks: true});
      const policyFile = path.join(folder, 'packages/page/src/version.ts');
      const policy = readFileSync(policyFile, 'utf8');
      const match = /const CURRENT_MINOR = (\d+);/.exec(policy)!;
      writeFileSync(policyFile, policy.replace(match[0], `const CURRENT_MINOR = ${Number(match[1]) + 1};`));
      const schemaFile = path.join(folder, 'packages/page/src/schema/page.ts');
      // A real optional protocol field with semantic metadata, not just a version string.
      writeFileSync(schemaFile, readFileSync(schemaFile, 'utf8').replace('description: z.string().optional()', "description: z.string().optional(), mcReleaseNote: z.string().optional().describe('隔离发布验收：可选迁移说明，不改变旧页显示')"));
      const referenceFile = path.join(folder, 'docs/page-metadata/reference-map.json');
      const reference = JSON.parse(readFileSync(referenceFile, 'utf8'));
      reference.fieldNotes.mcReleaseNote = '隔离发布验收：可选迁移说明，不改变旧页显示';
      reference.enumNotes[`6.${Number(match[1]) + 1}`] = '隔离真实语义增量发布';
      writeFileSync(referenceFile, JSON.stringify(reference));
      const generated = runExport([], folder);
      expect(generated.status, generated.stderr).toBe(0);
      const scripts = path.join(folder, 'metriccanvas-authoring/mc-content/scripts');
      const input = path.join(folder, 'pages/capabilities/layout/mc-layout-business-report.json');
      const before = readFileSync(input);
      const report = spawnSync(process.execPath, [path.join(scripts, 'inspect-page.mjs'), input], {encoding: 'utf8'});
      expect(JSON.parse(report.stdout)).toMatchObject({readable: true, upgrade: {possible: true}});
      const migrated = spawnSync(process.execPath, [path.join(scripts, 'upgrade-page.mjs'), input, '--out-dir', path.join(folder, 'upgraded')], {encoding: 'utf8'});
      expect(migrated.status, migrated.stdout).toBe(0);
      expect(readFileSync(input)).toEqual(before);
      const output = JSON.parse(migrated.stdout).output;
      const document = JSON.parse(readFileSync(output, 'utf8'));
      document.meta = {...document.meta, mcReleaseNote: '真实新增字段'};
      writeFileSync(output, JSON.stringify(document));
      expect(JSON.parse(spawnSync(process.execPath, [path.join(scripts, 'inspect-page.mjs'), output], {encoding: 'utf8'}).stdout).readable).toBe(true);
    } finally { rmSync(folder, {recursive: true, force: true}); }
  }, scenarioTimeout * 2);

});
