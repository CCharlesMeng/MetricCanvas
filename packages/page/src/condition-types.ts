import type {
  AppliedPeriodSelection,
  FilterDeclaration,
  PeriodMode,
  TimeRangeValue,
} from './filter-types';
import type { ConditionScalar } from './schema/condition';

/**
 * Pure leaf type definitions shared by `condition.ts` and `period-facts.ts`.
 */

export type ConditionValue = ConditionScalar | null | ConditionScalar[];
export type ConditionInput =
  | { status: 'pending'; filterRevision?: number }
  | { status: 'error'; filterRevision?: number }
  | { status: 'ready'; value: ConditionValue; filterRevision?: number };

export type DataPeriodFact = (
  | {
      status: 'ready';
      granularity: 'month' | 'date';
      latest: string;
      latestComplete?: string;
      missingRanges?: TimeRangeValue[];
      refreshedAt?: string;
      generatedAt?: string;
    }
  | { status: 'loading' | 'empty' | 'unavailable' | 'error' }
) & { filterRevision?: number };

export interface DisplaySnapshot {
  timeZone?: string;
  periods?: Readonly<Record<string, DataPeriodFact>>;
  permissionRevision: string;
  permissions: Readonly<Record<string, ConditionInput>>;
  values: Readonly<Record<string, ConditionInput>>;
}

/** Neutral, immutable, trusted input. Never part of Page/URL/parameter values. */
export type DisplayInputsSnapshot = DisplaySnapshot;

export interface DisplayInputsSource {
  getSnapshot(): DisplayInputsSnapshot;
  subscribe(listener: (snapshot: DisplayInputsSnapshot) => void): () => void;
}

export interface ConditionContext {
  declarations: readonly FilterDeclaration[];
  filters: ReadonlyMap<
    string,
    {
      type: string;
      level?: string;
      values?: string[];
      value?: unknown;
      query?: string;
      from?: string | number;
      to?: string | number;
      selection?: AppliedPeriodSelection;
    }
  >;
  periodModes?: ReadonlyMap<string, PeriodMode>;
  displaySnapshot?: DisplaySnapshot;
  filterRevision?: number;
  row?: Readonly<Record<string, unknown>>;
}

export type ConditionResult = {
  status: 'allow' | 'deny' | 'pending' | 'error';
  reason?: string;
};
