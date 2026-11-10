import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

type Json = Record<string, any>;
interface Scenario {
  name: string; page: string; discover: string; owner: string; component: string; at?: string; rootAt?: string;
  expected: unknown; semantic: string; title: string;
}
const scenarios: Scenario[] = [
  { name: '数值精度', page: 'number-precision-five', discover: '最多五位', owner: 'table', component: 'precision-table',
    at: '/props/columns/5/field', expected: { data: 'main', field: 'plain5', format: 'number-5' },
    semantic: '五位', title: '带符号普通数值（6.17起）' },
  { name: '百分比与原值', page: 'authoring-percent-coverage', discover: '百分比 覆盖', owner: 'table', component: 'rate-table',
    at: '/props/columns/3/field', expected: { data: 'main', field: 'explicit', format: 'percent-1' },
    semantic: '百分比创作', title: '百分比创作与覆盖边界' },
  { name: '季度选择与查询', page: 'period-filter-quarter-page', discover: 'period-filter-quarter-page', owner: 'table', component: 'sales-table',
    rootAt: '/filters/0/default', expected: { mode: 'quarter', value: '2026-Q4' },
    semantic: '期间选择', title: '期间选择与查询消费' },
  { name: '跨页导航目标输入', page: 'navigation-detail-page', discover: 'IOC B5', owner: 'text', component: 'default-list',
    at: '/props/links/0', expected: { label: '使用默认条件重新打开清单', href: '/pages/ioc-header-navigation-list-demo?origin=详情入口', validateTargetInputs: true },
    semantic: '链接传参', title: '链接传参与目标页签' },
  { name: 'IOC页头布局归属', page: 'ioc-header-models', discover: '模型 时间范围', owner: 'iocHeader', component: 'page-header',
    at: '/props/presentation', expected: { layout: 'inline', collapse: 'none' },
    semantic: '公共页头', title: 'IOC 公共页头（6.36）' },
  { name: '组合卡内独立筛选图表', page: 'chart-local-filter-page', discover: '图表独立筛选', owner: 'barChart', component: 'orders',
    at: '/data', expected: { main: 'orders-data' },
    semantic: '独立筛选', title: '独立筛选按钮组' },
  { name: '多查询关联与筛选豁免', page: 'record-join-query-page', discover: '审批记录 按需分页', owner: 'table', component: 'rejection-details-table',
    rootAt: '/dataSources/rejection-overview/source/members/basic/notApplicableFilters/0', expected: 'mtime',
    semantic: '审批记录', title: '审批记录与当前信息补列（6.66）' },
  { name: '异字段合并成员复合行键', page: 'paged-union-composite-key', discover: '异字段映射', owner: 'table', component: 'opinions-table',
    rootAt: '/dataSources/opinions/source/members/commercial/rowKeyFields/1', expected: 'commercial-office',
    semantic: '成员行键', title: '分页合并成员行键策略（6.73）' },
  { name: '独立详情视图组件槽', page: 'detail-views', discover: '详情视图 验收', owner: 'table', component: 'detail-table',
    at: '/props/pagination', expected: { mode: 'local', pageSize: 10 },
    semantic: 'detailViews', title: 'IOC 页头进入分区（6.81）' }
];
const install = mkdtempSync(path.join(tmpdir(), 'authoring-consumption-matrix-'));
const skill = path.join(install, 'skill');
const telemetry = new Map<string, { calls: number; bytes: number; max: number }>();
let model: Json;

