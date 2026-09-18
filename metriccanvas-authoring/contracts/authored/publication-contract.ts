/** Internal publication/1. No provider HTTP, hash algorithm, clock or authorization implementation. */
export const publicationSchemaId = 'https://metriccanvas.dev/contracts/authoring/publication/1';
export type JsonSchema = Record<string, any>;
export interface ContractIssue { code: string; path: string }
export interface StructureContext { validatePageStructure?: (value: unknown) => boolean }
interface Node<T> {
  schema: JsonSchema;
  check(value: unknown, path: string, context: StructureContext): ContractIssue[];
  readonly valueType?: T;
}
type Value<N> = N extends Node<infer T> ? T : never;
const issue = (path: string, code = 'STRUCTURE_ERROR'): ContractIssue[] => [{code,path}];
const record = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const pointer = (key: string) => key.replaceAll('~','~0').replaceAll('/','~1');
const text: Node<string> = {schema:{type:'string',minLength:1},check:(value,path)=>typeof value==='string'&&value.length>0?[]:issue(path)};
const bool: Node<boolean> = {schema:{type:'boolean'},check:(value,path)=>typeof value==='boolean'?[]:issue(path)};
const anyValue: Node<unknown> = {schema:{},check:()=>[]};
function choices<const T extends readonly (string | boolean | null)[]>(...values:T): Node<T[number]> {
  return {schema:{enum:values},check:(value,path)=>values.includes(value as T[number])?[]:issue(path)};
}
function array<N extends Node<any>>(item:N, minimum=0): Node<Value<N>[]> {
  return {schema:{type:'array',items:item.schema,minItems:minimum},check:(value,path,context)=>Array.isArray(value)&&value.length>=minimum?value.flatMap((entry,index)=>item.check(entry,`${path}/${index}`,context)):issue(path)};
}
function object<const F extends Record<string,Node<any>>, const O extends readonly (keyof F)[]>(fields:F, optional:O): Node<{[K in Exclude<keyof F,O[number]>]:Value<F[K]>}&{[K in O[number]]?:Value<F[K]>}> {
  const required=Object.keys(fields).filter(key=>!optional.includes(key));
  return {schema:{type:'object',additionalProperties:false,properties:Object.fromEntries(Object.entries(fields).map(([key,node])=>[key,node.schema])),required},check:(value,path,context)=>{
    if(!record(value))return issue(path);
    return [...required.filter(key=>!Object.prototype.hasOwnProperty.call(value,key)).flatMap(key=>issue(`${path}/${pointer(key)}`)),...Object.keys(value).flatMap(key=>Object.prototype.hasOwnProperty.call(fields,key)?fields[key].check(value[key],`${path}/${pointer(key)}`,context):issue(`${path}/${pointer(key)}`))];
  }};
}
function union<const N extends readonly Node<any>[]>(...nodes:N): Node<Value<N[number]>> {
  return {schema:{anyOf:nodes.map(node=>node.schema)},check:(value,path,context)=>nodes.some(node=>node.check(value,path,context).length===0)?[]:issue(path)};
}
const definitions: Record<string,Node<any>> = {};
function named<N extends Node<any>>(name:string,node:N): N {
  definitions[name]=node;
  return {...node,schema:{$ref:`#/$defs/${name}`}};
}
const draftRef=named('DraftRef',object({pageId:text,revisionId:text,resourceId:text},[]));
const candidateRef=named('CandidateRef',object({candidateId:text,candidateVersion:text,source:draftRef},[]));
const templateRef=named('TemplateRef',object({templateId:text,templateRevisionId:text,source:draftRef},[]));
const origin=union(object({kind:choices('manual')},[]),object({kind:choices('relay'),skillVersion:text,sessionId:text,runId:text},['sessionId','runId']));
const operationContext=named('OperationContext',object({operationId:text,actorId:text,workspaceId:text,origin},[]));
const target=named('ParameterTarget',object({dataSourceId:text,queryField:text},[]));
const parameter=named('ParameterSummary',object({
  parameterId:text,label:text,valueType:choices('string','string[]','time','timeRange'),selected:bool,required:bool,
  valueState:choices('retained','missing','not-selected'),defaultValue:union(text,array(text)),
  targets:array(target),extractionKind:choices('dimension-eq','dimension-in','time-range',null),sharing:choices('none','identical-values'),
  originalValue:anyValue,uncoveredQueries:array(text)
},['defaultValue','originalValue','uncoveredQueries']));
const diff=named('ReviewDiff',object({summary:text,sourcePath:text,candidatePath:text,parameterId:text,before:anyValue,after:anyValue},['sourcePath','candidatePath','parameterId','before','after']));
const validationIssue=named('ValidationIssue',object({severity:choices('blocking','warning'),code:text,message:text,parameterId:text,path:text},['parameterId','path']));
const validation=named('CandidateValidation',object({valid:bool,issues:array(validationIssue)},[]));
const page: Node<Record<string,unknown>> = {schema:{$ref:'#/$defs/Page'},check:(value,path,context)=>context.validatePageStructure?.(value)?[]:issue(path,context.validatePageStructure?'PAGE_STRUCTURE_ERROR':'PAGE_VALIDATOR_REQUIRED')};
const candidate=named('Candidate',object({
  ref:candidateRef,document:page,contentHash:text,canonicalization:text,expiresAt:text,leaseId:text,leaseExpiresAt:text,
  diff:array(diff),affectedDataSources:array(text),parameterSummary:array(parameter),retainDimensionValues:bool,
  validation,reviewHash:text,reviewCanonicalization:text
},[]));
const confirmation=named('Confirmation',object({
  actorId:text,workspaceId:text,candidate:candidateRef,source:draftRef,retainDimensionValues:bool,
  contentHash:text,canonicalization:text,reviewHash:text,reviewCanonicalization:text,leaseId:text,expiresAt:text,proof:text
},[]));
const corrections=named('Corrections',object({retainDimensionValues:bool,parameterSelections:array(object({parameterId:text,selected:bool},[]),1)},['retainDimensionValues','parameterSelections']));
definitions.Corrections.schema.minProperties=1;
const correctionCheck=definitions.Corrections.check;
definitions.Corrections.check=(value,path,context)=>record(value)&&Object.keys(value).length===0?issue(path):correctionCheck(value,path,context);
// Named references delegate through the definition so its constraints stay single-source.
corrections.check=(value,path,context)=>definitions.Corrections.check(value,path,context);
const prepare=named('PrepareRequest',object({kind:choices('prepare'),context:operationContext,source:draftRef,retainDimensionValues:bool},[]));
const revise=named('ReviseRequest',object({kind:choices('revise'),context:operationContext,ref:candidateRef,corrections},[]));
const publish=named('PublishRequest',object({kind:choices('publish'),context:operationContext,ref:candidateRef,confirmationToken:text},[]));
const read=named('ReadRequest',object({kind:choices('read'),ref:candidateRef},[]));
named('Request',union(prepare,revise,publish,read));
const operationKind=choices('prepare','revise','publish');
const pending=object({status:choices('pending','unknown'),operationKind,operationId:text},[]);
const rejected=object({status:choices('rejected'),operationKind,operationId:text,code:text,retryable:choices(false)},[]);
const prepared=object({status:choices('completed'),operationKind:choices('prepare','revise'),operationId:text,candidate},[]);
const published=object({status:choices('completed'),operationKind:choices('publish'),operationId:text,template:templateRef},[]);
const mutation=named('MutationOutcome',union(prepared,published,pending,rejected));
const lookup=named('LookupOutcome',union(mutation,object({status:choices('not-applied'),operationKind,operationId:text,retrySafe:bool},[])));

