import { temporalEvaluationIssue, type TemporalEvaluation } from '../../../packages/page/src/temporal-evaluation';

/** Only operations reaching date-sensitive product rules require a business clock. */
function requiresEvaluation(operation: string, input: Record<string, any>): boolean {
  if (operation === 'page.scan') return false;
  const filters = input.document?.filters;
  if (!Array.isArray(filters)) return false;
  return filters.some(filter => {
    if (!filter || typeof filter !== 'object') return false;
    if (filter.type === 'timePoint' && filter.default !== undefined && filter.disableFuture === true) return true;
    const resolving = operation === 'page.parameters' && input.action !== 'extract';
    return resolving && (filter.type === 'timePoint' || filter.type === 'timeRange') && filter.disableFuture !== false;
  });
}

export function evaluationContextIssue(operation: string, input: Record<string, any>) {
  if (input.evaluation !== undefined) {
    const message = temporalEvaluationIssue(input.evaluation);
    return message ? { code: 'INVALID_EVALUATION_CONTEXT', path: '/evaluation', message } : undefined;
  }
  return requiresEvaluation(operation, input)
    ? { code: 'EVALUATION_CONTEXT_REQUIRED', path: '/evaluation', message: 'This time-sensitive calculation requires an explicit instant and IANA business timeZone' }
    : undefined;
}

/** Program-only check for non-page operations; not registered as a public operation. */
export function checkTemporalEvaluation(evaluation: unknown) {
  const missing = evaluation === undefined;
  const message = missing ? 'An explicit instant and IANA business timeZone are required' : temporalEvaluationIssue(evaluation);
  const code = missing ? 'EVALUATION_CONTEXT_REQUIRED' : 'INVALID_EVALUATION_CONTEXT';
  const diagnostics = message ? [{ code, path: '/evaluation', message }] : [];
  return { status: message ? 'error' as const : 'ok' as const, data: { ok: !message }, diagnostics };
}

export type { TemporalEvaluation };
