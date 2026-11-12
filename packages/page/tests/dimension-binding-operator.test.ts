import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {parsePage} from '../src/validate';
const document=()=>JSON.parse(readFileSync('pages/capabilities/filters/dimension-binding-operator.json','utf8'));
it('accepts omitted, explicit inclusion, exclusion and hierarchical exclusion without mutating input',()=>{
  const input=document(),saved=structuredClone(input);
  expect(parsePage(input)).toMatchObject({ok:true});expect(input).toEqual(saved);
});
it.each(['in','notIn','<>','eq',true,null])('rejects unsupported dimension operator %j',operator=>{
  const input=document();input.dataSources.excluded.source.query.filterBindings.area.operator=operator;
  expect(parsePage(input).ok).toBe(false);
});
it.each(['=', '!='])('gates explicit %s at 6.114 while historical omission remains valid',operator=>{
  const input=document();input.schemaVersion='6.113';
  for(const source of Object.values(input.dataSources) as any[])for(const binding of Object.values(source.source.query.filterBindings) as any[])delete binding.operator;
  expect(parsePage(input).ok).toBe(true);
  input.dataSources.hierarchy.source.query.filterBindings.organization.operator=operator;
  expect(parsePage(input)).toMatchObject({ok:false,errors:expect.arrayContaining([expect.objectContaining({message:expect.stringContaining('6.114')})])});
});
it('checks operator in every queryModes case',()=>{
  const input=document(),query=input.dataSources.excluded.source.query;
  input.filters.push({id:'mode',type:'dimension',dimension:'mode',default:['a'],options:[{label:'A',value:'a'},{label:'B',value:'b'}],selection:{mode:'single',required:true}});
  input.dataSources.excluded.source.query={language:'dqe',queryModes:{filterId:'mode',cases:{a:{body:query.body,filterBindings:query.filterBindings},b:structuredClone({body:query.body,filterBindings:query.filterBindings})}}};
  expect(parsePage(input).ok).toBe(true);
  input.dataSources.excluded.source.query.queryModes.cases.b.filterBindings.area.operator='>';
  expect(parsePage(input).ok).toBe(false);
});
it('does not expose dimension comparison on other binding targets',()=>{
  const input=JSON.parse(readFileSync('pages/capabilities/filters/filter-binding-when.json','utf8'));
  input.schemaVersion='6.114';input.filters.push({id:'active',type:'boolean',label:'生效'});
  input.dataSources.offices.source.query.filterBindings.active={target:'boolean',queryField:'flag',whenTrue:['Y'],operator:'!='};
  expect(parsePage(input).ok).toBe(false);
});
it('gates operators inside timeModes cases as well as ordinary queries',()=>{
  const input=JSON.parse(readFileSync('packages/page/fixtures/contract-valid/time-modes-page.json','utf8'));
  input.schemaVersion='6.114';
  input.filters.push({id:'area',type:'dimension',dimension:'demo_area',default:['北区']});
  const source=input.dataSources[Object.keys(input.dataSources)[0]];
  source.source.query.timeModes.cases.month.filterBindings.area={target:'dimension',queryField:'区域',operator:'!='};
  expect(parsePage(input).ok).toBe(true);
  input.schemaVersion='6.113';
  expect(parsePage(input)).toMatchObject({ok:false,errors:expect.arrayContaining([expect.objectContaining({message:expect.stringContaining('6.114')})])});
});
