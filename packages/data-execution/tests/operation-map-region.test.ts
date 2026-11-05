import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {withOperationMapRegion} from '../src/operation-map-region';
import {createSourceProgram} from '../src/source-program/session';
import {initialFilterValues} from '../src/filter-values';
import type {RuntimeDataGateway,FilterCandidatesRequest} from '../src/ports';

const request:FilterCandidatesRequest={filterId:'region',dimension:'rep-office-code',level:'office',constraints:{dimensions:{},times:{}}};
const nodes=[{level:'geo',value:'WORLD',label:'全球'},{level:'region-dept',value:'华东地区部',label:'华东地区部',parent:{level:'geo',value:'WORLD'}},{level:'office',value:'上海代表处',label:'上海代表处',parent:{level:'region-dept',value:'华东地区部'}}];
const base:RuntimeDataGateway={async fetchData(){return {rows:[]};}};
describe('application-installed Operation Map Region',()=>{
  it('routes standard Region, normalizes global parent references and leaves input untouched',async()=>{
    const received:FilterCandidatesRequest[]=[];
    const gateway=withOperationMapRegion(base,{async fetchRegionCandidates(r){received.push(r);return {kind:'values',candidates:nodes};}});
    const result=await gateway.fetchFilterCandidates!(request,{signal:new AbortController().signal});
    expect(received).toEqual([request]);expect(result).toMatchObject({kind:'values',candidates:[{value:'全球'},{parent:{value:'全球'}},{value:'上海代表处'}]});
    expect(nodes[0].value).toBe('WORLD');
  });
  it('delegates other candidates and preserves query capability',async()=>{
    const calls:string[]=[];
    const source:RuntimeDataGateway={...base,async fetchFilterCandidates(r){calls.push(r.filterId);return {kind:'denied'};}};
    const gateway=withOperationMapRegion(source,{async fetchRegionCandidates(){throw Error('unexpected Region request');}});
    expect(gateway.fetchData).toBe(source.fetchData);
    expect(await gateway.fetchFilterCandidates!({...request,filterId:'customer'},{signal:new AbortController().signal})).toEqual({kind:'denied'});expect(calls).toEqual(['customer']);
  });
  it.each(['denied','unconfigured','unavailable'] as const)('preserves %s without fallback',async kind=>{
    const gateway=withOperationMapRegion(base,{async fetchRegionCandidates(){return {kind};}});
    expect(await gateway.fetchFilterCandidates!(request,{signal:new AbortController().signal})).toEqual({kind});
  });
  it('rejects an aborted request before and after awaiting the host',async()=>{
    const controller=new AbortController();let calls=0;
    const gateway=withOperationMapRegion(base,{async fetchRegionCandidates(){calls++;controller.abort();return {kind:'values',candidates:[]};}});
    await expect(gateway.fetchFilterCandidates!(request,{signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});expect(calls).toBe(1);
    await expect(gateway.fetchFilterCandidates!(request,{signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});expect(calls).toBe(1);
  });
  it('feeds implicit Region through the real source program and existing Chinese binding',async()=>{
    const source=JSON.parse(readFileSync('pages/capabilities/ioc-header/controls/ioc-header-controls.json','utf8'));
    const parsed=parsePage(source);expect(parsed.ok).toBe(true);if(!parsed.ok)return;
    const queries:unknown[]=[];
    const gateway=withOperationMapRegion({async fetchData(query){queries.push(query.filterValues);return {rows:[{region:'上海代表处',amount:100}],totalCount:1};}},
      {async fetchRegionCandidates(){return {kind:'values',candidates:nodes};}});
    const filters=initialFilterValues(parsed.page.filters!,new Date('2026-11-05T00:00:00Z'));
    filters.set('region',{type:'dimension',dimension:'rep-office-code',level:'office',values:['上海代表处']});
    const program=createSourceProgram(parsed.page,{gateway});const updates=[];
    for await(const update of program.read({roots:['scope'],conditions:filters,purpose:'screen'}))updates.push(update);
    expect(updates.at(-1)?.snapshot).toMatchObject({status:'ready',rows:[{region:'上海代表处',amount:100}]});
    expect(queries).toHaveLength(1);expect(queries[0]).toContainEqual({target:'dimension',queryField:'代表处',values:['上海代表处']});program.dispose();
  });
});
