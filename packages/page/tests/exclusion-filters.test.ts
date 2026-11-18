import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {parsePage} from '../src/validate';
import {independentExclusionFilterIds} from '../src/exclusion-filters';
import {canonicalLayoutDocument} from '../src/layout-compatibility';

function page(){
  const parsed=parsePage(JSON.parse(readFileSync('pages/capabilities/filters/filter-exclusion-candidates.json','utf8')));
  if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  return parsed.page;
}
it('derives the policy from exclusive negative bindings, without filter-name conventions',()=>{
  const document=page();
  expect([...independentExclusionFilterIds(document)]).toEqual(['service']);
  const source=document.dataSources['chart-data'];
  if(source.source.type!=='query')throw Error('fixture');
  source.source.query.filterBindings!.service={target:'dimension',queryField:'云服务'};
  expect(independentExclusionFilterIds(document).size).toBe(0);
});
it('does not relax a shared filter consumed by an include query',()=>{
  const document=page(),other=structuredClone(document.dataSources['chart-data']);
  if(other.source.type!=='query')throw Error('fixture');
  other.source.query.filterBindings!.service={target:'dimension',queryField:'云服务'};
  document.dataSources.include=other;
  expect(independentExclusionFilterIds(document).size).toBe(0);
});
it.each(['required','hierarchy','explicit-clear','intersection'])('retains the original rules for %s',kind=>{
  const document=page(),filter=document.filters!.find(item=>item.id==='service');
  if(filter?.type!=='dimension')throw Error('fixture');
  if(kind==='required')filter.selection={mode:'multiple',required:true};
  if(kind==='hierarchy')filter.hierarchy=[{id:'node',dimension:'service'}];
  if(kind==='explicit-clear')filter.clearOnChangeOf=['service-scope'];
  if(kind==='intersection')filter.candidateContext!.reconcile='intersection';
  expect(independentExclusionFilterIds(document).size).toBe(0);
});
it('does not promote 6.124 into the new exclusion semantics on read',()=>{
  const document=page();document.schemaVersion='6.124';
  expect(independentExclusionFilterIds(document).size).toBe(0);
  expect(canonicalLayoutDocument(document).schemaVersion).toBe('6.124');
});
