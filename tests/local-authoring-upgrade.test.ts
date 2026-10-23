import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { upgradePageDocument } from '../packages/page/src/upgrade-document';
import { parsePage } from '../packages/page/src/validate';
import { canonicalizeJson } from '../packages/page/src/canonical-json';
import { versionPolicy } from '../packages/page/src/version';
import { walkDocumentComponents } from '../packages/page/src/component-walk';

const fixture = (name: string) => JSON.parse(readFileSync(`tools/fixtures/local-authoring-upgrade/${name}.json`, 'utf8'));
const base = () => fixture('schema-upgrade-demo');

describe('旧页面的显式创作期升级', () => {
  it('Playground 文件来自同一旧页面，升级后仅继续修改要求的标题', () => {
    const result = upgradePageDocument(base());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    result.document.meta = { ...result.document.meta, title: '已升级：继续开发旧页面' };
    const card = result.document.sections[0]!.components[0]!;
    if (card.type === 'metricCard') card.props.title = '继续开发：GMV';
    const demo = JSON.parse(readFileSync('pages/capabilities/layout/schema-upgrade-demo.json', 'utf8'));
    expect(demo).toEqual(result.document);
    expect(parsePage(demo).ok).toBe(true);
  });

  it('同步最新协议后完整保留对象查询，不将新能力伪装成旧版本', () => {
    const input = JSON.parse(readFileSync('packages/page/fixtures/contract-valid/object-query-page.json', 'utf8'));
    const result = upgradePageDocument(input);
    expect(result.ok, JSON.stringify(result.errors)).toBe(true);
    if (!result.ok) return;
    expect(result.document.dataSources).toEqual(input.dataSources);
    expect(parsePage(result.document).ok).toBe(true);
    expect(upgradePageDocument({ ...input, schemaVersion: '6.51' }).ok).toBe(false);
  });
  it.each(['5.0', '5.1', '5.2', '5.3', '5.4', ...Array.from({ length: versionPolicy.minor + 1 }, (_, minor) => `6.${minor}`)])('%s 保留数据、绑定、形态和源文件，结果可继续开发', schemaVersion => {
    const input = { ...base(), schemaVersion };
    const before = canonicalizeJson(input);
    const result = upgradePageDocument(input);
    expect(result.ok, JSON.stringify(result.errors)).toBe(true);
    if (!result.ok) return;
    expect(result.document.schemaVersion).toBe(versionPolicy.current);
    expect(result.document.layout).toBe('dashboard');
    expect(result.document).not.toHaveProperty('layoutForm');
    expect(result.document.dataSources).toEqual(input.dataSources);
    expect(result.document.sections).toEqual(input.sections);
    expect(canonicalizeJson(input)).toBe(before);
    result.document.meta = { title: '升级后继续修改标题' };
    expect(parsePage(result.document).ok).toBe(true);
    const repeated = upgradePageDocument(result.document);
    expect(repeated).toMatchObject({ ok: true, changed: false, changes: [] });
  });

  it.each(['4.0', '5.5', '7.0', '6.01', '6.0.1', `6.${versionPolicy.minor + 1}`, undefined])('未知或未来版本 %s 明确拒绝', schemaVersion => {
    const result = upgradePageDocument({ ...base(), schemaVersion });
    expect(result).toMatchObject({ ok: false, errors: [expect.objectContaining({ path: '/schemaVersion' })] });
    expect(result).not.toHaveProperty('document');
  });

  it('检查原始能力下限，不用新版版本号掩盖错误；不支持降级', () => {
    const input = base();
    input.sections[0].components[0].layout.before = { text: '=' };
    expect(upgradePageDocument(input)).toMatchObject({ ok: false, errors: [expect.objectContaining({ path: expect.stringContaining('/layout/before') })] });
    expect(upgradePageDocument(base(), '6.44').ok).toBe(false);
  });

  it('非法属性、双布局和不完整查询仍被拒绝，不写出半成品', () => {
    for (const input of [{ ...base(), layout: 'dashboard' }, { ...base(), invented: true }, { ...base(), dataSources: {} }]) {
      const before = canonicalizeJson(input);
      const result = upgradePageDocument(input);
      expect(result.ok).toBe(false);
      expect(result).not.toHaveProperty('document');
      expect(canonicalizeJson(input)).toBe(before);
    }
  });

  it('5.x 导航沿用既有只读转换，保持行字段传参', () => {
    const input = { ...base(), schemaVersion: '5.4' };
    input.sections[0].components[0].props.actions = [{ on: 'click', navigate: { page: 'detail', setParams: { amount: 'gmv' } } }];
    const result = upgradePageDocument(input);
    expect(result.ok, JSON.stringify(result.errors)).toBe(true);
    if (!result.ok) return;
    expect(result.document.sections[0]!.components[0]).toMatchObject({ props: { actions: [{ navigate: { href: '/pages/detail', query: { amount: { source: 'row', field: 'gmv' } } } }] } });
    expect(input.sections[0].components[0].props.actions[0].navigate.page).toBe('detail');
  });

  it('迁移四类图表筛选，保留身份、查询、默认值和容器跨度', () => {
    const input = fixture('chart-filter');
    const before = canonicalizeJson(input);
    const result = upgradePageDocument(input);
    expect(result.ok, JSON.stringify(result.errors)).toBe(true);
    if (!result.ok) return;
    expect(result.document.filters).toEqual(input.filters);
    expect(result.document.dataSources).toEqual(input.dataSources);
    expect(result.changes.filter(change => change.rule === 'chart-filter')).toHaveLength(4);
    const originals = new Map<string, unknown>();
    walkDocumentComponents(result.document, component => originals.set(String(component.id), component));
    for (const component of input.sections[0].components.slice(0, 4)) {
      const { filter, ...props } = component.props;
      expect(originals.get(component.id)).toMatchObject({ id: component.id, props, layout: { span: 12 } });
      expect(originals.get(`${component.id}-group`)).toMatchObject({ layout: component.layout });
      expect(originals.get(`${component.id}-filter`)).toMatchObject({ props: filter });
    }
    expect(parsePage(input).ok).toBe(false);
    expect(canonicalizeJson(input)).toBe(before);
    expect(upgradePageDocument(result.document)).toMatchObject({ ok: true, changed: false });
  });

  it('嵌套组合卡、无效筛选和额外图表属性不会被静默丢弃', () => {
    const nested = fixture('chart-filter');
    nested.schemaVersion = versionPolicy.current;
    const chart = nested.sections[0].components[0];
    nested.sections[0].components = [{ id: 'existing-card', type: 'compositeCard', layout: { span: 12 }, props: { components: [chart] } }];
    expect(upgradePageDocument(nested)).toMatchObject({ ok: false, errors: [expect.objectContaining({ path: expect.stringContaining('/props/filter') })] });
    const invalid = fixture('chart-filter');
    invalid.sections[0].components[0].props.filter.unknown = true;
    expect(upgradePageDocument(invalid).ok).toBe(false);
    const unknown = fixture('chart-filter');
    unknown.sections[0].components[0].unknown = true;
    expect(upgradePageDocument(unknown).ok).toBe(false);
  });

  it('生成组件 id 避开已有身份，保留显隐条件', () => {
    const input = fixture('chart-filter');
    const chart = input.sections[0].components[0];
    chart.visibleWhen = { filter: input.filters[0].id, part: 'values', op: 'containsAny', values: ['CN'] };
    input.sections[0].components.push({ id: `${chart.id}-filter`, type: 'text', layout: { span: 12 }, props: { body: '保留' } });
    const result = upgradePageDocument(input);
    expect(result.ok, JSON.stringify(result.errors)).toBe(true);
    if (!result.ok) return;
    expect(result.document.sections[0]!.components[0]).toMatchObject({ visibleWhen: chart.visibleWhen, props: { components: expect.arrayContaining([expect.objectContaining({ id: `${chart.id}-filter-1` })]) } });
  });

  it.each(['6.5', '6.6'])('%s 的数组参数以具体诊断阻止语义变化', schemaVersion => {
    expect(upgradePageDocument({ ...base(), schemaVersion, params: [{ id: 'title', type: 'string', value: '原值' }] }))
      .toMatchObject({ ok: false, errors: [expect.objectContaining({ path: '/params' })] });
  });

  it('升级语义缺口不阻止仍合法的旧页面继续修改标题', () => {
    const input = { ...base(), schemaVersion: '6.5', params: [{ id: 'caption', type: 'string', value: '原固定文字' }] };
    input.sections[0].components[0].props.title = { param: 'caption' };
    expect(parsePage(input).ok).toBe(true);
    expect(upgradePageDocument(input)).toMatchObject({ ok: false, errors: [expect.objectContaining({ path: '/params' })] });
    input.meta.title = '沿用旧版本继续开发';
    expect(parsePage(input).ok).toBe(true);
    expect(input.schemaVersion).toBe('6.5');
    expect(input.params).toEqual([{ id: 'caption', type: 'string', value: '原固定文字' }]);
  });

  it.each(['6.13', '6.14'])('%s 的页头期间联动保留原件并报告缺口', schemaVersion => {
    const input = { ...base(), schemaVersion };
    input.sections[0].components.push({ id: 'header', type: 'reportHeader', layout: { span: 12 }, props: { title: '标题', filterIds: ['period'] } });
    expect(upgradePageDocument(input)).toMatchObject({ ok: false, errors: [expect.objectContaining({ path: '/sections/0/components/2/props/filterIds' })] });
  });
});

