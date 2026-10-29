import {canonicalizeJson,periodFact,type DisplayInputsSnapshot} from '@metriccanvas/page/internal';
import { candidateDependencies, filterDependencies, type DimensionFilterDeclaration, type FilterDeclaration } from '@metriccanvas/page/internal';
import type { FilterCandidatesRequest, FilterCandidate } from './ports';
import type { FilterValues } from './filter-values';

export function candidateContextKey(declaration:DimensionFilterDeclaration,declarations:readonly FilterDeclaration[],values:FilterValues,context:{displayInputs?:DisplayInputsSnapshot;filterRevision?:number;now?:Date}={}):string {
  const now=context.now??new Date();
  const ids=new Set<string>();const queue=filterDependencies(declaration);
  for(const id of queue)if(!ids.has(id)){ids.add(id);const parent=declarations.find(item=>item.id===id);if(parent)queue.push(...filterDependencies(parent));}
  const scope=declaration.candidateWindow?{window:declaration.candidateWindow,context:context.displayInputs?.permissionRevision,fact:declaration.candidateWindow.anchorFact?periodFact(context.displayInputs,declaration.candidateWindow.anchorFact,context.filterRevision):undefined,month:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`}:null;
  return JSON.stringify([scope,[...ids].sort().map(id=>{const value=values.get(id);return [id,value?.type==='dimension'?{...value,values:[...new Set(value.values)].sort()}:value??null];})]);
}
type CandidateContext = {now?:Date;displayInputs?:DisplayInputsSnapshot;filterRevision?:number};
function candidateDependencyIds(declaration:DimensionFilterDeclaration,declarations:readonly FilterDeclaration[]):Set<string> {
  const ids=new Set<string>(),queue=candidateDependencies(declaration);
  for(const id of queue)if(!ids.has(id)){
    ids.add(id);const parent=declarations.find(item=>item.id===id);
    if(parent)queue.push(...candidateDependencies(parent));
  }
  return ids;
}
function candidateConstraints(ids:Iterable<string>,values:FilterValues):FilterCandidatesRequest['constraints'] {
  const dimensions:Record<string,string[]>={},times:FilterCandidatesRequest['constraints']['times']={},booleans:Record<string,boolean>={};
  const mutableTimes=times as Record<string,{from:string;to:string;mode?:import('@metriccanvas/page/internal').TimeMode}>;
  for(const id of ids){
    const value=values.get(id);
    if(value?.type==='dimension'&&value.values.length){
      dimensions[value.dimension]=dimensions[value.dimension]?dimensions[value.dimension].filter(item=>value.values.includes(item)):[...new Set(value.values)].sort();
    }
    if(value?.type==='timePoint')mutableTimes[id]={from:value.value,to:value.value};
    if(value?.type==='timeRange')mutableTimes[id]={from:value.from,to:value.to,...(value.mode?{mode:value.mode}:{})};
    if(value?.type==='boolean')booleans[id]=value.value;
  }
  return {dimensions,times,...(Object.keys(booleans).length?{booleans}:{})};
}
function calendarWindow(declaration:DimensionFilterDeclaration,context:CandidateContext):FilterCandidatesRequest['calendarWindow'] {
  const window=declaration.candidateWindow;
  if(!window)return;
  let anchor:string;
  if(window.anchorFact){
    const fact=periodFact(context.displayInputs,window.anchorFact,context.filterRevision);
    if(fact.status!=='ready')throw Object.assign(new Error('月份候选锚点事实未就绪'),{code:'DQE_QUERY_REJECTED'});
    anchor=fact.latest.slice(0,7);
  }else{
    const now=context.now??new Date();anchor=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  }
  const [year,month]=anchor.split('-').map(Number);
  const end=year!*12+month!-1-(window.includeCurrent?0:1),start=end-window.n+1;
  if(start<12||end>119999)throw Object.assign(new Error('月份窗口超出四位公历年份范围'),{code:'DQE_QUERY_REJECTED'});
  const format=(index:number)=>`${String(Math.floor(index/12)).padStart(4,'0')}-${String(index%12+1).padStart(2,'0')}`;
  return {granularity:'month',from:format(start),to:format(end)};
}
export function filterCandidatesRequest(declaration:DimensionFilterDeclaration,declarations:readonly FilterDeclaration[],values:FilterValues,level?:string,context:CandidateContext={}):FilterCandidatesRequest {
  const window=calendarWindow(declaration,context);
  return {...(window?{calendarWindow:window}:{}),...(declaration.candidateWindow?.anchorFact?{permissions:{},values:{},permissionRevision:context.displayInputs?.permissionRevision,filterRevision:context.filterRevision,factRevision:canonicalizeJson(periodFact(context.displayInputs,declaration.candidateWindow.anchorFact,context.filterRevision))}:{}),filterId:declaration.id,dimension:declaration.hierarchy?.find(item=>item.id===level)?.dimension??declaration.dimension,...(level?{level}:{}),constraints:candidateConstraints(candidateDependencyIds(declaration,declarations),values)};
}
/** Validate a complete structural receipt before it can authorize a selection. */
export function validFilterCandidates(candidates:readonly FilterCandidate[],levels?:readonly string[]):boolean {
  if(candidates.length>10000)return false;
  const key=(level:string|undefined,value:string)=>JSON.stringify([level??null,value]);
  const nodes=new Map<string,FilterCandidate>();
  for(const node of candidates){
    if(!node||typeof node.value!=='string'||!node.value||typeof node.label!=='string'||(levels&&(!node.level||!levels.includes(node.level))))return false;
    const id=key(node.level,node.value);if(nodes.has(id))return false;nodes.set(id,node);
  }
  for(const node of candidates){
    const seen=new Set<string>();let current:FilterCandidate|undefined=node;
    while(current){const id=key(current.level,current.value);if(seen.has(id))return false;seen.add(id);if(!current.parent)break;
      if(!levels?.includes(current.parent.level))return false;
      current=nodes.get(key(current.parent.level,current.parent.value));if(!current)return false;
    }
  }
  return true;
}
