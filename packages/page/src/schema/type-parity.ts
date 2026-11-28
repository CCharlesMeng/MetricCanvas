import type { z } from 'zod';
import type {
  DataSource,
  EmbeddedInitialRows,
  InlineDataSource,
  InlineSource,
  QueryDataSource,
  QuerySource,
} from '../data-source';
import type {
  BooleanFilterDeclaration,
  DimensionFilterDeclaration,
  FilterDeclaration,
  NumberRangeFilterDeclaration,
  NumberRangeValue,
  PeriodSelection,
  RelativeTimeExpression,
  SearchFilterDeclaration,
  TimePointFilterDeclaration,
  TimeRangeFilterDeclaration,
  TimeRangeValue,
} from '../filter-types';
import type { GroupedQueryFields } from '../page-document';
import type { DqeFilterBinding, DqeQueryCase, DqeRequestBody, JsonObject } from '../query';
import type {
  dataSourceDocumentZ,
  dqeQueryZ,
  embeddedInitialRowsZ,
  inlineDataSourceZ,
  inlineSourceZ,
  queryDataSourceDocumentZ,
  querySourceZ,
} from './data-source';
import type { filterDeclarationZ } from './filter';

/**
 * Compile-time bidirectional equivalence assertions between hand-written domain types
 * (`filter.ts`, `data-source.ts`) and their Zod schemas (`schema/filter.ts`,
 * `schema/data-source.ts`).
 *
 * Checked by `tsc --noEmit` during `pnpm --filter @metriccanvas/page check`.
 * Zero runtime code is emitted; any field drift in either direction breaks typecheck.
 */

type AssertTrue<T extends true> = T;

type AssertMutualAssignable<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : ['B is not assignable to A', Exclude<keyof B, keyof A>]
  : ['A is not assignable to B', Exclude<keyof A, keyof B>];

type AssertKeyParity<A, B> = [Exclude<keyof A, keyof B> | Exclude<keyof B, keyof A>] extends [never]
  ? true
  : ['Key mismatch', { extraInA: Exclude<keyof A, keyof B>; extraInB: Exclude<keyof B, keyof A> }];

type ExactBidirectional<Domain, Schema> =
  AssertKeyParity<Domain, Schema> extends true
    ? AssertMutualAssignable<Domain, Schema>
    : AssertKeyParity<Domain, Schema>;

// ---------------------------------------------------------------------------
// 1. Filter declarations (`filter.ts` <-> `schema/filter.ts`)
// ---------------------------------------------------------------------------

type FilterDeclarationSchema = z.infer<typeof filterDeclarationZ>;
type DimensionFilterSchema = Extract<FilterDeclarationSchema, { type: 'dimension' }>;
type TimeRangeFilterSchema = Extract<FilterDeclarationSchema, { type: 'timeRange' }>;
type TimePointFilterSchema = Extract<FilterDeclarationSchema, { type: 'timePoint' }>;
type BooleanFilterSchema = Extract<FilterDeclarationSchema, { type: 'boolean' }>;
type NumberRangeFilterSchema = Extract<FilterDeclarationSchema, { type: 'numberRange' }>;
type SearchFilterSchema = Extract<FilterDeclarationSchema, { type: 'search' }>;

type SchemaRelativeTimeExpression = NonNullable<TimeRangeFilterSchema['presets']>[number]['range'];
type SchemaNumberRangeValue = NonNullable<NumberRangeFilterSchema['default']>;

/**
 * Documented domain-vs-schema boundaries in `filter.ts`:
 * 1. `FilterInteractionExtension.hint?: TextValue` — `textValueZ` intentionally pins
 *    `z.infer<typeof textValueZ>` to `string` (post-materialization), while `FilterDeclaration`
 *    is shared with `PageDocument` and retains `TextValue`.
 * 2. `TimeRangeValue.mode?: TimeMode` — runtime-only field for `display: 'modes'`;
 *    persisted JSON Schema (`timeRangeValueZ`) only allows `{ from: string; to: string }`.
 * 3. `PeriodSelection` — domain includes runtime `anchor?: string` on `last12Months`, and
 *    splits `mode` across two branches; schema `periodSelectionZ` groups the
 *    `finalizationName`-bearing branch under all four period modes.
 */
