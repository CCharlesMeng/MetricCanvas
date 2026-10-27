import {queryFilterIds} from './amount-filter';
import type {Page} from './page';
import type {PagedJoinDataSource,PagedJoinSource,PagedJoinMember} from './paged-join';
import {hasQueryFieldMapping} from './field';
type ErrorReporter=(path:string,message:string)=>void;

export function recordFilterIds(source:PagedJoinSource,name:string):string[]{
  return Object.entries(source.records?.timeFilters??{}).filter(([,binding])=>source.projection[binding.field]?.member===name).map(([id])=>id);
}
export function memberFilterErrors(page:Page,source:PagedJoinSource,name:string,member:PagedJoinMember,filters:Set<string>,path:string,error:ErrorReporter):void{
  const ref=page.dataSources[member.source];
  if(ref?.source.type!=='query')return;
  const consumed=new Set([...Object.keys(ref.source.query.filterBindings??{}),...recordFilterIds(source,name)]);
  const excluded=member.notApplicableFilters??[];
  for(const id of filters)if(!consumed.has(id)&&!excluded.includes(id))error(`${path}/source`,'每个成员必须显式消费全部组合业务筛选');
  for(const id of excluded)if(!source.records||!filters.has(id)||consumed.has(id)||name===source.domainMember)error(`${path}/notApplicableFilters`,'不适用筛选须来自记录模式的其他成员，且不能同时消费');
  if(new Set(excluded).size!==excluded.length)error(`${path}/notApplicableFilters`,'不适用筛选不得重复');
}
export function recordJoinErrors(page:Page,data:PagedJoinDataSource,path:string,error:ErrorReporter):void{
  const source=data.source,records=source.records;
  if(!records)return;
  const key=data.fields[source.rowKey];
  if(!source.projection[source.rowKey]&&key?.type!=='string')error(`${path}/source/rowKey`,'自动记录标识必须是 string 维度');
  recordTimeFilterErrors(page,source,path,error);
}

function recordTimeFilterErrors(page:Page,source:PagedJoinSource,path:string,error:ErrorReporter):void{
  for(const [id,binding] of Object.entries(source.records!.timeFilters??{})){
    const location=`${path}/source/records/timeFilters/${id}`,filter=page.filters?.find(filter=>filter.id===id);
    const projection=source.projection[binding.field],member=projection&&source.members[projection.member];
    const input=member&&page.dataSources[member.source]?.fields[projection.field];
    if(filter?.type!=='timeRange'||filter.precision==='datetime')error(location,'记录时间筛选必须引用日或月精度的 timeRange 筛选器');
    if(!projection||projection.member!==source.domainMember||!input||!hasQueryFieldMapping(input)||!['string','date','datetime'].includes(input.type))error(location,'本地时间筛选必须引用主表的原始时间字段');
    const domain=source.members[source.domainMember],ref=domain&&page.dataSources[domain.source];
    if(ref?.source.type==='query'&&queryFilterIds(ref.source.query).includes(id))error(location,'本地时间筛选不能与主表查询绑定重复');
  }
}
