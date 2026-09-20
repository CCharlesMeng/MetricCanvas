import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage, validate, normalizePageDocument } from '../src';
const document = () => JSON.parse(readFileSync('packages/page/fixtures/contract-valid/grouped-params-page.json', 'utf8'));

it('分组参数校验、读写规范化保留原结构，运行态共用声明，原文不变', () => {
  const raw = document(), before = JSON.stringify(raw);
  const parsed = parsePage(raw);
  expect(parsed.errors).toEqual([]);
  if (!parsed.ok) throw new Error('invalid');
  expect(parsed.page.params?.map(p => p.id)).toEqual(['region', 'report-period', 'comparison-period']);
  expect(JSON.stringify(parsed.page.sections)).toContain('2026-01 至 2026-06');
  const normalized = normalizePageDocument(raw);
  expect(normalized.ok).toBe(true);
  if (normalized.ok) expect(normalized.document.params).toEqual(raw.params);
  const dimension = parsed.page.params?.[0].value;
  if (Array.isArray(dimension)) dimension.push('运行态修改');
  expect(JSON.stringify(raw)).toBe(before);
});
it('未填值模板可校验，纯展示标量支持实际 value', () => {
  const raw = document();
  delete raw.params.dimensions[0].dim_value_list;
  for (const time of raw.params.times) { delete time.start; delete time.end; }
  raw.params.scalars = [{id:'heading', type:'string', value:'对比报告'}];
  raw.sections[0].components[0].props.title = {param:'heading'};
  expect(validate(raw)).toEqual([]);
});

it.each([
  ['旧版本不能使用新结构', (p: any) => { p.schemaVersion = '6.5'; }],
  ['跨组ID重复', (p: any) => { p.params.times[0].id = 'region'; }],
  ['单数time不接受', (p: any) => { p.params.time = p.params.times[0]; delete p.params.times; }],
  ['重复维度值', (p: any) => { p.params.dimensions[0].dim_value_list = ['A','A']; }],
  ['空维度值', (p: any) => { p.params.dimensions[0].dim_value_list = []; }],
  ['时间半填', (p: any) => { delete p.params.times[0].end; }],
  ['时间逆序', (p: any) => { p.params.times[0].start = '2027-01'; }],
  ['非法日历', (p: any) => { Object.assign(p.params.times[0], {granularity:'date',start:'2026-02-29',end:'2026-03-01'}); }],
  ['禁止聚合设置进入参数', (p: any) => { p.params.times[0].is_aggregate = true; }],
  ['旧default不能充当实际值', (p: any) => { p.params.times[0].default = '2026-01'; }],
  ['引用未知参数', (p: any) => { p.dataSources.current.source.query.body.dsl_list[0].filter.time.start.param = 'missing'; }],
  ['起止不能混用两组参数', (p: any) => { p.dataSources.current.source.query.body.dsl_list[0].filter.time.end.param = 'comparison-period'; }],
  ['禁止引用字段名', (p: any) => { p.dataSources.current.source.query.body.dsl_list[0].output_dims = [{param:'region'}]; }],
  ['目标维度必须一致', (p: any) => { p.params.dimensions[0].dim_name = 'office'; }],
  ['不允许可选查询时间', (p: any) => { p.params.times[0].required = false; }],
  ['聚合精度不兼容', (p: any) => { p.dataSources.current.source.query.body.dsl_list[0].filter.time.period = 'day'; }],
  ['原位与筛选不能双控', (p: any) => { p.dataSources.current.source.query.filterBindings = {period:{target:'time'}}; }]
])('%s', (_, mutate) => {
  const raw = document(); mutate(raw);
  expect(validate(raw).length).toBeGreaterThan(0);
});
