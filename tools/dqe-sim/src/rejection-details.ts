import {sortDqeRows} from './sort';
import type {DqeSimItemResult} from './execute';

type Row=Record<string,string|null>;
type RecordValue=Record<string,unknown>;
const objectType='Business/Commercial Review Rejection Details';
const basicFields=['商务ID','责任人名称','商务状态'];
const offices=[
  ['R99','CN-EAST','SH-01','模拟华东地区部','模拟上海代表处'],
  ['R99','CN-NORTH','BJ-01','模拟华北地区部','模拟北京代表处'],
  ['R99','CN-SOUTH','GD-01','模拟华南地区部','模拟广东代表处'],
  ['TBD-APAC','APAC','SG-01','模拟亚太地区部','模拟新加坡代表处']
];
const record=(value:unknown):value is RecordValue=>!!value&&typeof value==='object'&&!Array.isArray(value);
const failure=():DqeSimItemResult=>({code:'DQE_SIM_UNSUPPORTED_QUERY',retDesc:'商务驳回明细模拟查询不支持此声明',data:[],total_count:0,dqe:{columns:[],orders:[],limit:-1,offset:-1,sql:null}});

/** Synthetic only: 1205 September approvals, 8 October approvals, one missing basic match. */
export function rejectionSimRows():Row[]{
  return Array.from({length:1213},(_,index)=>{
    const october=index>=1205,local=october?index-1205:index;
    const business=(october?10000:0)+Math.floor(local/2),office=offices[business%4];
    return {'商务ID':`SIM-${String(business).padStart(5,'0')}`,'商务编码':`SIM-BIZ-${String(business).padStart(5,'0')}`,
      geo_pc_code:office[0],region_dept_code:office[1],rep_office_code:office[2],'地区部':office[3],'代表处':office[4],
      '审批完成时间':`2026-${october?'10':'09'}-${String(local%28+1).padStart(2,'0')} 12:00:00`,
      '审批结果':'驳回','审批意见':local%2?'模拟：请补充审批材料':'模拟：商务方案需完善','审批人姓名':'模拟评审组织人',
      '阶段名称':local%2?'复审':'初审','责任人名称':['模拟张三','模拟李四','模拟王五','模拟赵六'][business%4],
      '商务状态':['进行中','已关闭','已取消'][business%3]};
  });
}
const approvals=rejectionSimRows();
const basics=[...new Map(approvals.map(row=>[row['商务ID'],row])).values()].filter(row=>row['商务ID']!=='SIM-00000');

function isBasicQuery(input:RecordValue):boolean{
  const dims=input.output_dims,metrics=input.output_metrics;
  return input.query_type===undefined&&Array.isArray(dims)&&dims.length===3&&basicFields.every(field=>dims.includes(field))&&Array.isArray(metrics)&&metrics.length===0;
}
function outputFields(input:RecordValue,object:boolean):string[]{
  const output=object?input.output_fields:input.output_dims;
  if(!Array.isArray(output)||!output.length||output.some(field=>typeof field!=='string'||!Object.hasOwn(approvals[0],field)))throw Error('output');
  return output;
}

/** Exact object/basic signatures keep this simulation out of other business queries. */
export function executeRejectionDetails(input:unknown):DqeSimItemResult|undefined{
  if(!record(input))return;
  const object=input.query_type==='object'&&input.object_type===objectType;
  const basic=isBasicQuery(input);
  if(!object&&!basic)return;
  try{
    const output=outputFields(input,object);
    const filter=input.filter===undefined?{}:input.filter;
    if(!record(filter))return failure();
    const conditions=(object?filter.fields:filter.dims)??[];
    if(!Array.isArray(conditions))return failure();
    const rows=(object?approvals:basics).filter(row=>conditions.every(condition=>matches(row,condition,object)));
    return windowResult(input,rows,output);
  }catch{return failure();}
}
function matches(row:Row,condition:unknown,object:boolean):boolean{
  if(!record(condition))throw Error('condition');
  const name=String(object?condition.field_name:condition.dim_name),values=object?condition.value_list:condition.dim_value_list;
  if(!Object.hasOwn(row,name)||!Array.isArray(values))throw Error('field');
  const operator=condition.operator??'=',value=row[name];
  if(operator==='=')return condition.is_exclude===true?!values.includes(value):values.includes(value);
  if(values.length!==1||typeof value!=='string'||typeof values[0]!=='string')throw Error('range');
  if(operator==='>=')return value>=values[0];
  if(operator==='<=')return value<=values[0];
  throw Error('operator');
}
function windowResult(input:RecordValue,rows:Row[],output:string[]):DqeSimItemResult{
  const order=input.order??{};
  if(!record(order))return failure();
  const sorted=sortDqeRows(rows,order,output);
  if(!sorted)return failure();
  const offset=Number(order.offset??0),limit=Number(order.limit??Math.max(1,rows.length));
  if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1)return failure();
  return {code:'SUCCESS',data:sorted.slice(offset,offset+limit).map(row=>Object.fromEntries(output.map(field=>[field,row[field]]))),total_count:rows.length,dqe:{columns:[],orders:[],limit,offset,sql:null}};
}
