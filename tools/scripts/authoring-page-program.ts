import { runAuthoringPageOperation } from '../../metriccanvas-authoring/core/page/product';
import { checkTemporalEvaluation } from '../../metriccanvas-authoring/core/page/evaluation-context';
import {runAnalysisOperation} from './authoring-analysis-program';
import {runPresentationOperation} from '../../metriccanvas-authoring/core/presentation/operation';
import {createInterface} from 'node:readline';

function runRequest(request: {operation: string; input: Record<string, unknown>}) {
  return request.operation === 'internal.evaluation.validate'
    ? checkTemporalEvaluation(request.input?.evaluation)
    : request.operation==='page.presentation'
      ? runPresentationOperation(request.input)
      : ['page.analyze','page.rebind'].includes(request.operation)
      ? runAnalysisOperation(request.operation,request.input)
      : runAuthoringPageOperation(request.operation, request.input);
}

async function validationSession() {
  const lines = createInterface({input: process.stdin, crlfDelay: Infinity});
  for await (const line of lines) {
    const message = JSON.parse(line);
    if (!Number.isSafeInteger(message.sequence) || message.request?.operation !== 'page.validate') {
      throw new Error('Invalid internal validation request');
    }
    const receipt = runAuthoringPageOperation('page.validate', message.request.input);
    process.stdout.write(JSON.stringify({sequence: message.sequence,
      returncode: receipt.status === 'error' ? 2 : 0, receipt}) + '\n');
  }
}

try {
  if (process.argv.includes('--validation-session')) await validationSession();
  else {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
    const result = runRequest(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exitCode = result.status === 'error' ? 2 : 0;
  }
} catch (cause) {
  process.stderr.write(String(cause) + '\n');
  process.exitCode = 3;
}