type WithMaterializedHint<T extends { hint?: unknown }> = Omit<T, 'hint'> & { hint?: string };
type DocumentTimeRangeValue = Omit<TimeRangeValue, 'mode'>;
type DocumentPeriodSelection =
  | { mode: 'year' | 'quarter' | 'month'; value?: string }
  | { mode: 'last12Months' }
  | {
      mode: 'year' | 'quarter' | 'month' | 'last12Months';
      finalizationName: string | string[];
    };

type DimensionFilterDomainNormalized = WithMaterializedHint<DimensionFilterDeclaration>;

type TimeRangeFilterDomainNormalized = WithMaterializedHint<
  Omit<TimeRangeFilterDeclaration, 'blockedRanges' | 'modes' | 'default'>
> & {
  blockedRanges?: DocumentTimeRangeValue[];
  modes?: Array<{
    id: NonNullable<TimeRangeFilterDeclaration['modes']>[number]['id'];
    default: DocumentTimeRangeValue | RelativeTimeExpression;
  }>;
  default?:
    | Exclude<TimeRangeFilterDeclaration['default'], TimeRangeValue | PeriodSelection | undefined>
    | DocumentTimeRangeValue
    | DocumentPeriodSelection;
};

type TimePointFilterDomainNormalized = WithMaterializedHint<
  Omit<TimePointFilterDeclaration, 'blockedRanges'>
> & {
  blockedRanges?: DocumentTimeRangeValue[];
};

type BooleanFilterDomainNormalized = WithMaterializedHint<BooleanFilterDeclaration>;
type NumberRangeFilterDomainNormalized = WithMaterializedHint<NumberRangeFilterDeclaration>;
type SearchFilterDomainNormalized = WithMaterializedHint<SearchFilterDeclaration>;

type FilterDeclarationDomainNormalized =
  | DimensionFilterDomainNormalized
  | TimeRangeFilterDomainNormalized
  | TimePointFilterDomainNormalized
  | BooleanFilterDomainNormalized
  | NumberRangeFilterDomainNormalized
  | SearchFilterDomainNormalized;

export type _FilterRelativeTimeParity = AssertTrue<
  ExactBidirectional<RelativeTimeExpression, SchemaRelativeTimeExpression>
>;
export type _FilterNumberRangeValueParity = AssertTrue<
  ExactBidirectional<NumberRangeValue, SchemaNumberRangeValue>
>;
export type _FilterDimensionParity = AssertTrue<
  ExactBidirectional<DimensionFilterDomainNormalized, DimensionFilterSchema>
>;
export type _FilterTimeRangeParity = AssertTrue<
  ExactBidirectional<TimeRangeFilterDomainNormalized, TimeRangeFilterSchema>
>;
export type _FilterTimePointParity = AssertTrue<
  ExactBidirectional<TimePointFilterDomainNormalized, TimePointFilterSchema>
>;
export type _FilterBooleanParity = AssertTrue<
  ExactBidirectional<BooleanFilterDomainNormalized, BooleanFilterSchema>
>;
export type _FilterNumberRangeParity = AssertTrue<
  ExactBidirectional<NumberRangeFilterDomainNormalized, NumberRangeFilterSchema>
>;
export type _FilterSearchParity = AssertTrue<
  ExactBidirectional<SearchFilterDomainNormalized, SearchFilterSchema>
>;
export type _FilterUnionParity = AssertTrue<
  AssertMutualAssignable<FilterDeclarationDomainNormalized, FilterDeclarationSchema>
>;
// Verify every non-TimeRange schema branch is directly assignable to FilterDeclaration
export type _FilterNonTimeRangeSchemaAssignableToDomain = AssertTrue<
  Exclude<FilterDeclarationSchema, TimeRangeFilterSchema> extends FilterDeclaration ? true : false
>;

// ---------------------------------------------------------------------------
// 2. Data sources (`data-source.ts` <-> `schema/data-source.ts`)
// ---------------------------------------------------------------------------

type InlineSourceSchema = z.infer<typeof inlineSourceZ>;
type InlineDataSourceSchema = z.infer<typeof inlineDataSourceZ>;
type EmbeddedInitialRowsSchema = z.infer<typeof embeddedInitialRowsZ>;
type DqeQuerySchema = z.infer<typeof dqeQueryZ>;
type QuerySourceSchema = z.infer<typeof querySourceZ>;
type QueryDataSourceDocumentSchema = z.infer<typeof queryDataSourceDocumentZ>;
type DataSourceDocumentSchema = z.infer<typeof dataSourceDocumentZ>;

