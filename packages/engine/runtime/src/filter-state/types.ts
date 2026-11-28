import type { FilterValue, FilterValues } from '@metriccanvas/data-execution/runtime';
import type { DisplayInputsSnapshot, FilterDeclaration, Page } from '@metriccanvas/page/internal';

export type FilterIntent =
  | { type: 'set'; filterId: string; value: FilterValue }
  | { type: 'clear'; filterId: string }
  | { type: 'applyDraft'; changes: ReadonlyArray<readonly [string, FilterValue | null]> }
  | { type: 'initialize' | 'restore'; values: FilterValues }
  | { type: 'reset'; baseline: 'initial' };

export interface CommitIssue {
  filterId: string;
  code: string;
  message: string;
}

export type CommitResult =
  | { ok: true; filterRevision: number; changedIds: string[] }
  | { ok: false; issues: Array<CommitIssue> };

export interface FilterCoordinator {
  commit(intent: FilterIntent): CommitResult;
}

export type CandidateStatus =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'error'
  | 'unavailable'
  | 'denied'
  | 'unconfigured';

export interface CandidateReceipt {
  status: string;
  values?: readonly string[];
}

export interface FilterStateEditingOptions {
  unrestrictedFilterClear?: boolean;
  schemaVersion?: string;
  iocRegion?: boolean;
  readOnly?: () => boolean;
  candidates?: boolean;
  displayInputs?: () => DisplayInputsSnapshot | undefined;
  finalizationDates?: () => ReadonlyMap<string, string> | undefined;
  now?: () => Date;
}

export interface FilterState {
  /** Bind page-owned predicate semantics before coordinating query consumers. */
  configurePage?(page: Page): void;
  readonly revision?: number;
  subscribe(run: (values: FilterValues) => void): () => void;
  write(filterId: string, value: FilterValue | null): void;
  /** 原子写入多个筛选值，只向订阅方推送一次完整状态。 */
  writeMany(updates: ReadonlyArray<readonly [string, FilterValue | null]>): void;
  /** 序列化为 URL 查询串(不含 '?'),筛选状态可分享 */
  toURL(declarations?: readonly FilterDeclaration[]): string;
  /** 从 URL 查询串整体还原状态;只解析声明的查询键，忽略无关参数与畸形值 */
  fromURL(search: string, declarations: readonly FilterDeclaration[]): void;
}

export interface CoordinatedFilterState extends FilterState, FilterCoordinator {
  configurePage(page: Page): void;
  /** A legality gate, independent of visibility. The owning runtime feeds candidate receipts. */
  blocked(): ReadonlySet<string>;
  refreshContext(): void;
  preparing(filterId: string, pending: boolean): void;
  preparation(): ReadonlySet<string>;
  completePreparation(values: FilterValues): void;
  confirmation(): ReadonlySet<string>;
  readonly revision: number;
  clock(): Date;
  candidate(filterId: string, status: CandidateStatus, values?: readonly string[]): void;
}

export interface FilterStoreContext {
  readonly declarations: readonly FilterDeclaration[];
  readonly byId: Map<string, FilterDeclaration>;
  readonly dimensionOptions: ReadonlyMap<string, readonly string[]>;
  readonly editing: FilterStateEditingOptions;
  readonly skipUnrestrictedClearConfirmation: boolean;
  readonly baseline: Map<string, FilterValue>;
  readonly receipts: Map<string, CandidateReceipt>;
  readonly preparation: Set<string>;
  readonly confirmation: Set<string>;
  readonly intersections: Set<string>;
  readonly subscribers: Set<(values: FilterValues) => void>;
  current: Map<string, FilterValue>;
  exclusions: Set<string>;
  revision: number;
  operationClock: Date;
}