export type DraftRef=Value<typeof draftRef>;
export type CandidateRef=Value<typeof candidateRef>;
export type TemplateRef=Value<typeof templateRef>;
export type OperationContext=Value<typeof operationContext>;
export type Candidate=Value<typeof candidate>;
export type Confirmation=Value<typeof confirmation>;
export type Corrections=Value<typeof corrections>;
export type MutationRequest=Value<typeof prepare>|Value<typeof revise>|Value<typeof publish>;
export type Request=MutationRequest|Value<typeof read>;
export type MutationOutcome=Value<typeof mutation>;
export type LookupOutcome=Value<typeof lookup>;
export type DefinitionName='DraftRef'|'CandidateRef'|'TemplateRef'|'OperationContext'|'Candidate'|'Confirmation'|'Corrections'|'Request'|'MutationOutcome'|'LookupOutcome';

/** Page structure is supplied by the existing product author, never restated here. */
export function buildPublicationSchema(pageSchema: JsonSchema): JsonSchema {
  function relocate(value:any):any {
    if(Array.isArray(value))return value.map(relocate);
    if(record(value))return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='$schema'&&key!=='$id').map(([key,child])=>[key,key==='$ref'&&typeof child==='string'&&child.startsWith('#/')?`#/$defs/Page/${child.slice(2)}`:relocate(child)]));
    return value;
  }
  return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:publicationSchemaId,$ref:'#/$defs/Request',$defs:{...Object.fromEntries(Object.entries(definitions).map(([name,node])=>[name,structuredClone(node.schema)])),Page:relocate(pageSchema)}};
}
export function validatePublicationStructure(definition:DefinitionName,value:unknown,context:StructureContext={}): ContractIssue[] {
  return definitions[definition]?.check(value,'',context)??issue('','UNKNOWN_DEFINITION');
}

