import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {parsePage} from '../src/validate';
const original=JSON.parse(readFileSync(new URL('../../../pages/capabilities/filters/filter-source-candidates.json',import.meta.url),'utf8'));
it('accepts source-backed inline trees and a paginated query output without duplicate header controls',()=>{
  const result=parsePage(original);expect(result.errors).toEqual([]);expect(result.ok).toBe(true);
});
it.each([
  ['old version',(page:any)=>{page.schemaVersion='6.89';},/6.90/],
  ['unknown source',(page:any)=>{page.filters[0].candidates.dataSource='missing';},/已声明/],
  ['unknown output',(page:any)=>{page.filters[0].candidates.valueField='missing';},/标量输出/],
  ['missing parent',(page:any)=>{delete page.filters[0].candidates.parentField;},/父节点字段/],
  ['descendant expansion',(page:any)=>{page.filters[0].treeSelection='descendants';},/independent/],
  ['fixed options conflict',(page:any)=>{page.filters[0].options=[{value:'north',label:'北区'}];},/固定选项/],
  ['self predicate',(page:any)=>{page.dataSources['channel-options'].source.query.filterBindings={channel:{target:'dimension',queryField:'code'}};},/自身筛选/],
  ['undeclared dependency',(page:any)=>{page.dataSources['channel-options'].source.query.filterBindings={organization:{target:'dimension',queryField:'code'}};},/candidateContext/],
  ['control missing source',(page:any)=>{delete page.filters[0].candidates;},/声明 candidates/]
])('rejects %s with a located diagnostic',(_name,change,expected)=>{
  const page=structuredClone(original);change(page);const result=parsePage(page);expect(result.ok).toBe(false);expect(result.errors.some(error=>expected.test(error.message)),JSON.stringify(result.errors)).toBe(true);
});
it('accepts explicit candidate source dependencies and forbids cycles across candidates',()=>{
 const page=structuredClone(original);
 page.dataSources['channel-options'].source.query.filterBindings={organization:{target:'dimension',queryField:'code'}};
 page.filters[1].candidateContext={filterIds:['organization'],reconcile:'intersection'};
 expect(parsePage(page).errors).toEqual([]);
 page.filters[0].candidateContext={filterIds:['channel'],reconcile:'clear'};
 expect(parsePage(page).ok).toBe(false);
});
