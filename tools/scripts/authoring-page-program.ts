import { runAuthoringPageOperation } from '../../metriccanvas-authoring/core/page/product';
import { checkTemporalEvaluation } from '../../metriccanvas-authoring/core/page/evaluation-context';
import {runAnalysisOperation} from './authoring-analysis-program';
import {runPresentationOperation} from '../../metriccanvas-authoring/core/presentation/operation';

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
try {
  const request = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const result = request.operation === 'internal.evaluation.validate'
    ? checkTemporalEvaluation(request.input?.evaluation)
    : request.operation==='page.presentation'
      ? runPresentationOperation(request.input)
      : ['page.analyze','page.rebind'].includes(request.operation)
      ? runAnalysisOperation(request.operation,request.input)
      : runAuthoringPageOperation(request.operation, request.input);
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exitCode = result.status === 'error' ? 2 : 0;
} catch (cause) {
  process.stderr.write(String(cause) + '\n');
  process.exitCode = 3;
}
