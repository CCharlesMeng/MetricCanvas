import {expect,it} from 'vitest';
import completeJoin from '../../page/fixtures/contract-valid/paged-join-page.json';
import queryJoin from '../../../pages/capabilities/table/paged-join-on-demand.json';
import union from '../../page/fixtures/contract-valid/paged-union-page.json';
import {resolvePageParams,type PageDocument} from '@metriccanvas/page';
import {flattenPageComponents,type Page,type DataSnapshot,type TableQueryView} from '@metriccanvas/page/internal';
import {initialTableViews,initialFilterValues,createSourceProgram} from '../src/runtime';
import {officeGateway} from './fixtures/office-gateway';
import {createPagedJoinPreview} from '../../../apps/playground/fixtures/query-join-gateway';
import {createUnionPreview} from '../../../apps/playground/fixtures/decision-opinion/union-gateway';
import type {DataGateway} from '../src';
function document(input:unknown,root:string,field:string,name:string,value:string):PageDocument{
  const raw=structuredClone(input) as PageDocument;raw.schemaVersion='6.85';
  raw.params={query:{dimensions:[{id:'header-input',dim_name:name,required:false,dim_value_list:[value]}]}};
  const table=flattenPageComponents(raw).find(node=>node.type==='table'&&node.data.main===root);
  if(table?.type!=='table')throw Error('table');
  const column=table.props.columns.find(column=>column.kind!=='group'&&column.field===field);
  if(!column||column.kind==='group')throw Error('column');
  column.filterable={mode:'select',initialParam:'header-input'};
  return raw;
}
function resolved(raw:PageDocument):Page{
  const result=resolvePageParams(raw);if(!result.ok)throw Error(JSON.stringify(result.issues));return result.resolvedPage;
}
async function read(page:Page,root:string,gateway:DataGateway,view?:TableQueryView,purpose:'screen'|'complete'='screen'){
  const conditions=initialFilterValues(page.filters??[]);
  const initialization=initialTableViews(page,{declarations:page.filters??[],filters:conditions});
  const views=view?new Map([[root,view]]):initialization.views;
  const program=createSourceProgram(page,{gateway});let snapshot:DataSnapshot|undefined;
  try{for await(const update of program.read({roots:[root],conditions,views,purpose}))if(update.sourceId===root)snapshot=update.snapshot;return {snapshot,view:views.get(root)!};}finally{program.dispose();}
}
it('parameter predicates filter the full complete-join population and complete export',async()=>{
  const page=resolved(document(completeJoin,'office-overview','rep-office-name','rep_office_name','天津代表处'));
  for(const purpose of ['screen','complete'] as const){
    const result=await read(page,'office-overview',officeGateway(),undefined,purpose);
    expect(result.snapshot).toMatchObject({status:'ready',totalCount:1,rows:[{'rep-office-name':'天津代表处'}]});
  }
});
it('query-paged join applies the parameter on the first selection and later member operations replace it',async()=>{
  const page=resolved(document(queryJoin,'projects','project-name','项目名称','测试项目7')),preview=createPagedJoinPreview();
  const result=await read(page,'projects',preview.dataGateway);
  expect(result.snapshot).toMatchObject({status:'ready',totalCount:1,rows:[{'project-name':'测试项目7'}]});
  expect(preview.calls[0].tableFilters).toEqual([{target:'dimension',queryField:'项目名称',values:['测试项目7']}]);
  const program=createSourceProgram(page,{gateway:preview.dataGateway});
  const next=program.prepareView('projects',new Map(),{...result.view,sort:[],predicates:[...result.view.predicates,{field:'project-status',op:'in',values:['已关闭']}]},'project-status');
  expect(next.predicates).toEqual([{field:'project-status',op:'in',values:['已关闭']}]);program.dispose();
});
it('query-paged join refuses an incapable initial owner before requesting data',async()=>{
  const page=resolved(document(queryJoin,'projects','project-name','项目名称','测试项目7')),preview=createPagedJoinPreview();
  const source=page.dataSources.projects.source;if(source.type!=='pagedJoin')throw Error('join');source.members.a.canSelectPage=false;
  const result=await read(page,'projects',preview.dataGateway);expect(result.snapshot).toMatchObject({status:'error',error:{code:'DQE_QUERY_REJECTED'}});expect(preview.calls).toEqual([]);
});
it('pagedUnion consumes a header-only parameter for a projected constant without inventing a DQE mapping',async()=>{
  const page=resolved(document(union,'opinions','businessType','业务类型','合同')),preview=createUnionPreview({generatedCount:0});
  for(const purpose of ['screen','complete'] as const){
    const result=await read(page,'opinions',preview.dataGateway,undefined,purpose);
    expect(result.snapshot?.status).toBe('ready');
    if(result.snapshot?.status==='ready')expect(result.snapshot.rows.every(row=>row.businessType==='合同')).toBe(true);
  }
});
it('header-only parameter changes invalidate combination initial without losing unrelated member initial',()=>{
  const raw=document(queryJoin,'projects','project-name','项目名称','测试项目7');
  Object.assign(raw.dataSources.projects.source,{initial:{capturedAt:'2026-11-04T00:00:00Z',rows:[],totalCount:0,view:{pageIndex:0,pageSize:10,sort:[{field:'approval-count',direction:'desc'}],predicates:[]}}});
  Object.assign(raw.dataSources['project-information'].source,{initial:{capturedAt:'2026-11-04T00:00:00Z',rows:[],totalCount:0}});
  const same=resolvePageParams(raw);expect(same.ok).toBe(true);if(same.ok)expect(same.document.dataSources.projects.source).toHaveProperty('initial');
  const changed=resolvePageParams(raw,{'header-input':['测试项目8']});expect(changed.ok).toBe(true);
  if(changed.ok){expect(changed.document.dataSources.projects.source).not.toHaveProperty('initial');expect(changed.document.dataSources['project-information'].source).toHaveProperty('initial');expect(initialTableViews(changed.resolvedPage,{declarations:[],filters:new Map()}).views.get('projects')?.predicates).toEqual([{field:'project-name',op:'in',values:['测试项目8']}]);}
});