function execute(name: string, args: string[]) {
  const result = spawnSync(process.execPath, [path.join(skill, 'scripts/read-knowledge.mjs'), ...args], {
    cwd: install, encoding: 'utf8', timeout: 15_000, env: { PATH: process.env.PATH }
  });
  const bytes = Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr);
  const prior = telemetry.get(name) ?? { calls: 0, bytes: 0, max: 0 };
  telemetry.set(name, { calls: prior.calls + 1, bytes: prior.bytes + bytes, max: Math.max(prior.max, bytes) });
  return result;
}
function read(name: string, args: string[]): Json {
  const result = execute(name, args);
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toBe('');
  expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(args[0] === 'find' ? 1024 : 2048);
  expect(result.stdout).not.toMatch(/PRIVATE_SCENARIO_ROW|PRIVATE_SCENARIO_QUERY|dsl_list|output_fields/u);
  return JSON.parse(result.stdout);
}
function pages(name: string, args: string[]): Json[] {
  const results: Json[] = [];
  let cursor: string | undefined;
  do {
    const result = read(name, [...args, ...(cursor ? ['--cursor', cursor] : [])]);
    results.push(result);
    cursor = result.next;
    expect(results.length).toBeLessThan(100);
  } while (cursor);
  expect(results.at(-1)!.complete).toBe(true);
  return results;
}
function exampleFile(id: string): string {
  return path.join(skill, 'references/page-metadata/examples', id + '.json');
}
function semanticText(id: string): string {
  const [, module, section] = id.split(':');
  return model.modules[module!].semantics[Number(section)];
}
function readWholeSemantic(name: string, id: string): void {
  const responses = pages(name, ['show', '--id', id, '--select', 'text']);
  const actual = responses.flatMap(response => response.items).map(item => item.text).join('');
  expect(actual).toBe(semanticText(id));
}
function scenarioSemantic(scenario: Scenario, id: string): void {
  const found = read(scenario.name, ['find', '--kind', 'semantic', '--example', id, '--query', scenario.semantic]);
  const selected = found.items.find((item: Json) => item.title === scenario.title);
  expect(selected, scenario.title).toBeDefined();
  expect(found.scope).toContain('module-level');
  readWholeSemantic(scenario.name, selected.id);
}

beforeAll(() => {
  cpSync('metriccanvas-authoring/skill/metriccanvas-local-authoring', skill, { recursive: true });
  const envelope = JSON.parse(readFileSync(path.join(skill, 'references/authoring-knowledge/model.json'), 'utf8'));
  model = JSON.parse(gunzipSync(Buffer.from(envelope.data, 'base64')).toString());
});
afterAll(() => {
  if (process.env.METRICCANVAS_SCENARIO_REPORT) {
    writeFileSync(process.env.METRICCANVAS_SCENARIO_REPORT, JSON.stringify(Object.fromEntries(telemetry), null, 2));
  }
  rmSync(install, { recursive: true, force: true });
});

