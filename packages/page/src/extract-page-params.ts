import {ordinaryQuery} from './time-mode';
import { parsePage } from './validate';
import { canonicalizeJson } from './canonical-json';
import { collectParameterCandidates } from './extract-param-candidates';
import { applyParameterCandidates } from './apply-param-candidates';
import type { TimeWindow } from './time-param';
import type { PageParamDeclaration, PageParamValue, TextValue } from './page-param';
import type { ParamResolutionIssue } from './resolve-page-params';
import type { PageDocument } from './page-document';

export interface ParameterCandidate {
  id:string; identity:string; declaration:PageParamDeclaration; originalValue:PageParamValue;
  locations:Array<{dataSourceId:string;path:string;queryField?:string;filterId?:string;window?:TimeWindow;valueFormat?:"iso"|"compact";datePredicate?:boolean}>;
  existingParamId?:string; dateForm?:"month"|"monthRange"|"date"|"dateRange";
  coveredQueries:string[]; uncoveredQueries:string[]; defaultSelected:boolean;
}
export interface ExtractionContext {
  /** Exact verified revision; authenticity and DQE verification belong to the calling trusted program. */
  baseline:string;
  timePointFields?:Readonly<Record<string,Readonly<Record<string,{granularity:"month"|"date";valueFormat?:"iso"|"compact";identity?:string}>>>>;
  timeIdentities?:Readonly<Record<string,string>>;
  dimensionIdentities?:Readonly<Record<string,Readonly<Record<string,string>>>>;
  previousCandidates?:readonly ParameterCandidate[];
}
export interface PageParamExtraction {
  ok:true; baseline:string; source:PageDocument; sourceKey:string;
  candidates:ParameterCandidate[]; skipped:Array<{path:string;reason:string}>;
}
type Failure = { ok: false; issues: ParamResolutionIssue[] };

/** Deterministic authoring algorithm. No model, query execution, persistence or discovery. */
export function extractPageParams(input: unknown, context: ExtractionContext): PageParamExtraction | Failure {
  const valid = parsePage(input);
  if (!valid.ok) return { ok: false, issues: valid.errors.map(e => ({ code: 'INVALID_PAGE', path: e.path, message: e.message })) };
  if (!context.baseline) return { ok: false, issues: [{ code: 'INVALID_PAGE', path: '/dataSources', message: '提取需要最终已验证查询的精确基线' }] };
  const source = JSON.parse(JSON.stringify(input)) as PageDocument;
  return { ok: true, baseline: context.baseline, source, sourceKey: canonicalizeJson(source), ...collectParameterCandidates(source, context) };
}

export function applyPageParamSelection(extraction: PageParamExtraction, selectedIds: readonly string[], textReplacements: Readonly<Record<string, TextValue>> = {}): { ok: true; document: PageDocument; originalValues: Record<string, PageParamValue>; issues: [] } | Failure {
  return applyParameterCandidates(extraction, selectedIds, textReplacements);
}