export const reviewFields=['ref','contentHash','canonicalization','diff','affectedDataSources','parameterSummary','retainDimensionValues','validation','expiresAt','leaseId','leaseExpiresAt'] as const;
/** This selects the exact verification input; it does not compute or authenticate a hash. */
export function candidateReviewPayload(value:Candidate): Pick<Candidate,typeof reviewFields[number]> {
  return structuredClone(Object.fromEntries(reviewFields.map(key=>[key,value[key]]))) as Pick<Candidate,typeof reviewFields[number]>;
}

/** Source has already passed the adapter's exact-ref, identity and original-hash checks. */
export interface VerifiedSource { ref: DraftRef; document: Record<string,any> }
export interface CandidateContext {
  validatePage: (value: unknown) => boolean;
  source?: VerifiedSource;
}
function canonical(value:unknown):string {
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(record(value))return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value)??'<undefined>';
}
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
const own=(value:object,key:string)=>Object.prototype.hasOwnProperty.call(value,key);
function parameterTargets(document:Record<string,any>,id:string): Array<{dataSourceId:string;queryField:string}> {
  const targets: Array<{dataSourceId:string;queryField:string}>=[];
  for(const [dataSourceId,dataSource] of Object.entries(document.dataSources??{})) {
    const source=(dataSource as any).source;
    const binding=source?.type==='query'?source.query?.paramBindings?.[id]:undefined;
    if(binding)targets.push({dataSourceId,queryField:binding.queryField});
    const filter=source?.type==='query'?source.query?.body?.dsl_list?.[0]?.filter:undefined;
    for(const dim of filter?.dims??[])if(dim.dim_value_list?.param===id)targets.push({dataSourceId,queryField:dim.dim_name});
    if(filter?.time?.start?.param===id)targets.push({dataSourceId,queryField:'time'});
  }
  return targets;
}
const sortedTargets=(targets:Array<{dataSourceId:string;queryField:string}>)=>targets.map(canonical).sort();