// Deterministic CLI coverage and byte receipts; this is not an independent model-cost trial.
describe('跨能力的仓外CLI渐进消费场景', () => {
  it.each(scenarios)('$name：发现、定位片段并完整读取实际关联规则', scenario => {
    const original = readFileSync(exampleFile(scenario.page));
    const found = read(scenario.name, ['find', '--kind', 'example', '--owner', scenario.owner, '--query', scenario.discover]);
    const id = 'example:' + scenario.page;
    expect(found.items).toContainEqual(expect.objectContaining({ id }));
    const outlines = pages(scenario.name, ['show', '--id', id, '--select', 'outline']);
    const component = outlines.flatMap(outline => outline.items).find(item => item.id === scenario.component);
    expect(component).toMatchObject({ id: scenario.component, type: scenario.owner });
    const at = scenario.rootAt ?? component!.path + scenario.at;
    const snippet = read(scenario.name, ['show', '--id', id, '--select', 'snippet', '--at', at]);
    expect(snippet).toMatchObject({ id, at, complete: true, value: scenario.expected });
    scenarioSemantic(scenario, id);
    expect(readFileSync(exampleFile(scenario.page))).toEqual(original);
    expect(telemetry.get(scenario.name)!.calls).toBeGreaterThanOrEqual(5);
    expect(telemetry.get(scenario.name)!.bytes).toBeGreaterThan(0);
  });

  it('多来源目录的末页包含第二成员，不把首屏或not-assessed当完成', () => {
    const args = ['show', '--id', 'example:paged-union-composite-key', '--select', 'dependencies', '--at', '/sections/1/components/0/props/columns/0', '--limit', '1'];
    const responses = pages('合并依赖完整分页', args);
    expect(responses[0]).toMatchObject({ complete: false, dependenciesResolved: 'not-assessed', total: 6 });
    const items = responses.flatMap(response => response.items);
    expect(items.filter(item => item.kind === 'source').map(item => item.id)).toEqual(['opinions', 'contract', 'commercial']);
    expect(items.filter(item => item.kind === 'field').map(item => item.field)).toEqual(['approver', 'memberId', 'localRowId']);
    expect(responses.at(-1)!.items).toContainEqual(expect.objectContaining({ id: 'commercial', type: 'query' }));
    const changedArgs = args.map(value => value === '/sections/1/components/0/props/columns/0' ? '/sections/1/components/0/props/columns/1' : value);
    const changed = execute('合并依赖错误游标', [...changedArgs, '--cursor', responses[0]!.next]);
    expect(changed.status).toBe(1);
    expect(changed.stderr).toContain('Stale');
  });

  it('共享筛选与补列依赖都来自真实关系，查询正文不进入目录', () => {
    const chart = pages('图表局部筛选依赖', ['show', '--id', 'example:chart-local-filter-page', '--select', 'dependencies', '--at', '/sections/0/components/0/props/components/1']);
    expect(chart.flatMap(page => page.items)).toContainEqual({ kind: 'filter', role: 'runtime', id: 'orders-region', at: '/filters/0' });
    const join = pages('关联补列依赖', ['show', '--id', 'example:record-join-query-page', '--select', 'dependencies', '--at', '/sections/0/components/0/props/columns/3']);
    expect(join.flatMap(page => page.items).filter(item => item.kind === 'source').map(item => item.id)).toEqual(['rejection-overview', 'rejection-details', 'business-basic']);
    expect(join.flatMap(page => page.items)).toContainEqual(expect.objectContaining({ field: 'biz-owner-name', source: 'rejection-overview', contract: { type: 'string', role: 'dimension', label: '商务责任人', nullable: true } }));
  });

  it('未登记关联不会臆造语义；明确缺口允许全局发现，而非把空目录当不支持', () => {
    const scoped = read('无关联与显式回退', ['find', '--kind', 'semantic', '--example', 'example:component-compositeCard', '--query', '独立筛选']);
    expect(scoped.items).toEqual([]);
    expect(scoped.complete).toBe(true);
    const global = read('无关联与显式回退', ['find', '--kind', 'semantic', '--query', '独立筛选']);
    expect(global.items).toContainEqual(expect.objectContaining({ owner: 'filters', title: '独立筛选按钮组' }));
    expect(execute('未知示例身份', ['find', '--kind', 'semantic', '--example', 'example:invented', '--query', '独立筛选']).status).toBe(1);
  });

  it('CLI大目标的嵌套槽位不泄漏载荷，冲突owner与缺判别条件不得猜测', () => {
    const target = JSON.parse(readFileSync(exampleFile('chart-local-filter-page'), 'utf8'));
    target.dataSources.private = { source: { type: 'inline', rows: [{ note: 'PRIVATE_SCENARIO_ROW'.repeat(10_000) }] } };
    target.dataSources.secret = { source: { type: 'query', query: { body: 'PRIVATE_SCENARIO_QUERY' } } };
    const file = path.join(install, 'large-target.json');
    const original = JSON.stringify(target);
    writeFileSync(file, original);
    const at = '/sections/0/components/0/props/components/1/props/categoryField';
    const actual = read('大目标局部定位', ['find', '--document', file, '--at', at]);
    expect(actual.documentContext).toEqual({ status: 'resolved', documentAt: at });
    expect(actual.items).toEqual([{ id: 'schema:#/definitions/barChartComponent/properties/props/properties/categoryField', owner: 'barChartComponent' }]);
    expect(execute('冲突owner', ['find', '--document', file, '--at', at, '--owner', 'tableComponent']).status).toBe(1);
    const misplaced = read('错误层级属性', ['find', '--document', file, '--at', '/sections/0/components/0/props/components/1/categoryField']);
    expect(misplaced).toMatchObject({ status: 'not-found', contextAt: '/sections/0/components/0/props/components/1',
      items: [{ id: 'schema:#/definitions/barChartComponent', owner: 'barChartComponent' }] });
    expect(readFileSync(file, 'utf8')).toBe(original);
    expect(readFileSync(file, 'utf8')).toBe(original);
    delete target.sections[0].components[0].props.components[1].type;
    writeFileSync(file, JSON.stringify(target));
    const unknown = read('缺判别条件', ['find', '--document', file, '--at', at]);
    expect(unknown.status).toBe('needs-context');
    expect(unknown.complete).toBe(false);
    expect(unknown.needs).toContainEqual(expect.objectContaining({ documentAt: '/sections/0/components/0/props/components/1/type' }));
    expect(readFileSync(file, 'utf8')).toBe(JSON.stringify(target));
    expect(original.length).toBeGreaterThan(200_000);
  });
});
