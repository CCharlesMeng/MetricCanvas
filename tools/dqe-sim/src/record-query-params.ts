import fixture from '../fixtures/record-query-params.json';
import {sortDqeRows} from './sort';
import type {DqeSimItemResult} from './execute';

type RecordValue=Record<string,unknown>;
type RawRow=Record<string,string|number>;
const record=(value:unknown):value is RecordValue=>!!value&&typeof value==='object'&&!Array.isArray(value);
const failure=():DqeSimItemResult=>({
  code:'DQE_SIM_UNSUPPORTED_QUERY',data:[],total_count:0,retDesc:'审批人参数模拟查询不支持此声明',
  dqe:{columns:[],orders:[],limit:-1,offset:-1,sql:null}
});

/** Exact object and supplemental signatures; all rows stay in the simulator. */
export function executeRecordQueryParams(input:unknown):DqeSimItemResult|undefined{
  if(!record(input))return;
  const object=input.query_type==='object'&&input.object_type===fixture.objectType;
  const basic=input.query_type===undefined&&JSON.stringify(input.output_dims)===JSON.stringify(fixture.basicFields);
  if(!object&&!basic)return;
  try{
    const fields=outputFields(input,object),filter=input.filter;
    if(!record(filter))return failure();
    const conditions=object?filter.fields:filter.dims;
    if(!Array.isArray(conditions))return failure();
    if(!object&&JSON.stringify(input.output_metrics)!=='[]')return failure();
    if(!object&&JSON.stringify(filter.metrics)!=='[]')return failure();
    const source:RawRow[]=object?fixture.approvals:fixture.basics;
    const rows=source.filter(row=>conditions.every(condition=>matches(row,condition,fields,object)));
    return windowResult(input,rows,fields);
  }catch{return failure();}
}
function outputFields(input:RecordValue,object:boolean):string[]{
  const fields=object?input.output_fields:input.output_dims;
  const allowed=object?fixture.approvalFields:fixture.basicFields;
  if(!Array.isArray(fields)||!fields.length||fields.some(field=>typeof field!=='string'||!allowed.includes(field)))throw new Error('fields');
  return fields;
}
function matches(row:RawRow,condition:unknown,fields:string[],object:boolean):boolean{
  if(!record(condition))throw new Error('condition');
  const name=object?condition.field_name:condition.dim_name;
  const values=object?condition.value_list:condition.dim_value_list;
  if(typeof name!=='string'||!fields.includes(name)||!Array.isArray(values))throw new Error('predicate');
  if((condition.operator??'=')!=='='||condition.is_exclude===true)throw new Error('operator');
  return values.includes(row[name]);
}
function windowResult(input:RecordValue,rows:RawRow[],fields:string[]):DqeSimItemResult{
  const order=input.order;
  if(!record(order))return failure();
  const sorted=sortDqeRows(rows,order,fields);
  if(!sorted)return failure();
  const offset=order.offset??0,limit=order.limit??Math.max(1,rows.length);
  if(typeof offset!=='number'||!Number.isSafeInteger(offset)||offset<0) return failure();
  if(typeof limit!=='number'||!Number.isSafeInteger(limit)||limit<1) return failure();
  return {code:'SUCCESS',data:sorted.slice(offset,offset+limit).map(row=>Object.fromEntries(fields.map(field=>[field,row[field]]))),
    total_count:rows.length,dqe:{columns:[],orders:[],limit,offset,sql:null}};
}