/** Structural/relational checks only. This cannot authenticate a source, review or extraction. */
export function validateCandidateRelations(value:Candidate,context:CandidateContext): ContractIssue[] {
  const errors:ContractIssue[]=[];
  const fail=(path:string,code='CANDIDATE_MISMATCH')=>errors.push({code,path});
  const document=value.document as Record<string,any>;
  if(!context.validatePage(document))return issue('/document','PAGE_INVALID');
  if(document.id!==value.ref.source.pageId)fail('/ref/source/pageId');
  const params=new Map<string,any>((document.params??[]).map((param:any)=>[param.id,param]));
  const inline=[...params.values()].some(p=>p.type==='timeRange'||own(p,'value'))||Object.values(document.dataSources??{}).some((ds:any)=>{
    const filter=ds.source?.query?.body?.dsl_list?.[0]?.filter;
    return filter?.time?.start?.param!==undefined||filter?.dims?.some((d:any)=>d.dim_value_list?.param!==undefined);
  });
  const dimensions=new Map([...params].filter(([,param])=>param.type==='dimension'||inline&&['time','timeRange'].includes(param.type)));
  if(inline&&(value.retainDimensionValues||Object.values(document.dataSources??{}).some((ds:any)=>ds.source.type==='query'&&own(ds.source,'initial'))))fail('/document');
  const summaries=new Map<string,Value<typeof parameter>>();
  const source=context.source;
  if(source && (!same(source.ref,value.ref.source)||source.document.id!==source.ref.pageId||!context.validatePage(source.document)))fail('/ref/source','SOURCE_MISMATCH');
  const sourceParams=new Map<string,any>((source?.document.params??[]).map((param:any)=>[param.id,param]));
  for(const [index,entry] of value.parameterSummary.entries()) {
    const p=`/parameterSummary/${index}`;
    if(summaries.has(entry.parameterId))fail(`${p}/parameterId`);
    summaries.set(entry.parameterId,entry);
    const targets=sortedTargets(entry.targets);
    if(new Set(targets).size!==targets.length)fail(`${p}/targets`);
    for(const [targetIndex,target] of entry.targets.entries())if(document.dataSources[target.dataSourceId]?.source?.type!=='query')fail(`${p}/targets/${targetIndex}/dataSourceId`);
    if(!entry.selected) {
      if(entry.valueState!=='not-selected'||own(entry,'defaultValue')||params.has(entry.parameterId))fail(p);
      // Only selected, preserved declarations can be classified as pre-existing.
      if(entry.extractionKind===null)fail(`${p}/extractionKind`);
      continue;
    }
    const declaration=dimensions.get(entry.parameterId);
    if(!declaration){fail(`${p}/parameterId`);continue;}
    if(entry.valueType!==(['time','timeRange'].includes(declaration.type)?declaration.type:declaration.multiple===true?'string[]':'string'))fail(`${p}/valueType`);
    if(entry.required!==(declaration.required??true))fail(`${p}/required`);
    if(inline&&(own(declaration,'value')||own(declaration,'default')))fail(`${p}/valueState`);
    if(!same(targets,sortedTargets(parameterTargets(document,entry.parameterId))))fail(`${p}/targets`);
    if(entry.valueState==='retained') {
      if(!own(entry,'defaultValue')||!own(declaration,'default')||!same(entry.defaultValue,declaration.default))fail(`${p}/defaultValue`);
    } else if(entry.valueState!=='missing'||own(entry,'defaultValue')||own(declaration,'default'))fail(`${p}/valueState`);
    if(entry.extractionKind===null) {
      if(!source)fail(p,'SOURCE_REQUIRED');
      else if(!dimensions.has(entry.parameterId)||!same(sourceParams.get(entry.parameterId),declaration)||
        !same(sortedTargets(parameterTargets(source.document,entry.parameterId)),targets))fail(p,'EXISTING_PARAMETER_CHANGED');
    } else {
      if(entry.extractionKind!==(declaration.type==='timeRange'?'time-range':declaration.multiple===true?'dimension-in':'dimension-eq'))fail(`${p}/extractionKind`);
      if(!entry.targets.length)fail(`${p}/targets`);
      if(!value.retainDimensionValues&&entry.valueState==='retained')fail(`${p}/valueState`);
    }
    if(entry.targets.length>1&&entry.sharing!=='identical-values')fail(`${p}/sharing`);
  }
  for(const id of dimensions.keys())if(!summaries.get(id)?.selected)fail('/parameterSummary');
  if(new Set(value.affectedDataSources).size!==value.affectedDataSources.length)fail('/affectedDataSources');
  for(const [index,id] of value.affectedDataSources.entries())if(document.dataSources[id]?.source?.type!=='query')fail(`/affectedDataSources/${index}`);
  if(value.validation.valid!==!value.validation.issues.some(entry=>entry.severity==='blocking'))fail('/validation/valid');
  for(const [index,entry] of value.validation.issues.entries())if(entry.parameterId&&!summaries.has(entry.parameterId))fail(`/validation/issues/${index}/parameterId`);
  for(const [index,entry] of value.diff.entries())if(entry.parameterId&&!summaries.has(entry.parameterId))fail(`/diff/${index}/parameterId`);
  if(source) {
    const preserved=(param:any)=>inline?!['dimension','time','timeRange'].includes(param.type):param.type!=='dimension';
    const existing=[...sourceParams].filter(([,param])=>preserved(param));
    const retained=[...params].filter(([,param])=>preserved(param));
    if(!same(existing.sort(([a],[b])=>a<b?-1:a>b?1:0),retained.sort(([a],[b])=>a<b?-1:a>b?1:0)))fail('/document/params','NON_DIMENSION_PARAMETER_CHANGED');
  }
  return errors;
}

