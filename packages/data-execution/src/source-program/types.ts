import type {
  DataSnapshot,
  DisplayInputsSnapshot,
  EffectiveQuery,
  EmbeddedInitialRows,
  Page,
  TableComponent,
  TableQueryView,
  TabSelections,
} from '@metriccanvas/page/internal';
import type { createCandidateValidator } from '../candidate-validation';
import type { FilterValue, FilterValues } from '../filter-values';
import type { createUnionReader } from '../paged-union/execute';
import type { QueryDiagnosticContext, RuntimeDataGateway } from '../ports';
import type { createQueryRunner } from '../query-runner';
import type { ScreenProgress } from '../screen-progress';
import type { SourceCandidateSession } from '../source-candidates';
import type { compileSources } from './compiler';
import type { createTableSlotSearchReader } from './slot-search';

export interface SourceRead {
  /** Frozen consumer scope; a shared program may serve a single-table export. */
  presentation?: Pick<Page, 'sections' | 'detailViews'>;
  selections?: TabSelections;
  onProgress?: (sourceId: string, progress: ScreenProgress) => void;
  /** Speculative reads share caches but yield execution priority to interactive reads. */
  background?: boolean;
  strictComplete?: boolean;
  completeReadTimeoutMs?: number;
  completeReadMaxRows?: number;
  ordinaryQueryBatchSize?: number;
  displayInputs?: DisplayInputsSnapshot;
  filterRevision?: number;
  now?: Date;
  roots: readonly string[];
  conditions: FilterValues;
  views?: ReadonlyMap<string, TableQueryView>;
  purpose?: 'screen' | 'complete';
  freshness?: 'reuse' | 'refresh';
  signal?: AbortSignal;
  /** Adapters may seed existing ordinary raw receipts; they never seed member roles. */
  seeds?: ReadonlyMap<string, DataSnapshot>;
  useInitial?: boolean;
  queries?: ReadonlyMap<string, EffectiveQuery>;
  completeSources?: readonly string[];
  currentYear?: number;
  /** Complete report reads retain successful sources/pages when a query fails. */
  allowPartial?: boolean;
}

export interface SourceUpdate {
  sourceId: string;
  snapshot: DataSnapshot;
  raw: DataSnapshot;
  initial?:
    | EmbeddedInitialRows
    | (EmbeddedInitialRows & { view: TableQueryView; totalCount: number });
  viewCorrection?: TableQueryView;
  query?: EffectiveQuery;
  /** Candidate/selection validation failed before any business query or initial reuse. */
  candidateRejected?: true;
}

export interface SourceProgramConfig {
  gateway: RuntimeDataGateway;
  diagnostics?: QueryDiagnosticContext;
  displayInputs?: () => DisplayInputsSnapshot | undefined;
  filterRevision?: () => number;
  now?: Date;
  clock?: () => Date;
  candidateSession?: SourceCandidateSession;
}

export interface CoreSourceProgramConfig extends Omit<SourceProgramConfig, 'candidateSession'> {
  candidateSession: SourceCandidateSession;
  ownsCandidateSession?: boolean;
}

export interface ProgramState {
  page: Page;
  config: CoreSourceProgramConfig;
  candidateSession: SourceCandidateSession;
  native: SourceCandidateSession['native'];
  compiled: ReturnType<typeof compileSources>;
  runner: ReturnType<typeof createQueryRunner>;
  union: ReturnType<typeof createUnionReader>;
  slotSearch: ReturnType<typeof createTableSlotSearchReader>;
  candidates: ReturnType<typeof createCandidateValidator>;
  cascaded: Set<string>;
  defaultPeriodSources: Set<string>;
  headerTables: TableComponent[];
  unsafeInitials: Set<string>;
  defaults: Map<string, FilterValue>;
  batch: number;
  contextScope: string;
  defaultConditions(id: string, values: FilterValues, reuse?: boolean): boolean;
  overridesSource(id: string, values: FilterValues): boolean;
  sourceReadScope(
    freshness: SourceRead['freshness'],
    inputs: DisplayInputsSnapshot | undefined,
  ): string;
}
