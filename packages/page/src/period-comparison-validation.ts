import type {Page} from './page';
import type {TypedError} from './errors';
import {queryVariants} from './query-selection';
import {hasPeriodComparison} from './period-comparison';
import {flattenPageComponents} from './component-walk';
import {isObjectDqeItem} from './dqe-object';
import type {DqeFilterBinding, DqeQueryDefinition} from './query';

type TimeBinding = Extract<DqeFilterBinding,{target:'time'}>;
export function periodComparisonErrors(page: Page): TypedError[] {
  const errors: TypedError[] = [];
  const error = (path:string,message:string) => {errors.push({type:'SCHEMA_ERROR',path,message});};
  for (const variant of queryVariants(page)) for (const [id,source] of Object.entries(variant.dataSources)) {
    if (source.source.type !== 'query' || !hasPeriodComparison(source.source.query)) continue;
    const path = `/dataSources/${id}/source`;
    if (combinedMembers(page).has(id)) error(path,'期间比较源不能作为分页组合成员；请以完整计算结果作为表格数据源');
    if (source.source.resultScope !== 'complete') error(path,'期间比较需要 resultScope: complete 的完整结果');
    for (const [filterId,binding] of Object.entries(source.source.query.filterBindings ?? {})) {
      if (binding.target === 'time' && binding.periodComparison) validateBinding(page,filterId,binding,source.source.query,`${path}/query/filterBindings/${filterId}`,error);
    }
    if (flattenPageComponents(page).some(c=>c.type==='table'&&c.data.main===id&&c.props.pagination?.mode==='query')) error(path,'期间比较源不允许查询分页；请在完整计算结果上分页');
  }
  return errors;
}
function validateBinding(page:Page,id:string,binding:TimeBinding,query:DqeQueryDefinition,path:string,error:(path:string,message:string)=>void):void {
  const filter = page.filters?.find(filter=>filter.id===id);
  if (filter?.type!=='timeRange'||filter.display!=='period') error(path,'期间比较必须绑定 display=period 的时间筛选');
  if (binding.window||binding.periodPolicy) error(path,'期间比较不能与 window 或 periodPolicy 同时声明');
  const item=query.body!.dsl_list[0];
  const config=item.filter as {time?:Record<string,unknown>}|undefined;
  if (!binding.queryField && !isObjectDqeItem(item) && config?.time?.period!=='day') error(path,'相同统计进度比较需要显式日粒度 filter.time.period=day');
  if (config?.time && ['start','end','param','window'].some(key=>key in config.time!)) error(path,'期间比较不能同时声明固定时间或时间参数');
  if (item.order && typeof item.order==='object' && ('limit' in item.order || 'offset' in item.order)) error(path,'期间比较源不能携带查询窗口');
}
/** Inspect only declaration positions, never opaque request bodies or business rows. */
export function comparisonCapabilityPaths(document: unknown): string[] {
  const found:string[]=[];
  for(const [id,value] of Object.entries(record(record(document)?.dataSources)??{})) {
    const source=record(value);
    if(declaresComparison(record(source?.source)?.query))found.push(`/dataSources/${id}/source/query`);
    if(Array.isArray(source?.compute))source.compute.forEach((value,index)=>{
      const op=record(value);
      if(op?.op==='joinAggregate'&&Array.isArray(op.values)&&op.values.some(value=>record(value)?.onMissing!==undefined))found.push(`/dataSources/${id}/compute/${index}/values`);
    });
  }
  return found;
}
function record(value:unknown):Record<string,unknown>|undefined {
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined;
}
function declaresComparison(value:unknown):boolean {
  const query=record(value);
  if(!query)return false;
  if(Object.values(record(query.filterBindings)??{}).some(value=>{
    const binding=record(value);return binding?.target==='time'&&binding.periodComparison!==undefined;
  }))return true;
  return ['queryModes','timeModes'].some(key=>Object.values(record(record(query[key])?.cases)??{}).some(declaresComparison));
}

function combinedMembers(page:Page):Set<string> {
  return new Set(Object.values(page.dataSources).flatMap(source=>source.source.type==='pagedJoin'||source.source.type==='pagedUnion'?Object.values(source.source.members).map(member=>member.source):[]));
}
