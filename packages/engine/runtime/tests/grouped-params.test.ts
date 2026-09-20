import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import type { EffectiveQuery } from '@metriccanvas/page/internal';
import { createFilterState, initializePageParams, orchestrate, navigationHref, prepareExecution, type ExecutionRequest, pageParamSearch, resolvePageParams } from '../src';
import { effectiveDqeItem } from '../../data-gateway/src/dqe';
const document = () => JSON.parse(readFileSync('packages/page/fixtures/contract-valid/grouped-params-page.json','utf8'));
function parse(raw: unknown) {
  const result = parsePage(raw);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.page;
}
it('多时间输入分别进入实际请求，保持各查询聚合设置并清除无执行凭据的旧行', async () => {
  const raw = document(), before = JSON.stringify(raw), page = parse(raw);
  const inputs = resolvePageParams('', page.params ?? []);
  expect(inputs.missing).toEqual([]);
  expect(resolvePageParams(pageParamSearch(inputs.values), page.params ?? []).values).toEqual(inputs.values);
  const source = page.dataSources.current.source;
  if (source.type === 'query') source.initial = {capturedAt:'2026-01-01T00:00:00Z',rows:[]};
  const loaded = initializePageParams(page, inputs.values);
  expect(loaded.dataSources.current.source).not.toHaveProperty('initial');
  const requests: EffectiveQuery[] = [];
  const stop = orchestrate(loaded, {fetchData: async q => { requests.push(q); return {rows:[],totalCount:0}; }}, createFilterState()).subscribe(() => {});
  try {
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    const filters = requests.map(effectiveDqeItem).map(item => item.filter);
    expect(filters).toContainEqual(expect.objectContaining({time:{period:'month',is_aggregate:true,start:'2026-01',end:'2026-06'}}));
    expect(filters).toContainEqual(expect.objectContaining({time:{period:'month',is_aggregate:false,start:'2025-01',end:'2025-06'}}));
    for (const filter of filters) expect(filter).toMatchObject({dims:[{dim_name:'region',dim_value_list:['中国地区部']}]});
    expect(JSON.stringify(requests)).not.toContain('"param"');
    expect(JSON.stringify(raw)).toBe(before);
  } finally { stop(); }
});
it('缺值模板阻止执行，URL只覆盖指定时间，非法时间不回退', () => {
  const raw = document();
  for (const time of raw.params.times) { delete time.start; delete time.end; }
  const page = parse(raw), declarations = page.params ?? [];
  const inputs = resolvePageParams('', declarations);
  expect(inputs.missing).toEqual(['report-period','comparison-period']);
  expect(() => initializePageParams(page, inputs.values)).toThrow();
  const filled = parse(document());
  const values = resolvePageParams(`report-period=${encodeURIComponent(JSON.stringify({start:'2027-01',end:'2027-06'}))}`, filled.params ?? []);
  expect(values.values.get('comparison-period')).toEqual({start:'2025-01',end:'2025-06'});
  expect(values.values.get('report-period')).toEqual({start:'2027-01',end:'2027-06'});
  for (const value of ['', '{}', '{"start":"2026-13","end":"2027-01"}', 'null']) {
    const bad = resolvePageParams(`report-period=${encodeURIComponent(value)}`, filled.params ?? []);
    expect(bad.missing).toEqual(['report-period']);
    expect(bad.values.has('report-period')).toBe(false);
  }
});

it('导航可携带独立时间区间且返回同一实际值', () => {
  const page = parse(document());
  const values = resolvePageParams('', page.params ?? []).values;
  const href = navigationHref({href:'/report', query:{'report-period':{source:'param',id:'report-period'}}}, new Map(), values);
  const next = resolvePageParams(new URL(href, 'https://example.test').search, page.params ?? []);
  expect(next.values.get('report-period')).toEqual(values.get('report-period'));
});

it('可信执行回执可覆盖两组时间且必须完整提供，快照消费不重查', async () => {
  const raw = document();
  const request: ExecutionRequest = {target:{kind:'draft',ref:{pageId:raw.id,revisionId:'r1',resourceId:'metadata'}},operationId:'grouped-execution',explicitInputs:{}};
  const actual = {region:['上海地区部'], 'report-period':{start:'2027-01',end:'2027-06'}, 'comparison-period':{start:'2026-01',end:'2026-06'}};
  const response = {status:'success',target:request.target,operationId:request.operationId,executionId:'e1',conditionKey:'c1',document:raw,appliedInputs:actual,filterValues:{},dataSources:Object.fromEntries(Object.keys(raw.dataSources).map(id => [id,{status:'success',rows:[],totalCount:0,conditionKey:'c1'}]))};
  const bootstrap = prepareExecution(request, response);
  const parsed = parsePage(raw, {textValues:{values:bootstrap.params}});
  if (!parsed.ok) throw new Error('invalid');
  expect(JSON.stringify(parsed.page.sections)).toContain('2027-01 至 2027-06');
  const loaded = initializePageParams(parsed.page, bootstrap.params);
  const fetchData = vi.fn(async () => ({rows:[],totalCount:0}));
  const stop = orchestrate(loaded, {fetchData}, createFilterState(), undefined, bootstrap).subscribe(() => {});
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(fetchData).not.toHaveBeenCalled();
  stop();
  const missing = {...response, appliedInputs:{region:actual.region, 'report-period':actual['report-period']}};
  expect(() => prepareExecution(request, missing)).toThrow();
});
