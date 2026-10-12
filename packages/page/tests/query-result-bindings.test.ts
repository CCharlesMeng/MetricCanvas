import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validate } from '../src/validate';
import { queryResultCases } from '../../../tools/scripts/query-result-conformance-vectors';
const fixture = () => JSON.parse(readFileSync(new URL('../fixtures/contract-valid/query-cascade-page.json', import.meta.url), 'utf8'));
const base = 'project-efficiency-bottom5';
const detail = `${base}-stages`;

describe('raw query result bindings', () => {
  it.each(queryResultCases(fixture()))('shared conformance: $name', ({input, expected}) => {
    const before = structuredClone(input), errors = validate(input);
    expect(errors.length === 0).toBe(expected.ok);
    if (expected.path) expect(errors.some(error => error.path?.startsWith(expected.path!))).toBe(true);
    expect(input).toEqual(before);
  });
  it('accepts raw-query dependency followed by pivot and left join', () => expect(validate(fixture())).toEqual([]));
  it.each(['6.11', '6.12', '6.13'])('rejects the new capability in %s', version => {
    const page = fixture(); page.schemaVersion = version;
    expect(validate(page).some(error => error.message.includes('6.14'))).toBe(true);
  });
  it.each([
    ['unknown source', (p: ReturnType<typeof fixture>) => p.dataSources[detail].source.query.resultBindings[0].source = 'absent'],
    ['computed field', (p: ReturnType<typeof fixture>) => p.dataSources[detail].source.query.resultBindings[0].field = 'rep-office-time'],
    ['self cycle', (p: ReturnType<typeof fixture>) => p.dataSources[detail].source.query.resultBindings[0].source = detail],
    ['two-query cycle', (p: ReturnType<typeof fixture>) => p.dataSources[base].source.query.resultBindings = [{source:detail,field:'commerce-id',target:'dimension',queryField:'x',maxValues:5}]],
    ['static conflict', (p: ReturnType<typeof fixture>) => p.dataSources[detail].source.query.body.dsl_list[0].filter.dims = [{dim_name:'商务编号',dim_value_list:['X']}]],
    ['invalid bound', (p: ReturnType<typeof fixture>) => p.dataSources[detail].source.query.resultBindings[0].maxValues = 1001],
    ['offset', (p: ReturnType<typeof fixture>) => p.dataSources[base].source.query.body.dsl_list[0].order.offset = 0],
    ['incomplete auxiliary', (p: ReturnType<typeof fixture>) => delete p.dataSources[detail].source.resultScope],
    ['pivot measure repeated', (p: ReturnType<typeof fixture>) => delete p.dataSources[detail].compute[0].columns[1].valueField],
    ['pivot unit mismatch', (p: ReturnType<typeof fixture>) => p.dataSources[detail].fields['rep-office-count'].unit = '天']
  ])('rejects %s', (_, change) => { const page = fixture(); change(page); expect(validate(page).length).toBeGreaterThan(0); });
});
