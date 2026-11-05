import {expect,it} from 'vitest';
import sample from '../../../pages/capabilities/table/table-header-filter-defaults-query.json';
import local from '../../../pages/capabilities/table/table-header-filter-defaults.json';
import join from '../fixtures/contract-valid/paged-join-query-page.json';
import {parsePage} from '../src/validate';
import {resolvePageParams} from '../src/resolve-page-params';
import {extractPageParams,applyPageParamSelection} from '../src/extract-page-params';
import {columnDefaultPaths} from '../src/table/columns';

function fixture(){return structuredClone(sample);}
const target=(raw:ReturnType<typeof fixture>)=>{
  const props=raw.sections[1].components[0].props;
  if(!('columns' in props))throw Error('parameter table fixture');
  return props.columns![2];
};
it('accepts exactly the confirmed select contract and capability paths',()=>{
  expect(parsePage(sample).ok).toBe(true);expect(parsePage(local).ok).toBe(true);
  const raw=fixture();expect(target(raw).filterable).toEqual({mode:'select',initialParam:'region-input',allBehavior:'unrestricted'});
  expect(columnDefaultPaths(raw,['initialParam','allBehavior'])).toEqual(['/sections/1/components/0/props/columns/2/filterable/initialParam','/sections/1/components/0/props/columns/2/filterable/allBehavior']);
  raw.schemaVersion='6.84';expect(parsePage(raw)).toMatchObject({ok:false,errors:expect.arrayContaining([expect.objectContaining({message:expect.stringContaining('6.85')})])});
});
it.each([
  {initialParam:'missing'}, {defaultValues:['东区']}, {initialParam:''}, {allBehavior:'all'},
])('rejects invalid same-level contract %j',patch=>{
  const raw=fixture();Object.assign(target(raw).filterable!,patch);expect(parsePage(raw).ok).toBe(false);
});
it('requires explicit enum for unrestricted and rejects non-select, non-main and numeric initialization',()=>{
  const raw=fixture(),column=target(raw);Reflect.deleteProperty(column,'enumValues');
  expect(parsePage(raw)).toMatchObject({ok:false,errors:expect.arrayContaining([expect.objectContaining({path:expect.stringContaining('/allBehavior')})])});
  const paths=[{filterable:{mode:'numberRange',initialParam:'region-input'}},{field:{data:'other',field:'region'}},{field:{byFilter:{filterId:'region',cases:{east:'region'}}}},{field:'amount'}];
  for(const patch of paths){const raw=fixture();Object.assign(target(raw),patch);expect(parsePage(raw).ok).toBe(false);}
});
it('requires dimension declaration and verifies dim_name against actual query mapping',()=>{
  const raw=fixture();raw.params.query.dimensions[0].dim_name='wrong';
  expect(parsePage(raw)).toMatchObject({ok:false,errors:expect.arrayContaining([expect.objectContaining({message:'维度参数 dim_name 必须与查询目标一致'})])});
  Object.assign(raw.params,{query:{},display:[{id:'region-input',type:'string',required:false}]});expect(parsePage(raw).ok).toBe(false);
});
it('rejects fixed bindings, in-place references and hidden filter control of the same target',()=>{
  const raw=fixture();const query=raw.dataSources['param-records'].source.query;
  Object.assign(query,{paramBindings:{'region-input':{target:'dimension',queryField:'区域'}}});expect(parsePage(raw).ok).toBe(false);
  Reflect.deleteProperty(query,'paramBindings');raw.params.query.dimensions[0].required=true;
  Object.assign(query.body.dsl_list[0].filter,{fields:[{field_name:'区域',operator:'=',value_list:{param:'region-input'}}]});
  expect(parsePage(raw).ok).toBe(false);
  query.body.dsl_list[0].filter.fields=[];
  Object.assign(raw,{filters:[{id:'hidden-region',type:'dimension',dimension:'区域',visible:false,initialParam:'region-input'}]});
  Object.assign(query,{paramBindings:{'region-input':{target:'dimension',queryField:'区域'}},filterBindings:{'hidden-region':{target:'dimension',queryField:'区域'}}});expect(parsePage(raw).ok).toBe(false);
});
it('keeps optional absence distinct from explicit invalid values and checks saved dictionary values',()=>{
  expect(resolvePageParams(sample).ok).toBe(true);
  for(const value of [[],['东区','东区'],['unknown'],[1],['["东区"]']])expect(resolvePageParams(sample,{'region-input':value})).toMatchObject({ok:false});
  const raw=fixture();Object.assign(raw.params.query.dimensions[0],{dim_value_list:['unknown']});expect(parsePage(raw).ok).toBe(false);
  const required=fixture();required.params.query.dimensions[0].required=true;expect(resolvePageParams(required)).toMatchObject({ok:false,issues:expect.arrayContaining([expect.objectContaining({code:'MISSING_INPUT'})])});
});
it('preserves header-only declarations through parameter extraction and applying an empty selection',()=>{
  const extracted=extractPageParams(sample,{baseline:'test-header-params'});expect(extracted.ok).toBe(true);
  if(!extracted.ok)return;
  const applied=applyPageParamSelection(extracted,[]);expect(applied.ok).toBe(true);
  if(applied.ok){expect(applied.document.params).toEqual(sample.params);expect(parsePage(applied.document).ok).toBe(true);}
});
it('rejects query-paged join defaults from different members after resolving actual parameter input',()=>{
  const raw=structuredClone(join);raw.schemaVersion='6.85';
  Object.assign(raw,{params:{query:{dimensions:[{id:'project-name',dim_name:'项目名称',dim_value_list:['项目甲'],required:false}]}}});
  const column=raw.sections[0].components[0].props.columns[1];Object.assign(column.filterable!,{initialParam:'project-name'});
  const parsed=parsePage(raw);expect(parsed.ok).toBe(true);
  const other=raw.sections[0].components[0].props.columns[3];Object.assign(other.filterable!,{defaultValues:['进行中']});expect(parsePage(raw).ok).toBe(false);
});
it('keeps ordinary detail tables read-only and rejects header initialization there',()=>{
  const raw=structuredClone(local),table=structuredClone(raw.sections[1].components[0]);table.id='detail-param-table';
  Object.assign(raw,{detailViews:[{id:'read-only-detail',mode:'snapshot',components:[table]}]});
  expect(parsePage(raw)).toMatchObject({ok:false,errors:expect.arrayContaining([expect.objectContaining({path:'/detailViews/0/components/0',message:'详情表格只支持展示、排序与本地分页'})])});
});
