import {EVALUATION_SCHEMA} from './product-contract';
import {ERROR_TYPES} from '../../../packages/page/src/errors';
import {pageSchema} from '../../../packages/page/src/schema';
import plan from '../../contracts/authored/page-structure-plan.schema.json';

const text={type:'string',minLength:1};
const names={type:'array',items:text};
const object=(properties:Record<string,unknown>,required:string[])=>({type:'object',properties,required,additionalProperties:false});
const baseline=object({documentSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},source:{enum:['file','working-copy']},binding:{type:'object'},workVersion:{type:'integer',minimum:0}},['documentSha256','source']);
const dataRequest=structuredClone(plan.oneOf[0]!.properties.dataRequests.items);
const requirement=object({id:text,text,evidence:{type:'array',items:object({from:{type:'integer',minimum:1},to:{type:'integer',minimum:1},quote:text},['from','to','quote'])}},['id','text']);
const link=object({requirementId:text,dataRequestId:text,useId:text,outputField:text,resultRef:text},['requirementId','dataRequestId','useId','outputField']);
const record={type:'object',required:['resultRef','status','request','binding','dataContextVersion','validationPolicy'],properties:{
  resultRef:text,status:{enum:['ready','empty','pending','failed']},source:{$ref:'#/definitions/queryDataSource'},request:dataRequest,binding:{type:'object'},dataContextVersion:text,validationPolicy:text,
  rows:{type:'array',items:{type:'object'}},totalCount:{type:['integer','null'],minimum:0},returnedCount:{type:'integer',minimum:0},capturedAt:text},
  allOf:[{if:{properties:{status:{enum:['ready','empty']}}},then:{required:['source']}}]};
const context=object({binding:{type:'object'},dataContextVersion:text,validationPolicy:text},['binding','dataContextVersion','validationPolicy']);
const common={documentJson:{type:'string',minLength:2},baseline,evaluation:EVALUATION_SCHEMA,materialText:{type:'string'},context,
  resultRecords:{type:'object',additionalProperties:record}};
const use={type:'object',required:['useId','componentId','componentType','path','kind','identityAmbiguous','pointers','roles','labels'],properties:{
  useId:text,componentId:text,componentType:text,path:text,kind:text,source:text,slot:text,field:text,recordListField:text,identityAmbiguous:{type:'boolean'},pointers:names,roles:names,labels:{type:'array',items:{type:'string'}}}};
const report={type:'object',required:['format','baseline','execution','uses','requirements','dataRequests','links'],properties:{
  format:{const:'metriccanvas-analysis/1'},baseline:{type:'object',required:['documentSha256','source','pageId','schemaSha256','schemaSerialization','materialSha256'],properties:{
    documentSha256:text,source:{enum:['file','working-copy']},pageId:text,schemaSha256:text,schemaSerialization:{const:'JSON.stringify(product-page-schema)'},materialSha256:{type:['string','null']},binding:{type:'object'},workVersion:{type:'integer',minimum:0}}},
  execution:{const:'not-run'},uses:{type:'array',items:use},requirements:{type:'array',items:requirement},dataRequests:{type:'array',items:dataRequest},links:{type:'array',items:link}}};
const analysis=object({...common,requirements:{type:'array',items:requirement},dataRequests:{type:'array',items:dataRequest},links:{type:'array',items:link},
  priorReport:report,componentIds:names},['documentJson','baseline']);
const rebind=object({...common,report,sourceId:text,resultRef:text,
  fieldMap:{type:'object',additionalProperties:text},baselineScope:object({groupBy:names,time:{type:['object','null']},provenance:object({documentSha256:text,sourceId:text,reference:text},['documentSha256','sourceId','reference'])},['groupBy','time','provenance'])},['documentJson','baseline','report','sourceId','resultRef','fieldMap','resultRecords','context']);

