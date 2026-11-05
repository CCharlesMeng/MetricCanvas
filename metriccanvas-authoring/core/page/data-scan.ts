/** Read-only authoring analysis. Explicit document/Schema inputs; no files, hashes or execution. */
import { walkDocumentComponents } from '../../../packages/page/src/component-walk';
import type { StaticFieldBinding } from '../../../packages/page/src/field';
import { materializePageDocument } from '../../../packages/page/src/materialize';

type Json = Record<string, any>;
export interface DataUse {
  path:string; componentId:string; componentType:string; label:string; kind:string;
  source?:string; slot?:string; field?:string; recordListField?:string; declaration?:Json;
}
type ScanContext=Omit<DataUse,'path'|'kind'>&{presentationOnly?:true};
const pointerToken=(key:string)=>key.replaceAll('~','~0').replaceAll('/','~1');

function at(schema:Json,pointer:string):Json {
  return pointer.slice(2).split('/').reduce((value,key)=>value?.[key.replaceAll('~1','/').replaceAll('~0','~')],schema);
}
function bindingUses(value:any,path:string,context:ScanContext):DataUse[] {
  if(typeof value==='string') return [{...context,path,kind:'field',slot:'main',field:value}];
  if(!value || typeof value!=='object') return [{...context,path,kind:'invalid-field-binding'}];
  if(value.byFilter) return Object.entries(value.byFilter.cases ?? {}).flatMap(([key,item])=>bindingUses(item,`${path}/byFilter/cases/${pointerToken(key)}`,context));
  if(typeof value.field==='string') {
    const main={...context,path,kind:'field',slot:value.data ?? 'main',field:value.field};
    return value.match ? [main,{...context,path:path+'/match/field',kind:'match',slot:value.data ?? 'main',field:value.match.field}] : [main];
  }
  return [{...context,path,kind:'invalid-field-binding'}];
}

const fieldRefs=new Set(['fieldBinding','staticFieldBinding','fieldReference']);
/** Follow actual product Schema references, not a parallel per-component field list. */
function visitSchema(value:any,node:Json,root:Json,path:string,context:ScanContext,uses:DataUse[],depth=0):void {
  if(value===undefined || !node || depth>80) return;
  const fieldPattern=root.definitions?.staticFieldBinding?.anyOf?.find((branch:Json)=>branch.type==='string')?.pattern;
  if(!context.presentationOnly && typeof value==='string' && fieldPattern && node.pattern===fieldPattern) {
    uses.push(...bindingUses(value,path,context));return;
  }
  if(node.$ref) {visitReference(value,node.$ref,root,path,context,uses,depth);return;}
  for(const key of ['anyOf','oneOf','allOf']) for(const branch of node[key] ?? []) visitSchema(value,branch,root,path,context,uses,depth+1);
  if(Array.isArray(value) && node.items) value.forEach((item,i)=>visitSchema(item,node.items,root,`${path}/${i}`,context,uses,depth+1));
  visitProperties(value,node,root,path,context,uses,depth);
}

function visitReference(value:any,reference:string,root:Json,path:string,context:ScanContext,uses:DataUse[],depth:number):void {
  const name=reference.split('/').at(-1)!;
  if(context.presentationOnly && name==='fieldReference')return;
  if(fieldRefs.has(name)) {uses.push(...bindingUses(value,path,context));return;}
  if(name==='aiSummaryDataSourceReference' && typeof value==='string') {
    uses.push({...context,path,kind:'related-data-source',source:value});return;
  }
  if(name==='aiSummaryRelatedDataDefinition' && typeof value?.source==='string') {
    (value.fields ?? []).forEach((field:Json,i:number)=>uses.push({...context,path:`${path}/fields/${i}/field`,kind:'related-data',source:value.source,field:field.field,label:field.term ?? context.label}));
    return;
  }
  visitSchema(value,at(root,reference),root,path,context,uses,depth+1);
}

