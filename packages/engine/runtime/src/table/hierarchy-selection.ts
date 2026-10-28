import { expansionRowKey, sourceFilterIds, type Page, type TableComponent, type Row, type DisplaySnapshot, type DataSnapshot } from '@metriccanvas/page/internal';
import { createSourceProgram, createCandidateValidator } from '@metriccanvas/data-execution/runtime';
import type { DataGateway } from '../ports';
import type { FilterValues } from '../filter-state';
import type { PageParamValues } from '../page-params';
import { scopedFilterValues } from '../detail-view';
export interface HierarchySelection {
  status:'unrestricted'|'selected'|'pending'|'unresolved'|'ambiguous'|'error';
  identity:string; parentValue?:string; childValue?:string; message?:string;
}
export interface HierarchyContext {
  filters:FilterValues; params:PageParamValues; blocked?:readonly string[];
  displaySnapshot?:DisplaySnapshot; filterRevision?:number;
}
export function hierarchyChoice(table:TableComponent,filters:FilterValues):HierarchySelection {
  const s=table.props.rowExpansion?.selection;
  const value=s&&filters.get(s.filter);
  const identity=JSON.stringify(value?.type==='dimension'?[value.level,value.values]:null);
  if(!s)return {status:'unrestricted',identity};
  if(value && value.type!=='dimension')return {status:'error',identity,message:'层级选择类型无效'};
  if(!value||!value.values.length)return {status:'unrestricted',identity};
  if(value.values.length!==1||typeof value.values[0]!=='string'||!value.values[0])return {status:'error',identity,message:'层级选择必须是单个稳定值'};
  if(value.level===s.parentLevel)return {status:'selected',identity,parentValue:value.values[0]};
  if(value.level===s.childLevel)return {status:'pending',identity,childValue:value.values[0]};
  return {status:'error',identity,message:'层级选择不属于声明层级'};
}
/** A private lookup uses the same controlled source execution as all business queries. */
export async function resolveHierarchySelection(page:Page,table:TableComponent,gateway:DataGateway,context:HierarchyContext,signal:AbortSignal):Promise<HierarchySelection>{
  const choice=hierarchyChoice(table,context.filters), s=table.props.rowExpansion?.selection;
  if(!s)return choice;
  if(context.blocked?.includes(s.filter))throw new Error('层级筛选尚未通过候选确认');
  if(choice.status==='error')throw new Error(choice.message);
  if(choice.status==='unrestricted')return choice;
  const validator=createCandidateValidator(page,gateway,{displayInputs:()=>context.displaySnapshot,filterRevision:()=>context.filterRevision??0});
  await validator.verify(s.parentLookup.source,context.filters,signal,[s.filter]);
  if(!choice.childValue)return choice;
  const lookup=s.parentLookup;
  const filters=scopedFilterValues(page,lookup.filters,lookup.bindings,{},context.filters,context.params);
  const source=page.dataSources[lookup.source];
  if(source?.source.type!=='query')throw new Error('定位查询不可用');
  const scope:Page={...page,sections:[],detailViews:undefined,dataSources:{[lookup.source]:{...source,source:{...source.source,initial:undefined}}}};
  const program=createSourceProgram(scope,{gateway});
  let snapshot:DataSnapshot|undefined;
  try{
    for await(const update of program.read({roots:[lookup.source],conditions:filters,purpose:'complete',freshness:'refresh',signal,displayInputs:context.displaySnapshot,filterRevision:context.filterRevision}))snapshot=update.snapshot;
    signal.throwIfAborted();
    if(!snapshot||snapshot.status==='loading'||snapshot.status==='error')throw new Error('父级定位查询失败或无权限');
    const rows=snapshot.status==='ready'?snapshot.rows:[];
    if(rows.some(row=>typeof row[lookup.field]!=='string'||!row[lookup.field]))throw new Error('定位结果父级值无效');
    const values=new Set(rows.map(row=>row[lookup.field] as string));
    if(!values.size)return {...choice,status:'unresolved',message:'无法定位所选子级的父级'};
    if(values.size!==1)return {...choice,status:'ambiguous',message:'所选子级的父级归属不唯一'};
    return {...choice,status:'selected',parentValue:[...values][0]};
  }finally{program.dispose();}
}
export function hierarchyRows(table:TableComponent,rows:readonly Row[],selection:HierarchySelection):Row[]{
  const s=table.props.rowExpansion?.selection;
  if(!s)return [...rows];
  const keys=rows.map(row=>expansionRowKey(row[table.props.rowKey!]));
  if(keys.some(k=>k===undefined)||new Set(keys).size!==keys.length)throw new Error('父表行键缺失或重复');
  if(selection.status==='unrestricted')return [...rows];
  if(selection.status!=='selected')return [];
  const matched=rows.filter(row=>row[s.parentField]===selection.parentValue);
  if(matched.length>1)throw new Error('父表父级字段匹配多行，无法唯一定位');
  return matched;
}
/** The only optional-input branch; all legacy bindings still use fail-closed detail inputs. */
export function rowExpansionFilters(page:Page,table:TableComponent,row:Row,context:HierarchyContext,selection?:HierarchySelection):FilterValues{
  const expansion=table.props.rowExpansion!;
  if(expansion.data.type!=='query')return context.filters;
  const input=expansion.data, bindings:Record<string,import('@metriccanvas/page/internal').NavigationBinding>={};
  const optional:string[]=[];
  for(const [id,binding]of Object.entries(input.bindings)){
    if(binding.source==='selection'){optional.push(id);continue;}
    bindings[id]=binding;
  }
  const values=new Map(scopedFilterValues(page,input.filters.filter(id=>!optional.includes(id)),bindings,row,context.filters,context.params));
  if(!optional.length)return values;
  if(!selection||!['selected','unrestricted'].includes(selection.status))throw new Error('层级定位尚未就绪');
  if(selection.childValue&&row[expansion.selection!.parentField]!==selection.parentValue)throw new Error('子级归属与当前父行不匹配');
  for(const id of optional){
    values.delete(id);
    if(selection.childValue){
      const f=page.filters?.find(f=>f.id===id);
      if(f?.type!=='dimension')throw new Error('私有选择输入无效');
      values.set(id,{type:'dimension',dimension:f.dimension,values:[selection.childValue]});
    }
  }
  return values;
}
/** Owns lookup cancellation and publishes only the latest dependency receipt. */
export function createHierarchySelectionSession(page:Page,table:TableComponent,gateway:DataGateway,changed:()=>void){
  let key='',current:HierarchySelection={status:'unrestricted',identity:'null'},request:AbortController|undefined;
  let receipt:{key:string;value:HierarchySelection}|undefined;
  return {
    snapshot:()=>current,
    sync(context:HierarchyContext){
      const s=table.props.rowExpansion!.selection!,choice=hierarchyChoice(table,context.filters);
      const dependencies=new Set([s.filter,...sourceFilterIds(page.dataSources[s.parentLookup.source])]);
      for(const b of Object.values(s.parentLookup.bindings))if(b.source==='filter')dependencies.add(b.id);
      const next=JSON.stringify([choice.identity,[...context.filters].filter(([id])=>dependencies.has(id)),[...context.params]]);
      const gated=Boolean(context.blocked?.includes(s.filter)),publicationKey=JSON.stringify([next,gated]);
      if(publicationKey===key)return;
      if(choice.identity!==current.identity)receipt=undefined;
      key=publicationKey;request?.abort();request=new AbortController();const active=request;
      if(context.blocked?.includes(s.filter)){current={...choice,status:'pending',message:'等待层级候选确认'};changed();return;}
      if(choice.status==='unrestricted'){current=choice;changed();return;}
      if(receipt?.key===next){current=receipt.value;changed();return;}
      current={...choice,status:'pending'};changed();
      void resolveHierarchySelection(page,table,gateway,context,active.signal).then(result=>{
        if(active.signal.aborted)return;if(result.status==='selected')receipt={key:next,value:result};current=result;changed();
      },cause=>{if(active.signal.aborted)return;current={...choice,status:'error',message:cause instanceof Error?cause.message:'父级定位失败'};changed();});
    },
    dispose(){request?.abort();}
  };
}
