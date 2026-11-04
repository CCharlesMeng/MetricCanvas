import {createHash} from 'node:crypto';
import {pageSchema} from '../../packages/page/src/schema';
import {parsePage} from '../../packages/page/src/validate';
import {evaluationContextIssue} from '../../metriccanvas-authoring/core/page/evaluation-context';
import {analyzePageData} from '../../metriccanvas-authoring/core/page/analysis-report';
import {rebindPageSource} from '../../metriccanvas-authoring/core/page/source-rebind';
import {canonicalizeJson} from '../../packages/page/src/canonical-json';
import {issue,type AnalysisInput,type Json} from '../../metriccanvas-authoring/core/page/analysis-types';

export const rawSha256=(text:string)=>createHash('sha256').update(text,'utf8').digest('hex');

/** Byte hashing and parsing are adapters, kept out of the page-domain pure modules. */
export function prepareAnalysisInput(input:Json):{value?:AnalysisInput;issues:Json[]} {
  let document:Json;
  try {document=JSON.parse(input.documentJson);}
  catch {return {issues:[issue('ANALYSIS_DOCUMENT_INVALID','/documentJson','The complete original page must be valid JSON')]};}
  if(!document || typeof document!=='object' || Array.isArray(document))return {issues:[issue('ANALYSIS_DOCUMENT_INVALID','/documentJson','A complete page object is required')]};
  if(input.baseline.source==='working-copy' && (input.baseline.binding===undefined || input.baseline.workVersion===undefined))return {issues:[issue('ANALYSIS_BASELINE_MISMATCH','/baseline','A working-copy baseline requires its full binding and workVersion')]};
  if(rawSha256(input.documentJson)!==input.baseline.documentSha256)return {issues:[issue('ANALYSIS_BASELINE_MISMATCH','/baseline/documentSha256','Raw UTF-8 bytes differ; a reserialized document hash cannot stand in for the original bytes')]};
  if(input.baseline.binding && input.context && canonicalizeJson(input.baseline.binding)!==canonicalizeJson(input.context.binding))return {issues:[issue('RESULT_SCOPE_MISMATCH','/context/binding','Page baseline and result context belong to different bindings')]};
  const temporal=evaluationContextIssue('page.validate',{document,evaluation:input.evaluation});
  if(temporal)return {issues:[temporal]};
  const parsed=parsePage(document,{evaluation:input.evaluation});
  if(!parsed.ok)return {issues:parsed.errors};
  return {issues:[],value:{...input,document,schema:pageSchema,baseline:{...input.baseline,pageId:document.id,
    schemaSha256:rawSha256(JSON.stringify(pageSchema)),schemaSerialization:'JSON.stringify(product-page-schema)',
    materialSha256:input.materialText===undefined?null:rawSha256(input.materialText)}} as AnalysisInput};
}

export function invokeAnalysisOperation(operation:string,input:Json) {
  const prepared=prepareAnalysisInput(input);
  if(!prepared.value)return {status:'error',data:{},diagnostics:prepared.issues};
  try {
    if(operation==='page.rebind') {
      const data=rebindPageSource(prepared.value as Parameters<typeof rebindPageSource>[0]);
      return {status:data.issues.length?'error':'ok',data,diagnostics:data.issues};
    }
    const {report,issues}=analyzePageData(prepared.value);
    const status=issues.length?'error':report.gaps.length || report.diagnostics.length?'partial':'ok';
    return {status,data:report,diagnostics:report.diagnostics};
  } catch(cause) {
    return {status:'error',data:{},diagnostics:[issue('ANALYSIS_INPUT_INVALID','',String(cause))]};
  }
}
