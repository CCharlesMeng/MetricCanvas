import {expect,it} from 'vitest';
import document from '../../../pages/capabilities/table/table-header-filter-defaults.json';
import {parsePage} from '../src/validate';
import {columnDefaultPaths} from '../src/table/columns';
import joinSample from '../fixtures/contract-valid/paged-join-query-page.json';

it('accepts fixed defaults and enforces capability even for explicit empty arrays',()=>{
  expect(parsePage(document).ok).toBe(true);
  const raw=JSON.parse(JSON.stringify(document));
  Object.assign(raw.sections[2].components[0].props.columns[1].filterable,{defaultValues:[]});
  expect(columnDefaultPaths(raw)).toContain('/sections/2/components/0/props/columns/1/filterable/defaultValues');
  raw.schemaVersion='6.80';
  expect(parsePage(raw)).toMatchObject({ok:false,errors:expect.arrayContaining([expect.objectContaining({type:'SCHEMA_ERROR',message:expect.stringContaining('6.82')})])});
});
it('rejects repeated, wrongly typed and out-of-dictionary values at their paths',()=>{
  const raw=JSON.parse(JSON.stringify(document)),column=raw.sections[2].components[0].props.columns[1];
  for(const values of [['pending','pending'],[1],['unknown']]){
    Object.assign(column.filterable,{defaultValues:values});
    expect(parsePage(raw)).toMatchObject({ok:false,errors:expect.arrayContaining([expect.objectContaining({path:expect.stringContaining('/filterable/defaultValues')})])});
  }
  expect(JSON.stringify(document)).toContain('"defaultValues":["pending"]');
});
it('rejects references, non-select defaults and non-main field bindings',()=>{
  const raw=JSON.parse(JSON.stringify(document)),column=raw.sections[2].components[0].props.columns[1];
  Object.assign(column.filterable,{defaultValues:{param:'status'}});
  expect(parsePage(raw).ok).toBe(false);
  Object.assign(column.filterable,{mode:'dateRange',defaultValues:['pending']});
  expect(parsePage(raw).ok).toBe(false);
  Object.assign(column.filterable,{mode:'select',defaultValues:['pending']});
  Object.assign(column,{field:{data:'other',field:'status'}});
  expect(parsePage(raw)).toMatchObject({ok:false,errors:expect.arrayContaining([expect.objectContaining({message:'默认筛选只允许静态 main 字段绑定'})])});
});
it('finds grouped and expanded-row capability paths without accepting child filtering',()=>{
  const raw=JSON.parse(JSON.stringify(document)),table=raw.sections[2].components[0];
  Object.assign(table.props,{columns:[{kind:'group',id:'group',title:'组',children:table.props.columns}]});
  expect(columnDefaultPaths(raw)).toContain('/sections/2/components/0/props/columns/0/children/1/filterable/defaultValues');
  Object.assign(table.props,{rowExpansion:{table:{columns:[{field:'status',filterable:{mode:'select',defaultValues:[]}}]}}});
  expect(columnDefaultPaths(raw)).toContain('/sections/2/components/0/props/rowExpansion/table/columns/0/filterable/defaultValues');
  expect(parsePage(raw).ok).toBe(false);
});
it('rejects cross-member defaults and default-sort conflicts rather than choosing the last column',()=>{
  const raw=JSON.parse(JSON.stringify(joinSample));raw.schemaVersion='6.82';
  const columns=raw.sections[0].components[0].props.columns;
  columns[1].filterable.defaultValues=['项目甲'];
  expect(parsePage(raw).ok).toBe(true);
  columns[3].filterable.defaultValues=['进行中'];
  expect(parsePage(raw)).toMatchObject({ok:false,errors:expect.arrayContaining([expect.objectContaining({message:expect.stringContaining('同一个查询成员')})])});
  delete columns[1].filterable.defaultValues;
  expect(parsePage(raw).ok).toBe(false);
  raw.dataSources.projects.source.ordering.default=[{field:'contract-amount',direction:'desc'}];
  expect(parsePage(raw).ok).toBe(true);
});
