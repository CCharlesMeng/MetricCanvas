import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {parsePage} from '../src/validate';
import {capabilityFloorErrors} from '../src/version';
import {extractPageParams} from '../src/extract-page-params';
function page() {
  const value = JSON.parse(readFileSync(new URL('../fixtures/contract-valid/dashboard-period-filter.json', import.meta.url), 'utf8'));
  value.schemaVersion = '6.104'; value.filters[0].default = {mode: 'month', finalizationName: '经营数据'};
  return value;
}
describe('finalization default contract', () => {
  it.each(['month', 'quarter', 'year', 'last12Months'])('accepts natural %s defaults', mode => {
    const value = page(); value.filters[0].default.mode = mode;
    expect(parsePage(value).ok).toBe(true);
  });
  it.each(['date', 'month'])('accepts %s point defaults', granularity => {
    const value = page(); value.filters = [{id: 'point', type: 'timePoint', granularity, default: {finalizationName: '经营数据'}}];
    value.sections = [{id: 'body', components: [{id: 'text', type: 'text', layout: {span: 12}, props: {body: '合成测试'}}]}];
    value.dataSources = {}; delete value.iocHeader;
    expect(parsePage(value).ok).toBe(true);
  });
  it.each(['', '   ', 42, null])('rejects invalid name %j', name => {
    const value = page(); value.filters[0].default.finalizationName = name;
    expect(parsePage(value).ok).toBe(false);
  });
  it.each(['timePoint', 'timeRange'])('rejects whitespace-only names for %s defaults', type => {
    const value = page();
    value.filters = [{id:'date',type,default:{finalizationName:'   '},...(type==='timePoint'?{granularity:'date'}:{precision:'month'})}];
    value.dataSources = {}; delete value.iocHeader;
    value.sections = [{id:'body',components:[{id:'note',type:'text',layout:{span:12},props:{body:'校验空白定稿名称'}}]}];
    expect(parsePage(value).ok).toBe(false);
  });
  it.each(['value', 'from', 'anchor'])('rejects a competing explicit %s', key => {
    const value = page(); value.filters[0].default[key] = '2026-10';
    expect(parsePage(value).ok).toBe(false);
  });
  it('rejects the new capability on an old version', () => {
    const value = page(); value.schemaVersion = '6.98';
    const parsed = parsePage(value); expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors).toEqual(expect.arrayContaining([expect.objectContaining({path: '/filters/0/default/finalizationName'})]));
  });
  it.each(['5.0','5.4','6.98','6.100'])('requires the capability floor even through %s compatibility reading', schemaVersion => {
    expect(capabilityFloorErrors({schemaVersion, filters:[{id:'point',type:'timePoint',granularity:'date',default:{finalizationName:'经营数据'}}]})).toEqual(expect.arrayContaining([expect.objectContaining({path:'/filters/0/default/finalizationName'})]));
  });
  it.each(['month', 'quarter', 'year', 'last12Months'])('accepts a non-empty name array for a %s default', mode => {
    const value = page();
    value.schemaVersion = '6.140';
    value.filters[0].default = {mode, finalizationName: ['合同数据', ' 经营数据 ']};
    expect(parsePage(value).ok).toBe(true);
  });
  it.each([[], [''], ['经营数据', 9], ['经营数据', '  ']].map(value => [value]))('rejects an invalid name array %j', finalizationName => {
    const value = page();
    value.schemaVersion = '6.140';
    value.filters[0].default = {mode: 'month', finalizationName};
    expect(parsePage(value).ok).toBe(false);
  });
  it('requires 6.140 for a name array at the existing field path', () => {
    const value = page();
    value.schemaVersion = '6.139';
    value.filters[0].default.finalizationName = ['经营数据'];
    const parsed = parsePage(value);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors).toEqual(expect.arrayContaining([expect.objectContaining({path: '/filters/0/default/finalizationName'})]));
  });
  it.each([
    {layout: 'report', filter: {type: 'timeRange', display: 'period', default: {mode: 'month'}}},
    {layout: 'dashboard', filter: {type: 'timeRange', precision: 'month', default: {}}},
    {layout: 'dashboard', filter: {type: 'timePoint', granularity: 'month', default: {}}}
  ])('rejects an array outside Dashboard natural periods %j', ({layout, filter}) => {
    const value = page();
    value.schemaVersion = '6.140';
    value.layout = layout;
    value.filters[0] = {id: 'period-filter', ...filter, default: {...filter.default, finalizationName: ['经营数据']}};
    value.dataSources = {};
    delete value.iocHeader;
    value.sections = [{id: 'body', components: [{id: 'note', type: 'text', layout: {span: 12}, props: {body: '定稿名称'}}]}];
    expect(parsePage(value).ok).toBe(false);
  });
  it('keeps relative defaults out of parameter extraction', () => {
    const result = extractPageParams(page(), {baseline: 'finalization'});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.candidates.some(candidate => candidate.locations.some(location => location.filterId === 'period-filter'))).toBe(false);
  });
});
