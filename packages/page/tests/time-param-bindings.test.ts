import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { validate } from '../src';

const document = () => JSON.parse(readFileSync('packages/page/fixtures/contract-valid/time-params-page.json','utf8'));
it('6.3 时间参数及五种实际查询窗口通过完整校验', () => expect(validate(document())).toEqual([]));
it.each([
  ['版本下限', (p: any) => { p.schemaVersion = '6.2'; }],
  ['非法月份', (p: any) => { p.params[0].default = '2026-13'; }],
  ['非法日期', (p: any) => { p.params[0].granularity = 'date'; p.params[0].default = '2026-02-29'; }],
  ['未知参数', (p: any) => { p.params[0].id = 'other'; }],
  ['可选时间不能放开查询', (p: any) => { p.params[0].required = false; }],
  ['维度不能绑时间', (p: any) => { p.params[0].type = 'dimension'; delete p.params[0].granularity; }],
  ['同目标双来源', (p: any) => { p.params.push({...p.params[0],id:'other'}); p.dataSources.current.source.query.paramBindings.other = {target:'time',window:{kind:'period',unit:'month'}}; }],
  ['静态起止冲突', (p: any) => { p.dataSources.current.source.query.body.dsl_list[0].filter.time.start = '2026-01'; }],
  ['缺少查询粒度', (p: any) => { delete p.dataSources.current.source.query.body.dsl_list[0].filter.time; }],
  ['不转换查询粒度', (p: any) => { p.dataSources.current.source.query.body.dsl_list[0].filter.time.period = 'day'; }],
  ['月参数不能推断日', (p: any) => { p.dataSources.current.source.query.paramBindings['report-month'].window.unit = 'day'; }],
  ['不读取最新期', (p: any) => { p.dataSources.current.source.query.paramBindings['report-month'].window = {kind:'latest'}; }],
  ['不可双控', (p: any) => { p.filters = [{id:'date-filter',type:'timeRange'}]; p.dataSources.current.source.query.filterBindings = {'date-filter':{target:'time'}}; }],
  ['零滚动期', (p: any) => { p.dataSources.rolling.source.query.paramBindings['report-month'].window.n = 0; }],
  ['默认窗口越界', (p: any) => { p.params[0].default = '0001-01'; }],
])('%s被拒绝', (_, mutate) => {
  const raw = document(); mutate(raw);
  expect(validate(raw).length).toBeGreaterThan(0);
});
