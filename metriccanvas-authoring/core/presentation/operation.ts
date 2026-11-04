import { parsePage } from '../../../packages/page/src/index';
import { evaluationContextIssue, type TemporalEvaluation } from '../page/evaluation-context';
import { inspectAuthoringPresentation } from './audit';

export function runPresentationOperation(input: Record<string, unknown>) {
  if (!validRequest(input)) {
    return { status: 'error' as const, data: {}, diagnostics: [{ code: 'PRESENTATION_INPUT_INVALID', path: '', message: 'Expected a document and optional inspect action/evaluation/intent' }] };
  }
  const contextIssue = evaluationContextIssue('page.presentation', input);
  if (contextIssue) return { status: 'error' as const, data: {}, diagnostics: [contextIssue] };
  const parsed = parsePage(input.document, { evaluation: input.evaluation as TemporalEvaluation | undefined });
  if (!parsed.ok) return { status: 'error' as const, data: {}, diagnostics: parsed.errors };
  const baseline = input.baseline === undefined ? undefined : parsePage(input.baseline, { evaluation: input.evaluation as TemporalEvaluation | undefined });
  if (baseline && !baseline.ok) return { status: 'error' as const, data: {}, diagnostics: baseline.errors };
  const intent = input.presentationIntent as { rawValuePaths?: string[] } | undefined;
  const data = inspectAuthoringPresentation(parsed.page, { baseline: baseline?.ok ? baseline.page : undefined, rawValuePaths: intent?.rawValuePaths });
  return { status: data.findings.length ? 'partial' as const : 'ok' as const, data, diagnostics: data.findings };
}

function validIntent(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const intent = value as { rawValuePaths?: unknown };
  if (Object.keys(intent).some(key => key !== 'rawValuePaths')) return false;
  return intent.rawValuePaths === undefined || Array.isArray(intent.rawValuePaths) && intent.rawValuePaths.every(path => typeof path === 'string') && new Set(intent.rawValuePaths).size === intent.rawValuePaths.length;
}

function validRequest(input: Record<string, unknown>): boolean {
  return Boolean(input && typeof input === 'object' && 'document' in input
    && !Object.keys(input).some(key => !['document', 'baseline', 'presentationIntent', 'action', 'evaluation'].includes(key))
    && (input.action === undefined || input.action === 'inspect') && validIntent(input.presentationIntent));
}
