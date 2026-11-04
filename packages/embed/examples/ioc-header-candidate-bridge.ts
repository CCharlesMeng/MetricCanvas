import type {Page,PageDocument,DqeQueryDefinition,BooleanFilterDeclaration} from '@metriccanvas/page/internal';
import type {RuntimeDataGateway,FilterCandidate} from '@metriccanvas/engine';

/** Copyable integration example, not an embed public API. Upstream response formats belong to the Adapter. */
export async function prepareIocHeaderFilters(document:unknown,gateway:RuntimeDataGateway,options:{signal:AbortSignal}):Promise<PageDocument> {
  const page=structuredClone(document) as PageDocument;
  if(!page||typeof page!=='object'||!page.dataSources)throw new Error('IOC 页面声明无效');
  for(const filter of keyOfficeFilters(page)){
    const names=await keyOfficeNames(filter,gateway,options.signal);
    bindKeyOfficeQueries(page,filter,names);
  }
  return page;
}
function keyOfficeFilters(page:Pick<Page,'filters'|'iocHeader'|'sections'>):BooleanFilterDeclaration[] {
  const first=page.sections?.[0]?.components?.[0];
  const header=page.iocHeader??(first?.type==='iocHeader'?first.props:undefined);
  return (page.filters??[]).filter((filter):filter is BooleanFilterDeclaration=>filter.type==='boolean'&&!!filter.overridesFilters?.includes('region')&&!!header?.filterIds?.includes(filter.id));
}
async function keyOfficeNames(filter:BooleanFilterDeclaration,gateway:RuntimeDataGateway,signal:AbortSignal):Promise<string[]> {
  signal.throwIfAborted();
  if(!gateway.fetchFilterCandidates)throw unavailable();
  const result=await gateway.fetchFilterCandidates({filterId:filter.id,dimension:'rep-office-name',constraints:{dimensions:{},times:{},booleans:{[filter.id]:true}}},{signal});
  signal.throwIfAborted();
  if(result.kind!=='values')throw unavailable();
  return memberNames(result.candidates);
}
function validMember(candidate:FilterCandidate):boolean {
  return !!candidate&&typeof candidate.value==='string'&&candidate.value.length>0&&typeof candidate.label==='string'&&candidate.parent===undefined&&candidate.level===undefined&&(candidate.disabled===undefined||typeof candidate.disabled==='boolean');
}
function memberNames(candidates:FilterCandidate[]):string[] {
  if(!Array.isArray(candidates)||candidates.length>10000)throw unavailable();
  const seen=new Set<string>(),names:string[]=[];
  for(const candidate of candidates){
    if(!validMember(candidate)||seen.has(candidate.value))throw unavailable();
    seen.add(candidate.value);if(!candidate.disabled)names.push(candidate.value);
  }
  return names;
}
function unavailable():Error {return Object.assign(new Error('当前授权重点国代完整名单尚未就绪'),{code:'DQE_CONFIG_ERROR'});}
function bindKeyOfficeQueries(page:PageDocument,filter:BooleanFilterDeclaration,names:string[]):void {
  for(const source of Object.values(page.dataSources)){
    if(source.source.type!=='query')continue;
    const query=source.source.query;
    const leaves=query.queryModes?.cases??query.timeModes?.cases??{ordinary:query};
    for(const leaf of Object.values(leaves))bindKeyOfficeQuery(leaf,filter,names);
  }
}
function bindKeyOfficeQuery(query:Pick<DqeQueryDefinition,'filterBindings'>,filter:BooleanFilterDeclaration,names:string[]):void {
  if(!filter.overridesFilters?.some(id=>query.filterBindings?.[id]))return;
  query.filterBindings![filter.id]={target:'boolean',queryField:'代表处',whenTrue:[...names]};
}
