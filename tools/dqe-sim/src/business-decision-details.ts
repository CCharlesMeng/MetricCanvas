import fixture from '../fixtures/business-decision-details.json';
import {sortDqeRows} from './sort';
import type {DqeSimItemResult} from './execute';

type Row=Record<string,string>;
type Item=Record<string,unknown>;
const record=(value:unknown):value is Item=>!!value&&typeof value==='object'&&!Array.isArray(value);
const failure=():DqeSimItemResult=>({code:'DQE_SIM_UNSUPPORTED_QUERY',retDesc:'商务决策明细仿真不支持此查询条件',data:[],total_count:0,dqe:{columns:[],orders:[],limit:-1,offset:-1,sql:null}});

/** Only the supplied business object's exact query signatures belong to this fixture. */
export function executeBusinessDecisionDetails(input:unknown):DqeSimItemResult|undefined{
  if(!record(input))return;
  const object=input.query_type==='object'&&input.object_type===fixture.objectType;
  const basic=input.query_type===undefined&&JSON.stringify(input.output_dims)===JSON.stringify(fixture.basicFields);
  if(!object&&!basic)return;
  try{
    const fields=outputFields(input,object),filter=input.filter;
    if(!record(filter))return failure();
    const conditions=object?filter.fields:filter.dims;
    if(!Array.isArray(conditions))return failure();
    if(!object&&!emptyMetrics(input,filter))return failure();
    const rows:Row[]=object?fixture.approvals:fixture.basics;
    return windowResult(input,rows.filter(row=>conditions.every(condition=>matches(row,condition,object))),fields);
  }catch{return failure();}
}
function emptyMetrics(input:Item,filter:Item):boolean{
  return JSON.stringify(input.output_metrics)==='[]'&&JSON.stringify(filter.metrics)==='[]';
}
function outputFields(input:Item,object:boolean):string[]{
  const fields=object?input.output_fields:input.output_dims;
  const allowed=object?fixture.approvalFields:fixture.basicFields;
  if(!Array.isArray(fields)||!fields.length||fields.some(field=>typeof field!=='string'||!allowed.includes(field)))throw Error('fields');
  return fields;
}
function matches(row:Row,raw:unknown,object:boolean):boolean{
  if(!record(raw))throw Error('condition');
  const name=object?raw.field_name:raw.dim_name,values=object?raw.value_list:raw.dim_value_list;
  if(typeof name!=='string'||!Object.hasOwn(row,name)||!Array.isArray(values))throw Error('field');
  const value=row[name],operator=raw.operator??'=';
  if(operator==='=')return raw.is_exclude===true?!values.includes(value):values.includes(value);
  if(values.length!==1||typeof values[0]!=='string'||raw.is_exclude===true)throw Error('range');
  if(operator==='>=')return value>=values[0];
  if(operator==='<=')return value<=values[0];
  throw Error('operator');
}
function windowResult(input:Item,rows:Row[],fields:string[]):DqeSimItemResult{
  if(!record(input.order))return failure();
  const sorted=sortDqeRows(rows,input.order,fields);
  if(!sorted)return failure();
  const offset=input.order.offset??0,limit=input.order.limit??Math.max(1,rows.length);
  if(typeof offset!=='number'||!Number.isSafeInteger(offset)||offset<0)return failure();
  if(typeof limit!=='number'||!Number.isSafeInteger(limit)||limit<1)return failure();
  return {code:'SUCCESS',data:sorted.slice(offset,offset+limit).map(row=>Object.fromEntries(fields.map(field=>[field,row[field]]))),total_count:rows.length,dqe:{columns:[],orders:[],limit,offset,sql:null}};
}