function visitProperties(value:any,node:Json,root:Json,path:string,context:ScanContext,uses:DataUse[],depth:number):void {
  if(!value || typeof value!=='object' || Array.isArray(value)) return;
  const label=typeof value.label==='string'?value.label:typeof value.title==='string'?value.title:context.label;
  for(const [key,item] of Object.entries(value)) {
    const child=node.properties?.[key] ?? (typeof node.additionalProperties==='object'?node.additionalProperties:undefined);
    if(child) visitSchema(item,child,root,`${path}/${pointerToken(key)}`,{...context,label},uses,depth+1);
  }
}

function auxiliaryFieldUses(value:Json,path:string,context:ScanContext,uses:DataUse[]):void {
  if(typeof value.field==='string' && typeof value.source==='string') uses.push({...context,path,kind:'source-field',source:value.source,field:value.field});
  if(typeof value.field==='string' && (value.op || value.row===true)) uses.push({...context,path,kind:'condition-or-row-field',slot:value.data ?? 'main',field:value.field});
  if(typeof value.row==='string' && value.op) uses.push({...context,path:path+'/row',kind:'condition-or-row-field',slot:'main',field:value.row});
}
function auxiliaryControlUses(value:Json,path:string,context:ScanContext,uses:DataUse[]):void {
  if(typeof value.filter==='string') uses.push({...context,path,kind:'filter-reference',declaration:{filterId:value.filter}});
  if(typeof value.filterId==='string') uses.push({...context,path,kind:'filter-reference',declaration:{filterId:value.filterId}});
  if(typeof value.param==='string') uses.push({...context,path,kind:'param-reference',declaration:{paramId:value.param}});
}
function auxiliaryUses(value:any,path:string,context:ScanContext,uses:DataUse[]):void {
  if(!value || typeof value!=='object') return;
  if(Array.isArray(value)) {value.forEach((v,i)=>auxiliaryUses(v,`${path}/${i}`,context,uses));return;}
  auxiliaryFieldUses(value,path,context,uses);
  auxiliaryControlUses(value,path,context,uses);
  for(const [key,item] of Object.entries(value)) {
    if(key==='components' || key==='tabs' || key==='component' || key==='echartsOption') continue;
    auxiliaryUses(item,`${path}/${pointerToken(key)}`,context,uses);
  }
}

function rowInputUses(input:Json,path:string,context:ScanContext,uses:DataUse[],diagnostics:Json[]):void {
  for(const [id,binding] of Object.entries(input.bindings ?? {}) as Array<[string,any]>) {
    const location=`${path}/bindings/${pointerToken(id)}`;
    if(binding?.source==='row' && typeof binding.field==='string') {
      uses.push({...context,path:location,kind:'row-input',slot:'main',field:binding.field});
    } else if(binding?.source==='filter') {
      uses.push({...context,path:location,kind:'filter-reference',declaration:{filterId:binding.id}});
    } else if(binding?.source==='param') {
      uses.push({...context,path:location,kind:'param-reference',declaration:{paramId:binding.id}});
    } else if(binding?.source==='selection') {
      uses.push({...context,path:location,kind:'row-selection-input'});
    } else diagnostics.push({path:location,type:'INVALID_ROW_EXPANSION_BINDING'});
  }
  for(const [index,id] of (Array.isArray(input.filters)?input.filters:[]).entries()) {
    uses.push({...context,path:`${path}/filters/${index}`,kind:'filter-reference',declaration:{filterId:id}});
  }
}

function rowExpansionContext(input:Json,path:string,context:ScanContext,uses:DataUse[],diagnostics:Json[]) {
  if(input?.type==='query' && typeof input.source==='string') {
    uses.push({...context,path:path+'/source',kind:'row-expansion-source',source:input.source});
    rowInputUses(input,path,context,uses,diagnostics);
    return {...context,source:input.source};
  }
  if(input?.type==='recordList' && typeof input.field==='string') {
    uses.push({...context,path:path+'/field',kind:'field',slot:'main',field:input.field});
    return {...context,recordListField:input.field};
  }
  diagnostics.push({path,type:'INVALID_ROW_EXPANSION_CONTEXT'});
}

