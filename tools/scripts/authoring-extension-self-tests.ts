import sample from '../../metriccanvas-authoring/core/page/association-sample.json';
import {rawSha256} from './authoring-analysis-adapter';
import {runAnalysisOperation} from './authoring-analysis-program';

/** Fixed business vectors; only current release byte/Schema identities are prepared at build time. */
export function extensionSelfTests() {
  const documentJson=JSON.stringify(sample.document,null,2)+'\n';
  const baseline={documentSha256:rawSha256(documentJson),source:'file'};
  const record={resultRef:sample.resultRef,status:'ready',...sample.context,request:sample.request,source:sample.source,
    rows:[{'成交额':20}],returnedCount:1,totalCount:1,capturedAt:'2026-07-01T00:00:00Z'};
  const analyze={documentJson,baseline,requirements:sample.requirements,dataRequests:[sample.request],links:sample.links,
    context:sample.context,resultRecords:{[sample.resultRef]:record}};
  const result=runAnalysisOperation('page.analyze',analyze);
  if(result.status!=='ok')throw Error('The fixed association self-test failed during preparation');
  const rebind={documentJson,baseline,report:result.data,sourceId:'sales',resultRef:sample.resultRef,fieldMap:sample.fieldMap,
    context:sample.context,resultRecords:analyze.resultRecords,baselineScope:{groupBy:[],time:null,
      provenance:{documentSha256:baseline.documentSha256,sourceId:'sales',reference:'self-test-total-grain-fact'}}};
  return [
    {operation:'page.analyze',input:analyze,expectedStatus:'ok'},
    {operation:'page.analyze',input:{...analyze,baseline:{...baseline,documentSha256:'0'.repeat(64)}},expectedStatus:'error',expectedDiagnostic:'ANALYSIS_BASELINE_MISMATCH'},
    {operation:'page.rebind',input:rebind,expectedStatus:'ok'},
    {operation:'page.rebind',input:{...rebind,fieldMap:{amount:'absent-field'}},expectedStatus:'error',expectedDiagnostic:'REBIND_FIELD_MISSING'}
  ];
}