/** No current time check: proof authenticity/expiry and publication authorization belong to trusted ports. */
export function validateConfirmationRelations(value:Confirmation,candidate:Candidate,identity:{actorId:string;workspaceId:string}):ContractIssue[] {
  const errors:ContractIssue[]=[];
  const fail=(path:string)=>errors.push({code:'CONFIRMATION_MISMATCH',path});
  if(value.actorId!==identity.actorId||value.workspaceId!==identity.workspaceId)fail('/actorId');
  if(!same(value.candidate,candidate.ref)||!same(value.source,candidate.ref.source))fail('/candidate');
  for(const key of ['retainDimensionValues','contentHash','canonicalization','reviewHash','reviewCanonicalization','leaseId'] as const)if(!same(value[key],candidate[key]))fail(`/${key}`);
  if(!candidate.validation.valid)errors.push({code:'VALIDATION_BLOCKED',path:'/validation'});
  return errors;
}
export function validateCorrectionsRelations(value:Corrections,candidate:Candidate):ContractIssue[] {
  const ids=new Set<string>();const known=new Set(candidate.parameterSummary.map(entry=>entry.parameterId));
  return (value.parameterSelections??[]).flatMap((entry,index)=>{
    const invalid=ids.has(entry.parameterId)||!known.has(entry.parameterId);ids.add(entry.parameterId);
    return invalid?issue(`/parameterSelections/${index}/parameterId`,'CORRECTION_MISMATCH'):[];
  });
}
/** A matching replay is not a new authorization. verifyResult must still validate the complete original request. */
export function validateResultRelations(request:MutationRequest,result:LookupOutcome):ContractIssue[] {
  const errors:ContractIssue[]=[];const fail=(path:string)=>errors.push({code:'RESULT_MISMATCH',path});
  const kind=request.kind;
  if(result.operationKind!==kind||result.operationId!==request.context.operationId)fail('/operationId');
  if(result.status!=='completed')return errors;
  if(request.kind==='publish') {
    if(result.operationKind!=='publish'||!('template' in result)||!same(result.template.source,request.ref.source))fail('/template/source');
  } else {
    if(!('candidate' in result)){fail('/candidate');return errors;}
    const candidate=result.candidate;
    if(request.kind==='prepare') {
      if(!same(candidate.ref.source,request.source)||candidate.retainDimensionValues!==request.retainDimensionValues)fail('/candidate');
    } else {
      if(candidate.ref.candidateId!==request.ref.candidateId||candidate.ref.candidateVersion===request.ref.candidateVersion||!same(candidate.ref.source,request.ref.source))fail('/candidate/ref');
      if(request.corrections.retainDimensionValues!==undefined&&candidate.retainDimensionValues!==request.corrections.retainDimensionValues)fail('/candidate/retainDimensionValues');
      for(const selection of request.corrections.parameterSelections??[])if(candidate.parameterSummary.find(entry=>entry.parameterId===selection.parameterId)?.selected!==selection.selected)fail('/candidate/parameterSummary');
    }
  }
  return errors;
}