const codes=['ANALYSIS_DOCUMENT_INVALID','ANALYSIS_MATERIAL_EVIDENCE_INVALID','ANALYSIS_BASELINE_MISMATCH','ANALYSIS_BASELINE_STALE','ANALYSIS_POSITION_STALE','ANALYSIS_INPUT_INVALID',
  'ANALYSIS_USE_AMBIGUOUS','ANALYSIS_ID_DUPLICATE','ANALYSIS_LINK_DUPLICATE','ANALYSIS_REQUIREMENT_UNKNOWN','ANALYSIS_REQUEST_UNKNOWN','ANALYSIS_USE_UNKNOWN',
  'ANALYSIS_RESULT_MISSING','ANALYSIS_CONTEXT_MISSING','ANALYSIS_OUTPUT_FIELD_UNKNOWN','ANALYSIS_FIELD_CONTRACT_MISMATCH','ANALYSIS_REQUEST_SCOPE_MISMATCH',
  'RESULT_SCOPE_MISMATCH','RESULT_VERSION_STALE','RESULT_VALIDATION_POLICY_CHANGED','RESULT_NOT_READY','RESULT_REFERENCE_MISMATCH',
  'EVALUATION_CONTEXT_REQUIRED','INVALID_EVALUATION_CONTEXT',...ERROR_TYPES];
const describe=(inputSchema:object,outputSchema:object,errorCodes:string[])=>({inputSchema:{...inputSchema,definitions:sourceDefinitions()},outputSchema,errorCodes,sideEffects:'none' as const});

/** Additive descriptions; the adopted thirteen operation descriptions remain unchanged. */
export const EXTENSION_OPERATIONS={
  'page.analyze':describe(analysis,{type:'object',required:['format','baseline','execution','uses','sources','requirements','dataRequests','links','results','indexes','reading','diagnostics','gaps'],
    properties:{format:{const:'metriccanvas-analysis/1'},execution:{const:'not-run'},uses:{type:'array'},results:{type:'array'},gaps:{type:'array'}}},codes),
  'page.rebind':describe(rebind,{type:'object',required:['document','issues','impact','execution','saveStatus'],properties:{document:{type:'object'},issues:{type:'array',maxItems:0},impact:{type:'object'},execution:{const:'not-run'},saveStatus:{const:'not_requested'}}},
    [...codes,'REBIND_SOURCE_MISSING','REBIND_SOURCE_UNSUPPORTED','REBIND_FIELD_MAP_INCOMPLETE','REBIND_FIELD_MAP_AMBIGUOUS','REBIND_FIELD_MISSING',
      'REBIND_FIELD_CONTRACT_MISMATCH','REBIND_BINDING_MISMATCH','REBIND_RESULT_SCOPE_MISMATCH','REBIND_SCOPE_UNPROVEN','REBIND_SCOPE_MISMATCH','REBIND_ROW_KEY_UNPROVEN','REBIND_ROW_KEY_INVALID','REBIND_ROW_KEY_DUPLICATE','REBIND_PINNED_EVIDENCE_INVALID','REBIND_CONSUMER_UNMAPPED','REBIND_CONTEXT_UNSUPPORTED','REBIND_DEPENDENT_UNSUPPORTED'])
};



function sourceDefinitions():Record<string,unknown> {
  const source=(pageSchema as unknown as {definitions:Record<string,unknown>}).definitions,pending=new Set(['queryDataSource']);
  const definitions:Record<string,unknown>={};
  for(const name of pending) {
    definitions[name]=structuredClone(source[name]);
    visitReferences(source[name],pending);
  }
  return definitions;
}
function visitReferences(value:unknown,pending:Set<string>):void {
  if(Array.isArray(value)){value.forEach(child=>visitReferences(child,pending));return;}
  if(!value || typeof value!=='object')return;
  const node=value as Record<string,unknown>;
  if(typeof node.$ref==='string' && node.$ref.startsWith('#/definitions/'))pending.add(node.$ref.slice('#/definitions/'.length));
  Object.values(node).forEach(child=>visitReferences(child,pending));
}