/**
 * Documented document-vs-domain boundaries between `schema/data-source.ts` and `data-source.ts`:
 * 1. `EmbeddedInitialRows` carries runtime-only `cellFallbacks` & `warnings`, and its
 *    `rows` are normalized `DataRow[]` (document schema accepts raw `Record<string, unknown>[]`
 *    so malformed numeric/scalar cells reach the fault-tolerant normalization seam).
 * 2. `DqeRequestBody.dsl_list` is typed as tuple `[JsonObject]` in domain (length-1 array of
 *    `Record<string, unknown>` in Zod because Zod `.length(1)` infers an array, not a 1-tuple).
 * 3. `DqeQueryDefinition.timeModes.cases` narrows keys to `Partial<Record<TimeMode, ...>>` in
 *    domain (validated semantically beyond Zod's `Record<string, ...>`), and schema forbids
 *    `periodPolicy` inside `timeModes` cases.
 * 4. `queryDataSourceDocumentZ.fields` allows document-only `GroupedQueryFields` (flattened by
 *    `materializePageDocument` into flat `Record<string, QueryDataSourceFieldDefinition>`).
 */
type EmbeddedInitialRowsDomainNormalized = Omit<
  EmbeddedInitialRows,
  'rows' | 'cellFallbacks' | 'warnings'
> & {
  rows: Record<string, unknown>[];
};

type SchemaDqeRequestBody = NonNullable<DqeQuerySchema['body']>;
type TimeModeBindingNormalized =
  | Exclude<DqeFilterBinding, { target: 'time' }>
  | Omit<Extract<DqeFilterBinding, { target: 'time' }>, 'periodPolicy'>;

type TimeModeQueryCaseDomainNormalized = Omit<DqeQueryCase, 'body' | 'filterBindings'> & {
  body: SchemaDqeRequestBody;
  filterBindings: Record<string, TimeModeBindingNormalized>;
};

type QueryModeCaseDomainNormalized = Omit<DqeQueryCase, 'body'> & {
  body: SchemaDqeRequestBody;
  fieldMappings?: Record<string, string>;
};

type DqeQueryDomainNormalized = Omit<QuerySource['query'], 'body' | 'timeModes' | 'queryModes'> & {
  body?: SchemaDqeRequestBody;
  timeModes?: {
    filterId: string;
    cases: Record<string, TimeModeQueryCaseDomainNormalized>;
  };
  queryModes?: {
    filterId: string;
    cases: Record<string, QueryModeCaseDomainNormalized>;
  };
};

type QuerySourceDomainNormalized = Omit<QuerySource, 'initial' | 'query'> & {
  initial?: EmbeddedInitialRowsDomainNormalized;
  query: DqeQueryDomainNormalized;
};

type QueryDataSourceDomainNormalized = Omit<QueryDataSource, 'fields' | 'source'> & {
  fields: QueryDataSource['fields'] | GroupedQueryFields;
  source: QuerySourceDomainNormalized;
};

type DataSourceDomainNormalized =
  | Exclude<DataSource, QueryDataSource>
  | QueryDataSourceDomainNormalized;

// Verify DqeRequestBody tuple shape is strictly a subtype of schema's dsl_list array
export type _DqeRequestBodyDomainToSchema = AssertTrue<
  DqeRequestBody extends { dsl_list: JsonObject[] } ? true : false
>;
export type _InlineSourceParity = AssertTrue<ExactBidirectional<InlineSource, InlineSourceSchema>>;
export type _InlineDataSourceParity = AssertTrue<
  ExactBidirectional<InlineDataSource, InlineDataSourceSchema>
>;
export type _EmbeddedInitialRowsParity = AssertTrue<
  ExactBidirectional<EmbeddedInitialRowsDomainNormalized, EmbeddedInitialRowsSchema>
>;
export type _QuerySourceParity = AssertTrue<
  ExactBidirectional<QuerySourceDomainNormalized, QuerySourceSchema>
>;
export type _QueryDataSourceParity = AssertTrue<
  ExactBidirectional<QueryDataSourceDomainNormalized, QueryDataSourceDocumentSchema>
>;
export type _DataSourceUnionParity = AssertTrue<
  AssertMutualAssignable<DataSourceDomainNormalized, DataSourceDocumentSchema>
>;