function scanHierarchySelection(selection:Json,path:string,context:ScanContext,uses:DataUse[],diagnostics:Json[]):void {
  if(!selection)return;
  uses.push({...context,path:path+'/filter',kind:'filter-reference',declaration:{filterId:selection.filter}});
  uses.push({...context,path:path+'/parentField',kind:'field',slot:'main',field:selection.parentField});
  const lookup=selection.parentLookup;
  if(!lookup)return;
  uses.push({...context,path:path+'/parentLookup/source',kind:'row-lookup-source',source:lookup.source});
  uses.push({...context,path:path+'/parentLookup/field',kind:'field',source:lookup.source,field:lookup.field});
  rowInputUses(lookup,path+'/parentLookup',context,uses,diagnostics);
}
function scanRowExpansion(component:Json,path:string,schema:Json,context:ScanContext,uses:DataUse[],diagnostics:Json[]):void {
  const expansion=component.props?.rowExpansion;
  if(component.type!=='table' || !expansion) return;
  const location=path+'/props/rowExpansion';
  scanHierarchySelection(expansion.selection,location+'/selection',context,uses,diagnostics);
  const child=rowExpansionContext(expansion.data,location+'/data',{...context,source:component.data?.main},uses,diagnostics);
  if(!child) return;
  const definition=schema.definitions?.rowExpansionTable;
  if(!definition) {diagnostics.push({path:location,type:'UNSUPPORTED_ROW_EXPANSION_CONTEXT'});return;}
  visitSchema(expansion.table,definition,schema,location+'/table',child,uses);
  auxiliaryUses(expansion.table,location+'/table',child,uses);
}

function resolveComponentUses(component:Json,uses:DataUse[],diagnostics:Json[]):void {
  for(const use of uses) {
    if(use.kind==='invalid-field-binding') diagnostics.push({path:use.path,type:'INVALID_FIELD_BINDING'});
    if(use.slot && !use.source) use.source=component.data?.[use.slot];
    if(use.field && !use.source) diagnostics.push({path:use.path,type:'UNRESOLVED_DATA_SLOT',slot:use.slot});
  }
}

function scanComponent(component:Json,path:string,schema:Json,uses:DataUse[],diagnostics:Json[]):void {
  const context={componentId:String(component.id ?? ''),componentType:String(component.type ?? ''),label:typeof component.props?.title==='string'?component.props.title:String(component.id ?? '')};
  const definition=componentDefinition(component,schema);
  if(!definition) {diagnostics.push({path,type:'UNKNOWN_COMPONENT',componentType:component.type});return;}
  const local=componentLocalProps(component);
  const before=uses.length;
  visitSchema(local,definition,schema,path,context,uses);
  auxiliaryUses(local,path,context,uses);
  scanRowExpansion(component,path,schema,context,uses,diagnostics);
  for(const [slot,source] of Object.entries(component.data ?? {})) {
    uses.push({...context,path:`${path}/data/${pointerToken(slot)}`,kind:'data-slot',slot,source:String(source)});
  }
  if(uses.length===before) uses.push({...context,path,kind:'static-or-control'});
  resolveComponentUses(component,uses.slice(before),diagnostics);
}

export function useFieldContract(use:DataUse,sources:Json):Json|undefined {
  const fields=sources[use.source ?? '']?.fields;
  return (use.recordListField?fields?.[use.recordListField]?.items?.fields:fields)?.[use.field ?? ''];
}

