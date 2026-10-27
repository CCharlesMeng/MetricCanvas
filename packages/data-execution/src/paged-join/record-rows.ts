import {copyFieldFallback,hasQueryFieldMapping,dqeDefaultSort,isObjectDqeItem,calendarEndpoint,objectDateBoundary,timeFilterBoundaryError,validateCalendarTimeRange,validateTimePointValue,type Row,type EffectiveQuery} from '@metriccanvas/page/internal';
import type {PagedJoinPlan} from './plan';
import {rowFailure} from './rows';
import {validateRecordRows} from './record-batches';
type Key=string|number;
export function associationKey(plan:PagedJoinPlan,id:string,row:Row):Key{
  const field=plan.source.source.members[id].key.field,key=row[field];
  const type=plan.members.get(id)!.fields[field].type;
  if(typeof key!==type||(typeof key!=='string'&&typeof key!=='number')||(typeof key==='string'&&!key.trim())||(typeof key==='number'&&!Number.isFinite(key)))throw rowFailure('记录关联键缺失或类型错误');
  return key;
}
/** Read ordering is independent from the table view and respects the DQE sort contract. */
export function recordReadOrder(plan:PagedJoinPlan,id:string,query:EffectiveQuery):EffectiveQuery{
  if(!isObjectDqeItem(query.body.dsl_list[0])){
    if(query.sort?.length || dqeDefaultSort(query.body.dsl_list[0]).length)return query;
    return {...query,sort:[{queryField:plan.source.source.members[id].key.queryField,direction:'asc'}]};
  }
  const fields=Object.entries(plan.members.get(id)!.fields).filter(([,field])=>hasQueryFieldMapping(field)&&['string','number','money','date','datetime'].includes(field.type));
  return {...query,sort:fields.map(([,field])=>({queryField:hasQueryFieldMapping(field)?field.queryField:'',direction:'asc' as const}))};
}
export function projectRecordRows(plan:PagedJoinPlan,domain:Row[],members:Map<string,Map<Key,Row>>):Row[]{
  const source=plan.source.source,seen=new Set<unknown>();
  const rows=domain.map((input,index)=>{
    const key=associationKey(plan,source.domainMember,input),row:Row={};
    for(const [field,projection] of Object.entries(source.projection)){
      const raw=projection.member===source.domainMember?input:members.get(projection.member)?.get(key);
      row[field]=raw?.[projection.field]??null;
      copyFieldFallback(raw,projection.field,row,field);
    }
    if(!source.projection[source.rowKey])row[source.rowKey]=String(index).padStart(12,'0');
    if(source.ordinalField)row[source.ordinalField]=0;
    const identity=row[source.rowKey];
    if(identity==null||seen.has(identity))throw rowFailure('审批记录行标识重复或缺失');
    seen.add(identity);return row;
  });
  validateRecordRows(rows,plan.source.fields);
  return rows;
}
export function filterRecordTimes(plan:PagedJoinPlan,rows:Row[],domain=false):Row[]{
  let result=rows;
  for(const [id,binding] of Object.entries(plan.source.source.records!.timeFilters??{})){
    const range=recordTimeRange(plan,id,binding.valueFormat);
    if(!range)continue;
    const {from,to}=range;
    result=result.filter(row=>{
      const field=domain?plan.source.source.projection[binding.field].field:binding.field;
      const date=row[field];
      if(date==null)return false;
      if(typeof date!=='string')throw rowFailure('审批时间字段必须是字符串');
      assertDateFormat(date,binding.valueFormat);
      return date>=from&&date<=to;
    });
  }
  return result;
}

function recordDateBoundary(value:string,end:boolean,format:'iso'|'compact'|'datetime'):string{
  const endpoint=calendarEndpoint(value,end);
  return objectDateBoundary(endpoint,end,format);
}

function recordTimeRange(plan:PagedJoinPlan,id:string,format:'iso'|'compact'|'datetime'){
  const value=plan.conditions.get(id),declaration=plan.page.filters?.find(filter=>filter.id===id);
  if(!value){if(declaration?.type==='timeRange'&&declaration.required)throw rowFailure('必需的审批期间尚未就绪');return;}
  if(value.type!=='timeRange'||declaration?.type!=='timeRange')throw rowFailure('审批期间必须是时间范围');
  if(validateCalendarTimeRange(value,declaration.precision??'date').length||timeFilterBoundaryError(declaration,value,plan.now??new Date()))throw rowFailure('审批期间范围无效');
  return {from:recordDateBoundary(value.from,false,format),to:recordDateBoundary(value.to,true,format)};
}
function assertDateFormat(value:string,format:'iso'|'compact'|'datetime'):void{
  const date=format==='compact'?value.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'):value;
  const pattern=format==='datetime'?/^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/:/^\d{4}-\d{2}-\d{2}$/;
  if(!pattern.test(date)||validateTimePointValue(date.slice(0,10),'date'))throw rowFailure('审批时间不符合声明的日历格式');
}
