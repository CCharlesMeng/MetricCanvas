import { candidateDependencies, canonicalizeJson, sourceCandidateErrors, type DimensionFilterDeclaration, type Page, type Row, type DataSnapshot, type DisplayInputsSnapshot } from '@metriccanvas/page/internal';
import { SourceRangeError } from './source-program/range-policy';
import { createSourceProgram } from './source-program/session';
import type { FilterValue, FilterValues } from './filter-values';
import type { FilterCandidate, FilterCandidatesRequest, RuntimeDataGateway } from './ports';

const owner=Symbol('sourceCandidatePage');
type Context={displayInputs?:()=>DisplayInputsSnapshot|undefined;filterRevision?:()=>number;clock?:()=>Date;now?:Date};
/** The same candidate port serves controls, headless reads and frozen exports. */
export function sourceCandidatesGateway(page:Page,base:RuntimeDataGateway,context:Context={}):RuntimeDataGateway {
  if((base as RuntimeDataGateway & {[owner]?:Page})[owner]===page||!page.filters?.some(filter=>filter.type==='dimension'&&filter.candidates))return base;
  const gateway:RuntimeDataGateway={...base,fetchData:base.fetchData.bind(base),
    ...(base.fetchDimensionValues?{fetchDimensionValues:base.fetchDimensionValues.bind(base)}:{}),
    ...(base.fetchColumnCandidates?{fetchColumnCandidates:base.fetchColumnCandidates.bind(base)}:{}),
    fetchFilterCandidates:async(request,options)=>{
      const filter=page.filters?.find(item=>item.id===request.filterId);
      if(filter?.type!=='dimension'||!filter.candidates)return base.fetchFilterCandidates?base.fetchFilterCandidates(request,options):{kind:'unavailable'};
      if(sourceCandidateErrors(page).length)fail('DQE_CONFIG_ERROR','页面数据源候选声明无效');
      const conditions=candidateConditions(page,request);
      const program=createSourceProgram(page,{gateway,...context});
      let snapshot:DataSnapshot|undefined;
      try {
        for await(const update of program.read({roots:[filter.candidates.dataSource],conditions,purpose:'complete',strictComplete:true,useInitial:false,signal:options.signal,displayInputs:context.displayInputs?.(),filterRevision:context.filterRevision?.(),now:context.now??context.clock?.()}))if(update.sourceId===filter.candidates.dataSource)snapshot=update.snapshot;
        options.signal.throwIfAborted();
        return {kind:'values',candidates:projectSourceCandidates(filter,completeRows(snapshot,page.dataSources[filter.candidates.dataSource]!.source.type==='inline'))};
      } catch(cause) {
        if(cause instanceof SourceRangeError)fail(cause.code==='EXPORT_ROW_LIMIT'?'DQE_QUERY_REJECTED':'DQE_ROW_CONTRACT_ERROR','候选来源完整读取失败');
        throw cause;
      } finally {program.dispose();}
    }
  };
  Object.assign(gateway,{[owner]:page});
  return gateway;
}
function completeRows(snapshot:DataSnapshot|undefined,inline:boolean):Row[] {
  if(snapshot?.status==='error')throw Object.assign(new Error(snapshot.error.message),snapshot.error);
  if(snapshot?.status==='empty')return [];
  if(snapshot?.status!=='ready'||(!inline&&snapshot.totalCount!==snapshot.rows.length))fail('DQE_QUERY_REJECTED','候选来源未返回完整结果');
  return snapshot.rows;
}
function candidateConditions(page:Page,request:FilterCandidatesRequest):FilterValues {
  const values=new Map<string,FilterValue>();
  for(const filter of page.filters??[]){
    if(filter.id===request.filterId)continue;
    if(filter.type==='dimension'){
      const selected=request.constraints.dimensions[filter.dimension];
      if(selected)values.set(filter.id,{type:'dimension',dimension:filter.dimension,values:[...selected]});
    }else if(filter.type==='timePoint'||filter.type==='timeRange'){
      const range=request.constraints.times[filter.id];if(!range)continue;
      if(filter.type==='timePoint')values.set(filter.id,{type:'timePoint',granularity:filter.granularity,value:range.from});
      else values.set(filter.id,{type:'timeRange',from:range.from,to:range.to,...(range.mode?{mode:range.mode}:{})});
    }else if(filter.type==='boolean'&&request.constraints.booleans?.[filter.id]!==undefined)values.set(filter.id,{type:'boolean',value:request.constraints.booleans[filter.id]!});
  }
  restoreSourceSelections(page,request,values);
  return values;
}
function restoreSourceSelections(page:Page,request:FilterCandidatesRequest,values:Map<string,FilterValue>):void {
  const target=page.filters?.find(filter=>filter.id===request.filterId);
  if(!target)return;
  const ids=new Set<string>(),queue=candidateDependencies(target);
  for(const id of queue)if(!ids.has(id)){ids.add(id);const parent=page.filters?.find(filter=>filter.id===id);if(parent)queue.push(...candidateDependencies(parent));}
  for(const [id,value] of Object.entries(request.sourceValues??{}))if(ids.has(id)&&id!==request.filterId)values.set(id,structuredClone(value));
}
/** Deduplicate only after the complete read; conflicting identities never pick an arbitrary label/parent. */
export function projectSourceCandidates(filter:DimensionFilterDeclaration,rows:readonly Row[]):FilterCandidate[] {
  const spec=filter.candidates!,byValue=new Map<string,FilterCandidate>();
  for(const row of rows){
    const value=scalar(row[spec.valueField]);if(value===undefined)continue;
    const label=spec.labelField?scalar(row[spec.labelField])??value:value;
    const parent=spec.parentField?scalar(row[spec.parentField]):undefined;
    const candidate={value,label,...(parent!==undefined?{parentValue:parent}:{})};
    const previous=byValue.get(value);
    if(previous&&canonicalizeJson(previous)!==canonicalizeJson(candidate))fail('DQE_ROW_CONTRACT_ERROR','候选稳定值对应的显示名或父节点不一致');
    byValue.set(value,candidate);
  }
  const candidates=[...byValue.values()];
  if(candidates.length>10000)fail('DQE_QUERY_REJECTED','候选值超过完整结果预算');
  validateParents(byValue);
  return candidates;
}
function scalar(value:unknown):string|undefined {
  if(value===null||value===undefined||value==='')return;
  if(typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return String(value);
  fail('DQE_ROW_CONTRACT_ERROR','候选输出必须是有限标量');
}
function validateParents(nodes:ReadonlyMap<string,FilterCandidate>):void {
  const complete=new Set<string>();
  for(const node of nodes.values()){
    const seen=new Set<string>();let current:FilterCandidate|undefined=node;
    while(current&&!complete.has(current.value)){
      if(seen.has(current.value))fail('DQE_ROW_CONTRACT_ERROR','候选父子关系存在循环');
      seen.add(current.value);
      const parent:string|undefined=current.parentValue;
      if(parent!==undefined&&!nodes.has(parent))fail('DQE_ROW_CONTRACT_ERROR','候选父节点不在完整结果中');
      current=parent===undefined?undefined:nodes.get(parent);
    }
    for(const value of seen)complete.add(value);
  }
}
function fail(code:string,message:string):never {throw Object.assign(new Error(message),{code});}
