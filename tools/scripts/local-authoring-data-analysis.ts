import { createHash } from 'node:crypto';
import { walkDocumentComponents } from '../../packages/page/src/component-walk';
import { materializePageDocument } from '../../packages/page/src/materialize';

type Json=Record<string,any>;
export const hashBytes=(content:string)=>createHash('sha256').update(content).digest('hex');
export const pointerToken=(key:string)=>key.replaceAll('~','~0').replaceAll('/','~1');
export interface DataUse {
  path:string; componentId:string; componentType:string; label:string; kind:string;
  source?:string; slot?:string; field?:string; recordListField?:string; declaration?:Json;
}
export interface DocumentBlock {id:string; heading:string; from:number; to:number; text:string}

/** Index boundaries only: free-form Markdown semantics remain the author's job. */
export function markdownBlocks(content:string):DocumentBlock[] {
  const lines=content.split('\n');
  const starts=[0]; let fenced=false;
  lines.forEach((line,i)=>{
    if(/^\s*(```|~~~)/.test(line)) fenced=!fenced;
    if(!fenced && i>0 && (/^#{1,6}\s/.test(line) || i-starts.at(-1)!>=40 || (!line.trim() && i-starts.at(-1)!>=16))) starts.push(i);
  });
  let heading='document';
  return starts.map((from,i)=>{
    const to=starts[i+1] ?? lines.length;
    if(/^#{1,6}\s/.test(lines[from])) heading=lines[from].replace(/^#+\s*/,'');
    const text=lines.slice(from,to).join('\n');
    return {id:hashBytes(`${from+1}:${to}:${text}`).slice(0,16),heading,from:from+1,to,text};
  }).filter(b=>b.text.trim());
}

function at(schema:Json,pointer:string):Json {
  return pointer.slice(2).split('/').reduce((value,key)=>value?.[key.replaceAll('~1','/').replaceAll('~0','~')],schema);
}
function bindingUses(value:any,path:string,context:Omit<DataUse,'path'|'kind'>):DataUse[] {
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
function visitSchema(value:any,node:Json,root:Json,path:string,context:Omit<DataUse,'path'|'kind'>,uses:DataUse[],depth=0):void {
  if(value===undefined || !node || depth>80) return;
  const fieldPattern=root.definitions?.staticFieldBinding?.anyOf?.find((branch:Json)=>branch.type==='string')?.pattern;
  if(typeof value==='string' && fieldPattern && node.pattern===fieldPattern) {
    uses.push(...bindingUses(value,path,context));return;
  }
  if(node.$ref) {visitReference(value,node.$ref,root,path,context,uses,depth);return;}
  for(const key of ['anyOf','oneOf','allOf']) for(const branch of node[key] ?? []) visitSchema(value,branch,root,path,context,uses,depth+1);
  if(Array.isArray(value) && node.items) value.forEach((item,i)=>visitSchema(item,node.items,root,`${path}/${i}`,context,uses,depth+1));
  visitProperties(value,node,root,path,context,uses,depth);
}

function visitReference(value:any,reference:string,root:Json,path:string,context:Omit<DataUse,'path'|'kind'>,uses:DataUse[],depth:number):void {
  const name=reference.split('/').at(-1)!;
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

function visitProperties(value:any,node:Json,root:Json,path:string,context:Omit<DataUse,'path'|'kind'>,uses:DataUse[],depth:number):void {
  if(!value || typeof value!=='object' || Array.isArray(value)) return;
  const label=typeof value.label==='string'?value.label:typeof value.title==='string'?value.title:context.label;
  for(const [key,item] of Object.entries(value)) {
    const child=node.properties?.[key] ?? (typeof node.additionalProperties==='object'?node.additionalProperties:undefined);
    if(child) visitSchema(item,child,root,`${path}/${pointerToken(key)}`,{...context,label},uses,depth+1);
  }
}

function auxiliaryUses(value:any,path:string,context:Omit<DataUse,'path'|'kind'>,uses:DataUse[]):void {
  if(!value || typeof value!=='object') return;
  if(Array.isArray(value)) {value.forEach((v,i)=>auxiliaryUses(v,`${path}/${i}`,context,uses));return;}
  if(typeof value.field==='string' && typeof value.source==='string') uses.push({...context,path,kind:'source-field',source:value.source,field:value.field});
  if(typeof value.field==='string' && (value.op || value.row===true)) uses.push({...context,path,kind:'condition-or-row-field',slot:value.data ?? 'main',field:value.field});
  if(typeof value.row==='string' && value.op) uses.push({...context,path:path+'/row',kind:'condition-or-row-field',slot:'main',field:value.row});
  if(typeof value.filter==='string') uses.push({...context,path,kind:'filter-reference',declaration:{filterId:value.filter}});
  if(typeof value.filterId==='string') uses.push({...context,path,kind:'filter-reference',declaration:{filterId:value.filterId}});
  if(typeof value.param==='string') uses.push({...context,path,kind:'param-reference',declaration:{paramId:value.param}});
  for(const [key,item] of Object.entries(value)) {
    if(key==='components' || key==='tabs' || key==='component' || key==='echartsOption') continue;
    auxiliaryUses(item,`${path}/${pointerToken(key)}`,context,uses);
  }
}

function rowInputUses(input:Json,path:string,context:Omit<DataUse,'path'|'kind'>,uses:DataUse[],diagnostics:Json[]):void {
  for(const [id,binding] of Object.entries(input.bindings ?? {}) as Array<[string,any]>) {
    const location=`${path}/bindings/${pointerToken(id)}`;
    if(binding?.source==='row' && typeof binding.field==='string') {
      uses.push({...context,path:location,kind:'row-input',slot:'main',field:binding.field});
    } else if(binding?.source==='filter') {
      uses.push({...context,path:location,kind:'filter-reference',declaration:{filterId:binding.id}});
    } else if(binding?.source==='param') {
      uses.push({...context,path:location,kind:'param-reference',declaration:{paramId:binding.id}});
    } else diagnostics.push({path:location,type:'INVALID_ROW_EXPANSION_BINDING'});
  }
  for(const [index,id] of (Array.isArray(input.filters)?input.filters:[]).entries()) {
    uses.push({...context,path:`${path}/filters/${index}`,kind:'filter-reference',declaration:{filterId:id}});
  }
}

function rowExpansionContext(input:Json,path:string,context:Omit<DataUse,'path'|'kind'>,uses:DataUse[],diagnostics:Json[]) {
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

function scanRowExpansion(component:Json,path:string,schema:Json,context:Omit<DataUse,'path'|'kind'>,uses:DataUse[],diagnostics:Json[]):void {
  const expansion=component.props?.rowExpansion;
  if(component.type!=='table' || !expansion) return;
  const location=path+'/props/rowExpansion';
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
  const definition=Object.values(schema.definitions).find((node:any)=>node.properties?.id && node.properties?.props && node.properties?.type?.const===component.type) as Json|undefined;
  if(!definition) {diagnostics.push({path,type:'UNKNOWN_COMPONENT',componentType:component.type});return;}
  const local={...component,props:{...component.props}};
  // Containers and row expansions have their own data contexts.
  for(const key of ['components','tabs','rowExpansion']) delete local.props[key];
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

function useFieldContract(use:DataUse,sources:Json):Json|undefined {
  const fields=sources[use.source ?? '']?.fields;
  return (use.recordListField?fields?.[use.recordListField]?.items?.fields:fields)?.[use.field ?? ''];
}

export function scanPageData(page:Json,schema:Json):{uses:DataUse[];diagnostics:Json[];sources:Json;filters:unknown;params:unknown} {
  const uses:DataUse[]=[],diagnostics:Json[]=[];
  if(!Array.isArray(page.sections)) diagnostics.push({path:'/sections',type:'INVALID_PAGE_SHAPE'});
  const pageContext={componentId:String(page.id ?? ''),componentType:'page',label:String(page.id ?? '')};
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

export function findBlocks(blocks:DocumentBlock[],terms:string[],limit:number):{blocks:DocumentBlock[];searchedBlocks:number;omittedMatches:number} {
  const needles=terms.map(s=>s.trim().toLocaleLowerCase()).filter(Boolean);
  const scored=blocks.map(block=>({block,score:needles.reduce((n,term)=>n+(block.text.toLocaleLowerCase().includes(term)?1:0),0)})).filter(b=>b.score>0).sort((a,b)=>b.score-a.score || a.block.from-b.block.from);
  return {blocks:scored.slice(0,limit).map(b=>b.block),searchedBlocks:blocks.length,omittedMatches:Math.max(0,scored.length-limit)};
}

export function draftAnalysis(page:Json,schema:Json,pageHash:string,md:string):Json {
  const scan=scanPageData(page,schema),blocks=markdownBlocks(md);
  const gaps=new Map<string,Json>();
  const entries=scan.uses.filter(use=>use.field).map(use=>{
    const field=useFieldContract(use,scan.sources);
    const terms=[use.field,field?.label,field?.queryField,use.label].filter((s):s is string=>typeof s==='string');
    const candidates=findBlocks(blocks,terms,3);
    const group=`${use.source ?? 'unknown'}:${use.recordListField?use.recordListField+':':''}${use.field}`;
    gaps.set(group,{id:group,blocks:'matching',question:`确认 ${field?.label ?? use.label ?? use.field} 的指标口径、时间范围/粒度、过滤编码及查询标识；区分原文依据与建议。`,paths:[...(gaps.get(group)?.paths ?? []),use.path]});
    return {use,fieldContract:field ?? null,matching:'unresolved',execution:'not-run',evidence:[],candidates:candidates.blocks.map(b=>({id:b.id,heading:b.heading,from:b.from,to:b.to})),omittedMatches:candidates.omittedMatches,conditions:scan.sources[use.source ?? '']?.source ?? null,missing:[group]};
  });
  return {formatVersion:1,pageSha256:pageHash,mdSha256:hashBytes(md),schemaSha256:hashBytes(JSON.stringify(schema)),entries,gaps:[...gaps.values()],diagnostics:scan.diagnostics,
    context:{filters:scan.filters,params:scan.params},coverage:{dataUses:entries.length,indexedBlocks:blocks.length},
    note:'名称检索仅给候选；语义提取与匹配由模型核对原文。无真实查询执行证据，不修改页面。'};
}

function checkEvidence(evidence:Json,lines:string[],errors:string[],location:string):void {
  if(!Number.isInteger(evidence.from)||!Number.isInteger(evidence.to)||evidence.from<1||evidence.to<evidence.from||evidence.to>lines.length) {errors.push(`${location}: invalid evidence range`);return;}
  if(typeof evidence.quote!=='string'||!evidence.quote.trim()||!lines.slice(evidence.from-1,evidence.to).join('\n').includes(evidence.quote)) errors.push(`${location}: quote is not present in source`);
}
export function checkAnalysis(report:Json,draft:Json,md:string):string[] {
  const errors:string[]=[];
  if(report.formatVersion!==1||report.pageSha256!==draft.pageSha256||report.mdSha256!==draft.mdSha256||report.schemaSha256!==draft.schemaSha256) errors.push('Input identity mismatch; rerun analysis');
  if(!Array.isArray(report.entries)||!Array.isArray(report.gaps)) return [...errors,'entries/gaps must be arrays'];
  const originals=new Map<string,Json>(draft.entries.map((e:Json)=>[`${e.use.path}:${e.use.field}`,e]));
  const expected=new Set(originals.keys()),seen=new Set<string>();
  report.entries.forEach((entry:Json,i:number)=>{
    const key=`${entry.use?.path}:${entry.use?.field}`;seen.add(key);
    if(!expected.has(key)) errors.push(`entries/${i}: unknown data use`);
    for(const prop of ['source','slot','componentId','componentType','kind','recordListField']) if(entry.use?.[prop]!==originals.get(key)?.use[prop]) errors.push(`entries/${i}: changed use identity ${prop}`);
    if(!['unresolved','matched','ambiguous','not-found','conflict'].includes(entry.matching)) errors.push(`entries/${i}: invalid matching state`);
    if(entry.execution!=='not-run') errors.push(`entries/${i}: analysis cannot attest execution; use external request/response evidence separately`);
    if(!Array.isArray(entry.evidence)) errors.push(`entries/${i}: evidence must be an array`);
    else {entry.evidence.forEach((e:Json,j:number)=>checkEvidence(e,md.split('\n'),errors,`entries/${i}/evidence/${j}`));
      if(entry.matching==='matched' && (!entry.evidence.length||typeof entry.reason!=='string'||!entry.reason.trim()||typeof entry.metricName!=='string'||!entry.metricName.trim())) errors.push(`entries/${i}: matched requires metricName, evidence and reasoning`);}
    if(entry.matching!=='matched' && (!Array.isArray(entry.missing)||!entry.missing.length)) errors.push(`entries/${i}: unresolved use needs a gap`);
    for(const gap of entry.missing ?? []) if(!report.gaps.some((g:Json)=>g.id===gap && g.paths?.includes(entry.use.path))) errors.push(`entries/${i}: missing gap ${gap}`);
  });
  if(seen.size!==report.entries.length) errors.push('Duplicate data uses');
  for(const key of expected) if(!seen.has(key)) errors.push(`Missing data use: ${key}`);
  return errors;
}
