import type { TemporalEvaluation } from './temporal-evaluation';
import { parsePage } from './validate';
import { canonicalizeJson } from './canonical-json';
import { collectParameterCandidates } from './extract-param-candidates';
import { applyParameterCandidates } from './apply-param-candidates';
import type { PageParamValue, TextValue } from './page-param-types';
import type { ParamResolutionIssue } from './resolve-page-params';
import type { PageDocument } from './page-document';
import type {
  ExtractionContext,
  PageParamExtraction,
  ParameterCandidate,
} from './edit/param-extraction-types';

export type { ExtractionContext, PageParamExtraction, ParameterCandidate };
type Failure = { ok: false; issues: ParamResolutionIssue[] };

/** Deterministic authoring algorithm. No model, query execution, persistence or discovery. */
export function extractPageParams(input: unknown, context: ExtractionContext, evaluation?: TemporalEvaluation): PageParamExtraction | Failure {
  const valid = parsePage(input, {evaluation});
  if (!valid.ok) return { ok: false, issues: valid.errors.map(e => ({ code: 'INVALID_PAGE', path: e.path, message: e.message })) };
  if (!context.baseline) return { ok: false, issues: [{ code: 'INVALID_PAGE', path: '/dataSources', message: '提取需要最终已验证查询的精确基线' }] };
  const source = JSON.parse(JSON.stringify(input)) as PageDocument;
  return { ok: true, baseline: context.baseline, source, sourceKey: canonicalizeJson(source), ...collectParameterCandidates(source, context) };
}

export function applyPageParamSelection(extraction: PageParamExtraction, selectedIds: readonly string[], textReplacements: Readonly<Record<string, TextValue>> = {}, evaluation?: TemporalEvaluation): { ok: true; document: PageDocument; originalValues: Record<string, PageParamValue>; issues: [] } | Failure {
  return applyParameterCandidates(extraction, selectedIds, textReplacements, evaluation);
}
