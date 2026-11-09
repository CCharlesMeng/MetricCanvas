import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {parsePage} from '../src/validate';
import {queryFilterIds} from '../src/amount-filter';

const document=()=>JSON.parse(readFileSync('pages/capabilities/filters/filter-binding-when.json','utf8'));
describe('dimension binding applicability',()=>{
  it('accepts a filter condition and subscribes to its controller without binding that controller',()=>{
    const input=document(),result=parsePage(input);
    expect(result).toMatchObject({ok:true});
    expect(queryFilterIds(input.dataSources.offices.source.query)).toEqual(['site','region']);
    delete input.dataSources.offices.source.query.filterBindings.region;
    expect(parsePage(input).ok).toBe(true);
    expect(queryFilterIds(input.dataSources.offices.source.query)).toEqual(['site','region']);
  });
  it.each([
    {filter:'missing',part:'level',op:'eq',value:'geo'},
    {filter:'region',part:'level',op:'eq',value:'missing'},
    {filter:'region',part:'values',op:'eq',value:'geo'},
    {permission:'admin'}, {fact:'scope',op:'eq',value:'geo'},
    {row:'region',op:'eq',value:'geo'}
  ])('rejects an invalid or external condition %j',condition=>{
    const input=document();input.dataSources.offices.source.query.filterBindings.site.when=condition;
    expect(parsePage(input)).toMatchObject({ok:false,errors:expect.arrayContaining([expect.objectContaining({path:'/dataSources/offices/source/query/filterBindings/site/when'})])});
  });
  it('rejects the new capability in an older document and leaves historical bindings valid',()=>{
    const input=document();input.schemaVersion='6.98';
    expect(parsePage(input).ok).toBe(false);
    delete input.dataSources.offices.source.query.filterBindings.site.when;
    expect(parsePage(input).ok).toBe(true);
  });
  it('validates queryModes conditions in every case at their original paths',()=>{
    const input=document(),query=input.dataSources.offices.source.query;
    input.filters.push({id:'mode',type:'dimension',dimension:'mode',default:['a'],options:[{label:'A',value:'a'},{label:'B',value:'b'}],selection:{mode:'single',required:true}});
    input.dataSources.offices.source.query={language:'dqe',queryModes:{filterId:'mode',cases:{a:{body:query.body,filterBindings:query.filterBindings},b:structuredClone({body:query.body,filterBindings:query.filterBindings})}}};
    expect(parsePage(input).ok).toBe(true);
    input.dataSources.offices.source.query.queryModes.cases.b.filterBindings.site.when.filter='missing';
    expect(parsePage(input)).toMatchObject({ok:false,errors:expect.arrayContaining([expect.objectContaining({path:'/dataSources/offices/source/query/queryModes/cases/b/filterBindings/site/when'})])});
  });
});