export function scanPageData(page:Json,schema:Json):{uses:DataUse[];diagnostics:Json[];sources:Json;filters:unknown;params:unknown} {
  const uses:DataUse[]=[],diagnostics:Json[]=[];
  if(!Array.isArray(page.sections)) diagnostics.push({path:'/sections',type:'INVALID_PAGE_SHAPE'});
  const pageContext={componentId:String(page.id ?? ''),componentType:'page',label:String(page.id ?? '')};
  sourceCandidateUses(page,pageContext,uses);
  for(const key of ['iocHeader','meta']) auxiliaryUses(page[key],`/${key}`,pageContext,uses);
  (Array.isArray(page.sections)?page.sections:[]).forEach((section:Json,i:number)=>{
    for(const key of ['title','visibleWhen']) auxiliaryUses(section[key],`/sections/${i}/${key}`,pageContext,uses);
  });
  walkDocumentComponents(page,(component,path)=>scanComponent(component,path,schema,uses,diagnostics));
  const projection=projectDataSources(page.dataSources ?? {}),sources=projection.sources;
  diagnostics.push(...projection.diagnostics);
  const expanded=uses.flatMap(use=>use.kind==='related-data-source'?relatedSourceFields(use,sources):[use]);
  const unique=[...new Map(expanded.map(use=>[`${use.path}:${use.kind}:${use.field ?? ''}`,use])).values()];
  for(const use of unique) if(use.field && use.source && !useFieldContract(use,sources)) diagnostics.push({path:use.path,type:'UNKNOWN_FIELD',source:use.source,field:use.field});
  return {uses:unique,diagnostics,sources,filters:page.filters ?? [],params:page.params ?? []};
}

export function projectDataSources(dataSources:Json):{sources:Json;diagnostics:Json[]} {
  const declarations=Object.fromEntries(Object.entries(dataSources).map(([id,source]:[string,any])=>[id,{
    fields:source?.fields,source:source?.source?.type==='inline'?{type:'inline'}:withoutRows(source?.source),compute:source?.compute
  }]));
  const projected=materializePageDocument({dataSources:declarations});
  return {sources:(projected.document as Json).dataSources,diagnostics:projected.errors};
}

function relatedSourceFields(use:DataUse,sources:Json):DataUse[] {
  const fields=sources[use.source ?? '']?.fields ?? {};
  return [use,...Object.entries(fields).filter(([,field]:[string,any])=>field.role!=='detail')
    .map(([field,definition]:[string,any])=>({...use,kind:'related-data',field,label:definition.label ?? field}))];
}

function withoutRows(value:any):any {
  if(Array.isArray(value)) return value.map(withoutRows);
  if(!value || typeof value!=='object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='initial').map(([key,item])=>[key,withoutRows(item)]));
}


function componentDefinition(component:Json,schema:Json):Json|undefined {
  return Object.values(schema.definitions).find((node:any)=>node.properties?.id && node.properties?.props && node.properties?.type?.const===component.type) as Json|undefined;
}
function componentLocalProps(component:Json):Json {
  const local={...component,props:{...component.props}};
  // Each nested component and row context is scanned by its own owner.
  for(const key of ['components','tabs','rowExpansion'])delete local.props[key];
  return local;
}

/** Actual display bindings, discovered through the product Schema rather than a property-name list. */
export function scanPresentationBindings(component:Json,schema:Json,path=''):Array<{path:string;binding:StaticFieldBinding}> {
  const definition=componentDefinition(component,schema);
  if(!definition)return [];
  const local=componentLocalProps(component),uses:DataUse[]=[];
  const context:ScanContext={componentId:String(component.id ?? ''),componentType:String(component.type ?? ''),label:String(component.id ?? ''),presentationOnly:true};
  visitSchema(local,definition,schema,path,context,uses);
  const bindings=new Map<string,{path:string;binding:StaticFieldBinding}>();
  for(const use of uses.filter(use=>use.kind==='field')) {
    const tokens=use.path.slice(path.length).split('/').slice(1).map(token=>token.replaceAll('~1','/').replaceAll('~0','~'));
    const binding=tokens.reduce((value,key)=>value?.[key],local) as unknown as StaticFieldBinding;
    bindings.set(use.path,{path:use.path,binding});
  }
  return [...bindings.values()];
}

/** Candidate mappings are data uses even when the control itself has no data slot. */
function sourceCandidateUses(page:Json,context:ScanContext,uses:DataUse[]):void {
  for(const [index,filter] of (Array.isArray(page.filters)?page.filters:[]).entries()) {
    const spec=filter.candidates;if(!spec)continue;
    for(const key of ['valueField','labelField','parentField'])if(typeof spec[key]==='string')
      uses.push({...context,path:`/filters/${index}/candidates/${key}`,kind:'field',source:spec.dataSource,field:spec[key],label:filter.label??context.label});
  }
}
