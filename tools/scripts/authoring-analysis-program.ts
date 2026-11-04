import {checkTemporalEvaluation} from '../../metriccanvas-authoring/core/page/evaluation-context';
import {analysisInputIssues} from '../../metriccanvas-authoring/core/page/extension-input';
import {invokeAnalysisOperation} from './authoring-analysis-adapter';

export function runAnalysisOperation(operation:string,input:unknown) {
  if(input && typeof input==='object' && 'evaluation' in input) {
    const checked=checkTemporalEvaluation(input.evaluation);
    if(checked.status==='error')return checked;
  }
  const diagnostics=analysisInputIssues(operation,input);
  if(diagnostics.length)return {status:'error',data:{},diagnostics};
  return invokeAnalysisOperation(operation,input as Record<string,any>);
}