describe('仓外安装升级工具', () => {
  let folder: string;
  beforeAll(async () => {
    folder = await mkdtemp(path.join(tmpdir(), 'mc-page-upgrade-'));
    await cp('metriccanvas-authoring/skill/metriccanvas-local-authoring', path.join(folder, 'skill'), { recursive: true });
  });
  afterAll(async () => { await rm(folder, { recursive: true, force: true }); });
  const run = (args: string[]) => spawnSync(process.execPath, [path.join(folder, 'skill/scripts/upgrade-page.mjs'), ...args], { cwd: folder, encoding: 'utf8', env: { PATH: process.env.PATH }, timeout: 10000 });

  it('检查不写文件；写出保留精确原始字节、哈希、报告，校验后可继续开发', async () => {
    const source = path.join(folder, 'schema-upgrade-demo.json');
    const bytes = Buffer.from('\n' + JSON.stringify(base(), null, 4) + '\n');
    await writeFile(source, bytes);
    const entries = await readdir(folder);
    const dryRun = run([source]);
    expect(dryRun.status, dryRun.stderr).toBe(0);
    expect(JSON.parse(dryRun.stdout)).toMatchObject({ ok: true, status: 'ready' });
    expect(await readdir(folder)).toEqual(entries);
    const output = path.join(folder, 'attempt-1');
    const migrated = run([source, '--out-dir', output]);
    expect(migrated.status, migrated.stderr).toBe(0);
    expect(await readFile(source)).toEqual(bytes);
    expect(await readFile(path.join(output, 'original/schema-upgrade-demo.json'))).toEqual(bytes);
    const report = JSON.parse(await readFile(path.join(output, 'migration.json'), 'utf8'));
    expect(report.inputSha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    const document = JSON.parse(await readFile(report.output, 'utf8'));
    document.meta.title = '继续开发成功';
    await writeFile(report.output, JSON.stringify(document));
    const validation = spawnSync(process.execPath, [path.join(folder, 'skill/scripts/validate-page.mjs'), report.output], { cwd: folder, encoding: 'utf8' });
    expect(validation.status, validation.stderr).toBe(0);
    expect(run([source, '--out-dir', output]).status).toBe(2);
    expect(await readFile(path.join(output, 'original/schema-upgrade-demo.json'))).toEqual(bytes);
  });

  it('未来版本、非法 JSON、错误参数不产生迁移目录或改写输入', async () => {
    const source = path.join(folder, 'bad.json');
    const output = path.join(folder, 'must-not-exist');
    await writeFile(source, JSON.stringify({ ...base(), schemaVersion: '7.0' }));
    expect(run([source, '--out-dir', output]).status).toBe(1);
    expect(await readdir(folder)).not.toContain('must-not-exist');
    await writeFile(source, '{invalid');
    expect(run([source, '--out-dir', output]).status).toBe(2);
    expect(await readFile(source, 'utf8')).toBe('{invalid');
    expect(run([source, '--target']).status).toBe(2);
    expect(run([source, '--out-dir', 'x', '--out-dir', 'y']).status).toBe(2);
    expect(run(['--help']).status).toBe(0);
    expect(JSON.parse(run(['--version']).stdout).schemaVersion).toBe(versionPolicy.current);
  });
});
