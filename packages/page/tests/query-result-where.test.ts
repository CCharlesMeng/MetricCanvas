import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePage } from '../src/validate';
import { filterQueryResultRows } from '../src/query-result-where';
import type { QueryResultWhere } from '../src/query';
import type { Row } from '../src/snapshot';
const parsed = parsePage(JSON.parse(readFileSync(new URL('../fixtures/contract-valid/query-result-where-page.json', import.meta.url), 'utf8')));
if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
const fields = parsed.page.dataSources.projects.fields;
const row: Row = {'project-id':'A',status:'进行中',enabled:false,amount:1000000,duration:0,day:'2026-10-01',at:'2026-10-01T00:00:00Z'};
const select = (where: QueryResultWhere, rows: Row[] = [row]) => filterQueryResultRows(rows, where, fields);

describe('raw result row selection contract', () => {
  it.each<QueryResultWhere>([
    {field:'status',op:'eq',value:'进行中'}, {field:'status',op:'ne',value:'结束'},
    {field:'status',op:'in',values:['结束','进行中']}, {field:'status',op:'notIn',values:['结束']},
    {field:'duration',op:'eq',value:0}, {field:'enabled',op:'eq',value:false},
    {field:'amount',op:'gte',value:1000000}, {field:'amount',op:'lte',value:1000000},
    {field:'amount',op:'gt',value:999999}, {field:'duration',op:'lt',value:1},
    {field:'day',op:'eq',value:'2026-10-01'}, {field:'at',op:'in',values:['2026-10-01T00:00:00Z']},
    {field:'amount',op:'isNotNull'}
  ])('matches typed raw values: %j', where => expect(select(where)).toEqual([row]));
  it('combines nested all/any and preserves the source values, order and identity', () => {
    const rows = [row,{...row,'project-id':'B',amount:2},{...row,'project-id':'C',status:'结束',amount:2}];
    const before = structuredClone(rows);
    const result = select({all:[{field:'status',op:'eq',value:'进行中'},{any:[{field:'enabled',op:'eq',value:false},{field:'amount',op:'isNull'}]}]}, rows);
    expect(result).toEqual(rows.slice(0,2)); expect(result[0]).toBe(row); expect(rows).toEqual(before);
  });
  it.each<QueryResultWhere>([
    {field:'amount',op:'ne',value:1}, {field:'amount',op:'notIn',values:[1]},
    {field:'amount',op:'eq',value:0}, {field:'amount',op:'gt',value:0}, {field:'amount',op:'isNotNull'}
  ])('null does not match ordinary or non-null conditions: %j', where => expect(select(where,[{...row,amount:null}])).toEqual([]));
  it('explicitly selects null and does not trim strings or round numbers', () => {
    expect(select({field:'amount',op:'isNull'},[{...row,amount:null}])).toHaveLength(1);
    expect(select({field:'status',op:'eq',value:'进行中'},[{...row,status:' 进行中 '}])).toEqual([]);
    expect(select({field:'amount',op:'gt',value:1000000},[{...row,amount:1000000.001}])).toHaveLength(1);
  });
  it.each([undefined,'1',true,NaN,Infinity])('rejects invalid predicate fields even behind boolean short circuits: %s', value => {
    const invalid = {...row}; Reflect.set(invalid, 'amount', value);
    expect(()=>select({any:[{field:'status',op:'eq',value:'进行中'},{field:'amount',op:'gt',value:0}]},[invalid])).toThrow('过滤字段');
  });
  it('validates declarations even for empty results and rejects computed/unknown fields', () => {
    expect(()=>select({all:[]},[])).toThrow('声明不合法');
    expect(()=>select({field:'amount',op:'notIn',values:[]},[])).toThrow('声明不合法');
    expect(()=>select({field:'unknown',op:'isNull'},[])).toThrow('声明不合法');
    expect(()=>select({field:'amount',op:'eq',value:'1'},[])).toThrow('声明不合法');
  });
});
