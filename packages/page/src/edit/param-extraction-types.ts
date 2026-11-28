import type { PageDocument } from '../page-document';
import type { PageParamDeclaration, PageParamValue } from '../page-param-types';
import type { TimeWindow } from '../time-param';

/**
 * Pure leaf type definitions shared by `extract-page-params.ts`,
 * `extract-param-candidates.ts`, and `apply-param-candidates.ts`.
 */

export interface ParameterCandidate {
  id: string;
  identity: string;
  declaration: PageParamDeclaration;
  originalValue: PageParamValue;
  locations: Array<{
    dataSourceId: string;
    path: string;
    queryField?: string;
    filterId?: string;
    window?: TimeWindow;
    valueFormat?: 'iso' | 'compact';
    datePredicate?: boolean;
  }>;
  existingParamId?: string;
  dateForm?: 'month' | 'monthRange' | 'date' | 'dateRange';
  coveredQueries: string[];
  uncoveredQueries: string[];
  defaultSelected: boolean;
}

export interface ExtractionContext {
  /** Exact verified revision; authenticity and DQE verification belong to the calling trusted program. */
  baseline: string;
  timePointFields?: Readonly<
    Record<
      string,
      Readonly<
        Record<
          string,
          { granularity: 'month' | 'date'; valueFormat?: 'iso' | 'compact'; identity?: string }
        >
      >
    >
  >;
  timeIdentities?: Readonly<Record<string, string>>;
  dimensionIdentities?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  previousCandidates?: readonly ParameterCandidate[];
}

export interface PageParamExtraction {
  ok: true;
  baseline: string;
  source: PageDocument;
  sourceKey: string;
  candidates: ParameterCandidate[];
  skipped: Array<{ path: string; reason: string }>;
}
