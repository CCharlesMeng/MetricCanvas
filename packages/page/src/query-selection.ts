import type {DqeQueryCase,DqeQueryDefinition} from './query';
import type {Page} from './page';

export interface QuerySelectorValue {type:string;mode?:string;values?:readonly string[]}
type Selection = {filterId:string;cases:Record<string,DqeQueryCase>};
type OrdinaryQuery = DqeQueryDefinition & {body:NonNullable<DqeQueryDefinition['body']>};

export function querySelection(query:Pick<DqeQueryDefinition,'timeModes'|'queryModes'>):Selection|undefined {
  return (query.queryModes ?? query.timeModes) as Selection|undefined;
}
export function hasQuerySelection(query:Pick<DqeQueryDefinition,'timeModes'|'queryModes'>):boolean {
  return !!querySelection(query);
}
export function ordinaryQuery(query:DqeQueryDefinition):OrdinaryQuery {
  if(!query.body||hasQuerySelection(query))throw rejected('模式查询须先按合法已应用模式选择');
  return query as OrdinaryQuery;
}
function rejected(message:string):Error {
  return Object.assign(new Error(message),{code:'DQE_QUERY_REJECTED'});
}
function selectedKey(query:DqeQueryDefinition,value:QuerySelectorValue|undefined):string|undefined {
  if(query.queryModes)return value?.type==='dimension'&&value.values?.length===1?value.values[0]:undefined;
  return value?.type==='timeRange'?value.mode:undefined;
}
function baseQuery(query:DqeQueryDefinition):Omit<DqeQueryDefinition,'body'> {
  const {timeModes,queryModes,body,filterBindings,paramBindings,...base}=query;
  return base;
}
export function selectQuery(query:DqeQueryDefinition,values:ReadonlyMap<string,QuerySelectorValue>):OrdinaryQuery {
  const selection=querySelection(query);
  if(!selection)return ordinaryQuery(query);
  const key=selectedKey(query,values.get(selection.filterId));
  if(key===undefined||!Object.hasOwn(selection.cases,key))throw rejected('查询模式未通过合法单选校验');
  return {...baseQuery(query),...selection.cases[key]} as OrdinaryQuery;
}
/** Every static leaf participates in validation, parameter resolution and dependencies. */
export function queryLeaves(query:DqeQueryDefinition):OrdinaryQuery[] {
  const selection=querySelection(query);
  if(!selection)return [query as OrdinaryQuery];
  return Object.values(selection.cases).map(leaf=>({...baseQuery(query),...leaf} as OrdinaryQuery));
}
export function querySelectors(page:Page):Map<string,QuerySelectorValue[]> {
  const selectors=new Map<string,QuerySelectorValue[]>();
  for(const source of Object.values(page.dataSources)){
    if(source.source.type!=='query')continue;
    const query=source.source.query,selection=querySelection(query);
    if(!selection)continue;
    selectors.set(selection.filterId,Object.keys(selection.cases).map(key=>query.queryModes?{type:'dimension',values:[key]}:{type:'timeRange',mode:key}));
  }
  return selectors;
}
export function* selectionAssignments(selectors:ReadonlyMap<string,QuerySelectorValue[]>):Generator<Map<string,QuerySelectorValue>> {
  let assignments:Map<string,QuerySelectorValue>[]=[new Map()];
  for(const [id,choices]of selectors){
    if(assignments.length*choices.length>4096)throw rejected('查询模式组合超过4096');
    assignments=assignments.flatMap(values=>choices.map(choice=>new Map(values).set(id,choice)));
  }
  yield* assignments;
}
export function projectQueries(page:Page,values:ReadonlyMap<string,QuerySelectorValue>):Page {
  const sources=Object.fromEntries(Object.entries(page.dataSources).map(([id,source])=>[id,source.source.type==='query'?{...source,source:{...source.source,query:selectQuery(source.source.query,values)}}:source]));
  return {...page,dataSources:sources};
}
/** One selector drives a coherent assignment across all query sources. */
export function* queryVariants(page:Page):Generator<Page> {
  const selectors=querySelectors(page);
  if(!selectors.size){yield page;return;}
  for(const values of selectionAssignments(selectors))yield projectQueries(page,values);
}
