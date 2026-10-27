import { isObjectDqeItem, querySelection, type DataSource, type DqeFilterBinding, type DqeQueryDefinition, type JsonObject, type PeriodQueryPolicy, QUERY_PERIODS } from '@metriccanvas/page/internal';

export type EditableDateBinding = {dataSourceId:string;binding:DqeFilterBinding;preserve?:boolean};
type EditableQueryLeaf=Pick<DqeQueryDefinition,'body'|'filterBindings'>;
export function dateQueryLeaves(query:DqeQueryDefinition): EditableQueryLeaf[] {
  const selection=querySelection(query);
  return selection ? Object.values(selection.cases) : [query];
}
export function queryTime(query:EditableQueryLeaf):JsonObject|undefined {
  const filter=query.body?.dsl_list[0].filter;
  const time=filter&&typeof filter==='object'&&!Array.isArray(filter)?filter.time:undefined;
  return time&&typeof time==='object'&&!Array.isArray(time)?time:undefined;
}
export function inferredPeriodPolicy(query:DqeQueryDefinition):PeriodQueryPolicy|undefined {
  const periods=dateQueryLeaves(query).map(leaf=>queryTime(leaf)?.period);
  const period=periods[0];
  return QUERY_PERIODS.includes(period as typeof QUERY_PERIODS[number]) && periods.every(item=>item===period)
    ? {kind:'fixed',period:period as typeof QUERY_PERIODS[number]} : undefined;
}
export function periodBindable(query:DqeQueryDefinition):boolean {
  if(query.timeModes)return false;
  return dateQueryLeaves(query).every(leaf=>!!queryTime(leaf)&&!isObjectDqeItem(leaf.body?.dsl_list[0]));
}
export function dateBindingsForFilter(sources:Record<string,DataSource>,id:string){
  return Object.entries(sources).flatMap(([sourceId,source])=>{
    if(source.source.type!=='query')return [];
    const leaves=dateQueryLeaves(source.source.query);
    const binding=leaves.map(leaf=>leaf.filterBindings?.[id]).find(Boolean);
    if(!binding||(binding.target!=='time'&&binding.target!=='timePoint'))return [];
    const signatures=leaves.map(leaf=>JSON.stringify([leaf.filterBindings?.[id],queryTime(leaf)?.period]));
    return [{key:`${sourceId}:${binding.target==='time'?'time':binding.queryField}`,binding,mixed:new Set(signatures).size>1}];
  });
}
/** Each static leaf retains its own binding unless migration was explicitly selected. */
export function editDateQueryBindings(query:DqeQueryDefinition, filterId:string, edit:EditableDateBinding|undefined):boolean {
  return dateQueryLeaves(query).map(leaf=>editLeaf(leaf,filterId,edit)).some(Boolean);
}
function editLeaf(leaf:EditableQueryLeaf, filterId:string, edit:EditableDateBinding|undefined):boolean {
  const previous=leaf.filterBindings?.[filterId];
  if(edit?.preserve)return false;
  if(!edit){
    if(!previous)return false;
    delete leaf.filterBindings![filterId];
    if(!Object.keys(leaf.filterBindings!).length)delete leaf.filterBindings;
    return true;
  }
  const binding=edit.binding;
  (leaf.filterBindings??={})[filterId]=binding;
  const time=queryTime(leaf);
  if(binding.target==='time'&&time){
    delete time.start;delete time.end;
    if(binding.periodPolicy){delete time.period;delete time.param;delete time.window;}
  }
  if(binding.target==='timePoint')removeBoundDimension(leaf,binding.queryField);
  return JSON.stringify(previous)!==JSON.stringify(binding);
}
function removeBoundDimension(leaf:EditableQueryLeaf, field:string):void {
  const filter=leaf.body?.dsl_list[0].filter;
  if(filter&&typeof filter==='object'&&!Array.isArray(filter)&&Array.isArray(filter.dims))
    filter.dims=filter.dims.filter(dim=>!dim||typeof dim!=='object'||Array.isArray(dim)||dim.dim_name!==field);
}
