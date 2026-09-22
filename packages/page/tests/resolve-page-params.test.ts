import { describe, expect, it } from 'vitest';
import { resolvePageParams } from '../src/resolve-page-params';

import fixture from '../fixtures/contract-valid/inline-params-page.json';
const template = () => structuredClone(fixture);

describe('resolvePageParams', () => {
  it('materializes only an execution copy and preserves the template references', () => {
    const input = template();
    const result = resolvePageParams(input, {
      region: ['中国区'], 'report-period': { start: '2026-01', end: '2026-06', granularity: 'month' }
    });
    expect(result.ok).toBe(true);
    expect(input.dataSources.tokens.source.query.body.dsl_list[0].filter.dims[0].dim_value_list).toEqual({ param: 'region' });
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    const query = (result.resolvedPage as any).dataSources.tokens.source.query.body.dsl_list[0].filter;
    expect(query.dims[0].dim_value_list).toEqual(['中国区']);
    expect(query.time).toMatchObject({ start: '2026-01', end: '2026-06' });
  });

  it('fails closed for missing, unknown, and wrong-spelled supplied values', () => {
    expect(resolvePageParams(template()).ok).toBe(false);
    expect(resolvePageParams(template(), { report_period: '2026-01' }).issues.map(x => x.message)).toContain('未知输入:report_period');
    expect(resolvePageParams(template(), { region: [] }).ok).toBe(false);
  });
  it('accepts leap-day closed intervals, rejects bad calendars, and never falls back from invalid explicit inputs',()=>{
    const raw=template() as any;raw.params.query.times[0].granularity='date';
    raw.dataSources.tokens.source.query.body.dsl_list[0].filter.time.period='day';
    const values={region:['中国区'],'report-period':{start:'2024-02-29',end:'2024-03-01',granularity:'date'}};
    const r=resolvePageParams(raw,values);expect(r.ok).toBe(true);if(!r.ok)throw Error('fixture');
    expect(resolvePageParams(r.document,{region:[]}).ok).toBe(false);
    expect(resolvePageParams(raw,{...values,'report-period':{...values['report-period'],start:'2025-02-29'}}).ok).toBe(false);
    expect(resolvePageParams(raw,{...values,'report-period':{...values['report-period'],start:'2024-03-02'}}).ok).toBe(false);
    expect(resolvePageParams(raw,values)).toEqual(r);
  });
});

import groupedFixture from '../fixtures/contract-valid/grouped-params-page.json';

it('fills grouped templates without flattening declarations or mixing independent time ranges', () => {
  const input = structuredClone(groupedFixture);
  delete (input.params.query.dimensions[0] as {dim_value_list?: string[]}).dim_value_list;
  for (const time of input.params.query.times) {
    delete (time as {start?: string}).start;
    delete (time as {end?: string}).end;
  }
  const before = structuredClone(input);
  expect(resolvePageParams(input).ok).toBe(false);
  const values = {region:['欧洲地区部'], 'report-period':{start:'2026-07',end:'2026-09'}, 'report-month':{start:'2026-09',end:'2026-09'}};
  const result = resolvePageParams(input, values);
  if (!result.ok) throw Error(JSON.stringify(result.issues));
  expect(input).toEqual(before);
  expect(result.document.params).toEqual({query:{
    dimensions:[{...before.params.query.dimensions[0],dim_value_list:values.region}],
    times:before.params.query.times.map(time=>({...time,...values[time.id as 'report-period'|'report-month']}))
  }});
  for(const [id, period] of [['current',{start:'2026-07',end:'2026-09'}],['rolling',{start:'2025-10',end:'2026-09'}]] as const) {
    const source = result.resolvedPage.dataSources[id].source;
    if(source.type!=='query')throw Error('expected query');
    expect((source.query.body as any).dsl_list[0].filter).toMatchObject({
      dims:[{dim_name:'region',dim_value_list:values.region}],time:period
    });
  }
  expect(resolvePageParams(result.document)).toEqual(result);
  expect(resolvePageParams(input,{...values,'report-month':{start:'2026-08',end:'2026-09'}}).ok).toBe(false);
});
