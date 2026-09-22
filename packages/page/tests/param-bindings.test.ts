import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { normalizePageDocument, validate } from '../src';
const template = () => JSON.parse(readFileSync('packages/page/fixtures/contract-valid/dimension-params-page.json', 'utf8'));
it('单/多值参数与部分共享目标合法，规范化保留原文参数', () => {
  const raw = template();
  expect(validate(raw)).toEqual([]);
  expect(normalizePageDocument(raw)).toEqual({ ok: true, document: raw, errors: [] });
  raw.params[0].multiple = false; raw.params[0].default = 'APAC';
  expect(validate(raw)).toEqual([]);
});
it.each([
  ['旧版本拒绝', (p: any) => { p.schemaVersion = '6.1'; }, '/schemaVersion'],
  ['默认形状', (p: any) => { p.params[0].default = 'APAC'; }, '/params/0/default'],
  ['重复值', (p: any) => { p.params[0].default = ['APAC', 'APAC']; }, '/params/0/default'],
  ['未知参数', (p: any) => { p.filters[0].initialParam = 'missing'; }, '/filters/0/initialParam'],
  ['双默认', (p: any) => { p.filters[0].default = ['EU']; }, '/filters/0/initialParam'],
  ['查询双默认', (p: any) => { p.dataSources.sales.source.query.body.dsl_list[0].filter.dims = [{dim_name:'region',dim_value_list:['EU']}]; }, '/dataSources/sales/source/query/paramBindings/regions'],
  ['错目标', (p: any) => { p.dataSources.sales.source.query.paramBindings.regions.queryField = 'another'; }, '/dataSources/sales/source/query/filterBindings/region-filter'],
  ['未知目标参数', (p: any) => { p.dataSources.shared.source.query.paramBindings.missing = {target:'dimension',queryField:'other'}; }, '/dataSources/shared/source/query/paramBindings/missing'],
  ['同目标双来源', (p: any) => { p.dataSources.shared.source.query.paramBindings.segment.queryField = 'region'; }, '/dataSources/shared/source/query/paramBindings/segment'],
  ['标量误绑维度', (p: any) => { p.params[1].type = 'string'; }, '/dataSources/shared/source/query/paramBindings/segment'],
])('%s拒绝且可定位', (_, mutate, path) => {
  const raw = template(); mutate(raw);
  expect(validate(raw)).toEqual(expect.arrayContaining([expect.objectContaining({type:'SCHEMA_ERROR',path})]));
});
