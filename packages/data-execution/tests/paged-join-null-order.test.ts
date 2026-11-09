import {describe,it,expect} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {dqeRecord,dqeDimensionConditions,hasQueryFieldMapping,type DataSnapshot,type JsonObject,type Page,type TableQueryView} from '@metriccanvas/page/internal';
import type {DataGateway} from '../src';
import {createSourceProgram,defaultSourceView} from '../src/runtime';
import document from '../../../pages/capabilities/table/paged-join-on-demand.json';
import {createPagedJoinPreview} from '../../../apps/playground/fixtures/query-join-gateway';
import {createDqeGateway} from '../src/dqe/dqe';

function pageForSort(direction:'asc'|'desc',defaults:boolean,nullable:boolean|undefined):Page{
  const parsed=parsePage(document);
  if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const member=parsed.page.dataSources['project-information'];
  if(member.source.type!=='query')throw Error('query');
  if(nullable===undefined)delete member.fields['contract-amount'].nullable;
  else member.fields['contract-amount'].nullable=nullable;
  if(defaults)member.source.query.body!.dsl_list[0].order={order_by_field:'合同金额',type:direction};
  return parsed.page;
}

async function read(page:Page,gateway:DataGateway,view:Partial<TableQueryView>,complete=false){
  const program=createSourceProgram(page,{gateway});
  let snapshot:DataSnapshot|undefined;
  try{
    for await(const update of program.read({roots:['projects'],conditions:new Map(),views:new Map([['projects',{...defaultSourceView(page,'projects'),...view}]]),purpose:complete?'complete':'screen'}))snapshot=update.snapshot;
  }finally{program.dispose();}
  if(snapshot?.status!=='ready')throw Error(JSON.stringify(snapshot));
  return snapshot;
}

function expectedKeys(nulls:string,direction:string){
  const missing=[1,12,23],present=Array.from({length:25},(_,index)=>index+1).filter(id=>!missing.includes(id));
  if(direction==='desc')present.reverse();
  const ordered=nulls==='first'?[...missing,...present]:[...present,...missing];
  return ordered.map(id=>`P${String(id).padStart(6,'0')}`);
}

describe.each(['first','last'])('query-paged join preserves backend nulls %s',nulls=>{
  it.each([
    {direction:'asc',defaults:false,nullable:true},
    {direction:'desc',defaults:false,nullable:undefined},
    {direction:'asc',defaults:true,nullable:undefined},
    {direction:'desc',defaults:true,nullable:true}
  ] as const)('pages and exports $direction with defaults=$defaults, nullable=$nullable',async({direction,defaults,nullable})=>{
    const page=pageForSort(direction,defaults,nullable),preview=createPagedJoinPreview(25,'ready',nulls);
    const view:Partial<TableQueryView>=defaults
      ?{sort:[],predicates:[{field:'project-status',op:'in',values:['已关闭','进行中']}]}
      :{sort:[{field:'contract-amount',direction}]};
    const expected=expectedKeys(nulls,direction),actual:string[]=[];
    for(const pageIndex of [0,1,2]){
      const snapshot=await read(page,preview.dataGateway,{...view,pageIndex});
      expect(snapshot.totalCount).toBe(25);
      expect(snapshot.rows.map(row=>row['project-id'])).toEqual(expected.slice(pageIndex*10,(pageIndex+1)*10));
      actual.push(...snapshot.rows.map(row=>String(row['project-id'])));
    }
    expect(actual).toEqual(expected);
    expect(new Set(actual).size).toBe(25);
    const exported=await read(page,preview.dataGateway,view,true);
    expect(exported.rows.map(row=>row['project-id'])).toEqual(expected);
    expect(exported.rows.filter(row=>row['contract-amount']===null)).toHaveLength(3);
    const selections=preview.calls.filter(query=>'contract-amount' in query.fieldMappings);
    expect(selections.map(query=>query.pagination?.offset)).toEqual([0,10,20,0,10,20]);
    expect(preview.calls.every(query=>query.pagination?.limit===10)).toBe(true);
  });
});

it.each([
  {object:false,field:'contract-amount',queryField:'合同金额'},
  {object:true,field:'contract-amount',queryField:'合同金额'},
  {object:false,field:'project-name',queryField:'项目名称'},
  {object:true,field:'project-name',queryField:'项目名称'}
])('preserves backend null and tied-key order through native DQE, object=$object, field=$field',async({object,field,queryField})=>{
  const page=pageForSort('desc',false,true);
  page.dataSources['project-approvals'].fields['project-name'].nullable=true;
  page.dataSources.projects.fields['project-name'].nullable=true;
  const source=page.dataSources.projects.source;
  if(source.type!=='pagedJoin')throw Error('pagedJoin');
  source.ordering.sortableFields.push('project-name');
  if(object)for(const source of Object.values(page.dataSources)){
    if(source.source.type!=='query')continue;
    source.source.query.body!.dsl_list[0]={query_type:'object',object_type:'Synthetic/Projects',output_fields:Object.values(source.fields).flatMap(field=>hasQueryFieldMapping(field)?[field.queryField]:[]),filter:{fields:[]},order:{}};
  }
  const requests:JsonObject[]=[];
  const gateway=createDqeGateway({fetchImpl:async(_url,init)=>{
    const items:JsonObject[]=JSON.parse(String(init?.body)).dsl_list;
    requests.push(...items);
    return Response.json({retCode:'CBC.0000',results:items.map(nativeReceipt)});
  }});
  const snapshot=await read(page,gateway,{pageSize:2,sort:[{field,direction:'desc'}]},true);
  expect(snapshot.rows.map(row=>[row['project-id'],row['contract-amount']])).toEqual([['P4',null],['P1',null],['P3',20],['P2',10]]);
  expect(snapshot.rows.map(row=>row['project-name'])).toEqual([null,null,'乙项目','甲项目']);
  expect(requests[0].order).toMatchObject({offset:0,limit:2,order_by_field:queryField,type:'desc'});
  expect(requests[2].order).toMatchObject({offset:2,limit:2,order_by_field:queryField,type:'desc'});
});

function nativeReceipt(item:JsonObject):JsonObject{
  const order=dqeRecord(item.order),keys=dqeDimensionConditions(item).find(condition=>condition.dim_name==='项目编号')?.dim_value_list;
  const records=[['P4',null,null],['P1',null,null],['P3',20,'乙项目'],['P2',10,'甲项目']].map(([id,amount,name])=>({'项目编号':id,'项目名称':name,'审批次数':1,'项目状态':'进行中','合同金额':amount}));
  const matching=records.filter(row=>!Array.isArray(keys)||keys.includes(row['项目编号']));
  return {code:'SUCCESS',total_count:matching.length,data:matching.slice(Number(order.offset),Number(order.offset)+Number(order.limit))};
}
