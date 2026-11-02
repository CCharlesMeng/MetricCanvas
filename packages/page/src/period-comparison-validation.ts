import type {Page} from './page';
import type {TypedError} from './errors';
import {queryVariants} from './query-selection';
import {hasPeriodComparison} from './period-comparison';
import {flattenPageComponents} from './component-walk';
import {isObjectDqeItem} from './dqe-object';
import type {DqeFilterBinding, DqeQueryDefinition} from './query';
import {isPagedJoinQuery} from './paged-join-view';
import type {PagedJoinDataSource} from './paged-join';

type TimeBinding = Extract<DqeFilterBinding,{target:'time'}>;
export function periodComparisonErrors(page: Page): TypedError[] {
  const errors: TypedError[] = [];
  const combined=comparisonMemberContexts(page);
  const error = (path:string,message:string) => {errors.push({type:'SCHEMA_ERROR',path,message});};
  for (const variant of queryVariants(page)) {
   for (const [id,source] of Object.entries(variant.dataSources)) {
    if (source.source.type !== 'query' || !hasPeriodComparison(source.source.query)) continue;
    const path = `/dataSources/${id}/source`;
    if (combined.get(id)===false) error(path,'期间比较源不能作为此分页组合成员；请使用无 records 的查询分页组合');
    if (source.source.resultScope !== 'complete') error(path,'期间比较需要 resultScope: complete 的完整结果');
    for (const [filterId,binding] of Object.entries(source.source.query.filterBindings ?? {})) {
      if (binding.target === 'time' && binding.periodComparison) validateBinding(page,filterId,binding,source.source.query,`${path}/query/filterBindings/${filterId}`,error);
    }
    if (flattenPageComponents(page).some(c=>c.type==='table'&&c.data.main===id&&c.props.pagination?.mode==='query')) error(path,'期间比较源不允许查询分页；请在完整计算结果上分页');
  }
   errors.push(...comparisonGroupErrors(variant));
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

function comparisonMemberContexts(page:Page):Map<string,boolean> {
  const result=new Map<string,boolean>();
  for(const data of Object.values(page.dataSources)) {
    if(data.source.type!=='pagedJoin'&&data.source.type!=='pagedUnion')continue;
    const allowed=isPagedJoinQuery(data.source)&&!data.source.records;
    for(const member of Object.values(data.source.members))result.set(member.source,result.get(member.source)!==false&&allowed);
  }
  return result;
}

function comparisons(query:DqeQueryDefinition):Map<string,NonNullable<TimeBinding['periodComparison']>> {
  return new Map(Object.entries(query.filterBindings??{}).flatMap(([id,binding])=>binding.target==='time'&&binding.periodComparison?[[id,binding.periodComparison]]:[]));
}

function comparisonGroupErrors(page:Page):TypedError[] {
  const errors:TypedError[]=[];
  for(const [id,data] of Object.entries(page.dataSources)) {
    if(data.source.type!=='pagedJoin'||!isPagedJoinQuery(data.source)||data.source.records)continue;
    const source=data.source;
    const definitions=Object.entries(source.members).flatMap(([name,member])=>{
      const ref=page.dataSources[member.source];return ref?.source.type==='query'?[[name,ref.source.query] as const]:[];
    });
    if(!definitions.some(([,query])=>hasPeriodComparison(query)))continue;
    const domain=definitions.find(([name])=>name===source.domainMember);
    const expected=domain?comparisons(domain[1]):new Map();
    if(!expected.size)errors.push({type:'SCHEMA_ERROR',path:`/dataSources/${id}/source/domainMember`,message:'比较组合的业务行域必须绑定当期期间'});
    for(const [name,query] of definitions)validateComparisonMember(data as PagedJoinDataSource,name,comparisons(query),expected,`/dataSources/${id}/source/members/${name}`,errors);
  }
  return errors;
}

function validateComparisonMember(data:PagedJoinDataSource,name:string,actual:ReturnType<typeof comparisons>,expected:ReturnType<typeof comparisons>,path:string,errors:TypedError[]):void {
  const domain=name===data.source.domainMember;
  if(data.source.members[name].canSelectPage!==domain)errors.push({type:'SCHEMA_ERROR',path:`${path}/canSelectPage`,message:'期间比较只能由当期业务行域选页，历史成员用于补列'});
  const invalid=[...expected].some(([id,binding])=>{
    const value=actual.get(id);
    return !value||value.fact!==binding.fact||(domain?value.kind!=='current':value.kind==='current');
  });
  if(invalid||actual.size!==expected.size)errors.push({type:'SCHEMA_ERROR',path:`${path}/source`,message:'比较成员必须绑定相同期间筛选和可信截止事实；业务行域为当期，补列为上期或去年同期'});
}

export function comparisonJoinCapabilityPaths(document:unknown):string[] {
  const sources=record(record(document)?.dataSources)??{};
  return Object.entries(sources).flatMap(([id,value])=>{
    const source=record(record(value)?.source);
    if(source?.type!=='pagedJoin')return [];
    const used=Object.values(record(source.members)??{}).some(member=>declaresComparison(record(record(sources[String(record(member)?.source)])?.source)?.query));
    return used?[`/dataSources/${id}/source/members`]:[];
  });
}
