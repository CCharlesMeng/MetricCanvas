import type {
  ColumnCandidate,
  ColumnCandidateProgress,
  ColumnCandidatesPage,
} from '@metriccanvas/data-execution';
import {
  candidateKey,
  preservedQueryError,
  sortColumnCandidates,
} from '@metriccanvas/data-execution/runtime';
import { queryErrorDisposition } from '@metriccanvas/page/internal';
import { createCandidatePreload, type IdleSchedule } from './candidate-preload';
export interface ColumnCandidatesSnapshot {
  status: 'idle' | 'loading' | 'ready' | 'empty' | 'unavailable' | 'error';
  candidates: ColumnCandidate[];
  search: string;
  totalCount?: number;
  error?: import('@metriccanvas/page/internal').QueryError;
}
type Entry = {
  key: string;
  open: boolean;
  generation: number;
  snapshot: ColumnCandidatesSnapshot;
  controller?: AbortController;
  pending?: Promise<void>;
  available?: readonly ColumnCandidate[];
};
function readySnapshot(
  candidates: ColumnCandidate[],
  totalCount: number,
  search: string,
): ColumnCandidatesSnapshot {
  return { status: candidates.length ? 'ready' : 'empty', candidates, totalCount, search };
}

function completePage(
  value: Entry,
  before: ColumnCandidatesSnapshot,
  page: ColumnCandidatesPage,
  append: boolean,
): ColumnCandidatesSnapshot {
  const search = before.search;
  if (page.kind === 'unavailable') return { status: 'unavailable', candidates: [], search };

  if (value.open && value.available) {
    const visible = value.snapshot.candidates;
    const displayed = new Set(visible.map((candidate) => candidateKey(candidate.value)));
    const remaining = sortColumnCandidates(
      value.available.filter((candidate) => !displayed.has(candidateKey(candidate.value))),
    );
    value.available = [...visible, ...remaining];
    return readySnapshot(visible.length ? visible : page.candidates, page.totalCount, search);
  }
  value.available = undefined;

  const candidates = append ? [...before.candidates, ...page.candidates] : page.candidates;
  if (
    append &&
    (before.totalCount !== page.totalCount ||
      new Set(candidates.map((c) => candidateKey(c.value))).size !== candidates.length)
  ) {
    throw Object.assign(new Error('候选分页范围已变化，请重试'), {
      code: 'DQE_ROW_CONTRACT_ERROR',
    });
  }
  return readySnapshot(candidates, page.totalCount, search);
}

function candidateFailure(value: Entry, cause: unknown): ColumnCandidatesSnapshot {
  const error = preservedQueryError(cause);
  const { search, candidates } = value.snapshot;
  const retain = value.available && queryErrorDisposition(error.code) === 'retry';
  value.available = undefined;
  if (error.code === 'DQE_CANCELLED') return { status: 'idle', candidates: [], search };
  return { status: 'error', candidates: retain ? candidates : [], search, error };
}

/** Candidate UI state is per consumer; business views stay in TableSession. */
export function createColumnCandidatesSession(
  read: (
    field: string,
    search: string,
    offset: number,
    signal: AbortSignal,
    preload?: boolean,
    onProgress?: ColumnCandidateProgress,
  ) => Promise<ColumnCandidatesPage>,
  contextKey: (field: string) => string,
  changed: () => void,
  options: { fields?: () => readonly string[]; schedule?: IdleSchedule; pageSize?: number } = {},
) {
  const entries = new Map<string, Entry>();
  let disposed = false;
  const pageSize = options.pageSize ?? 50;
  const preload = createCandidatePreload({
    fields: options.fields ?? (() => []),
    schedule: options.schedule,
    needed: (field) => {
      const value = entry(field);
      return value.key !== contextKey(field) || value.snapshot.status === 'idle';
    },
    load: (field) => {
      const value = entry(field);
      if (value.snapshot.status === 'loading' && value.key === contextKey(field))
        return value.pending ?? Promise.resolve();
      return start(field, false, true);
    },
    cancel: (field) => {
      const value = entry(field);
      if (!value.open) cancel(value);
    },
  });
  function cancel(value: Entry) {
    if (disposed) return;
    value.generation++;
    value.controller?.abort();
    if (value.snapshot.status === 'loading') {
      value.available = undefined;
      value.snapshot = { status: 'idle', candidates: [], search: value.snapshot.search };
      changed();
    }
  }
  function entry(field: string): Entry {
    let value = entries.get(field);
    if (!value) {
      value = {
        key: '',
        open: false,
        generation: 0,
        snapshot: { status: 'idle', candidates: [], search: '' },
      };
      entries.set(field, value);
    }
    return value;
  }
  function start(field: string, append = false, background = false): Promise<void> {
    if (disposed) return Promise.resolve();
    const value = entry(field),
      offset = append ? value.snapshot.candidates.length : 0;
    value.controller?.abort();
    const controller = new AbortController(),
      generation = ++value.generation;
    const before = value.snapshot;
    value.controller = controller;
    value.available = undefined;
    value.key = contextKey(field);
    value.snapshot = {
      status: 'loading',
      search: before.search,
      candidates: append ? before.candidates : [],
      ...(append ? { totalCount: before.totalCount } : {}),
    };
    changed();
    const active = () =>
      !disposed &&
      generation === value.generation &&
      !controller.signal.aborted &&
      value.key === contextKey(field);
    const onProgress: ColumnCandidateProgress = (available) => {
      if (!active()) return;
      value.available = available;
      const length = Math.min(pageSize, available.length);
      if (length === value.snapshot.candidates.length) return;
      value.snapshot = {
        status: 'loading',
        search: before.search,
        candidates: available.slice(0, length),
      };
      changed();
    };
    value.pending = read(field, before.search, offset, controller.signal, background, onProgress)
      .then((page) => {
        if (!active()) return;
        value.snapshot = completePage(value, before, page, append);
        changed();
      })
      .catch((cause) => {
        if (!active()) return;
        value.snapshot = candidateFailure(value, cause);
        changed();
      });
    return value.pending;
  }
  return {
    preloadVisible: preload.visible,
    retain(fields: ReadonlySet<string>) {
      for (const [field, value] of entries)
        if (!fields.has(field)) {
          value.generation++;
          value.controller?.abort();
          entries.delete(field);
        }
    },
    snapshots(): Record<string, ColumnCandidatesSnapshot> {
      return Object.fromEntries([...entries].map(([field, value]) => [field, value.snapshot]));
    },
    open(field: string) {
      const value = entry(field);
      value.open = true;
      if (value.key !== contextKey(field) || ['idle', 'error'].includes(value.snapshot.status))
        start(field);
    },
    close(field: string) {
      const value = entry(field);
      value.open = false;
      cancel(value);
      if (!value.available) return;
      value.available = sortColumnCandidates([...value.available]);
      value.snapshot = {
        ...value.snapshot,
        candidates: value.available.slice(0, value.snapshot.candidates.length),
      };
      changed();
    },
    sync() {
      for (const [field, value] of entries)
        if (value.key !== contextKey(field)) {
          if (value.open) start(field);
          else {
            value.generation++;
            value.controller?.abort();
            value.key = '';
            value.available = undefined;
            value.snapshot = { status: 'idle', candidates: [], search: value.snapshot.search };
          }
        }
      preload.sync();
    },
    search(field: string, search: string) {
      const value = entry(field);
      if (search === value.snapshot.search) return;
      value.snapshot = { ...value.snapshot, search };
      start(field);
    },
    more(field: string) {
      const value = entry(field);
      const { status, totalCount, candidates } = value.snapshot;
      if (status !== 'ready' || totalCount! <= candidates.length) return;
      if (!value.available) {
        start(field, true);
        return;
      }
      value.snapshot = {
        ...value.snapshot,
        candidates: value.available.slice(0, candidates.length + pageSize),
      };
      changed();
    },
    retry(field: string) {
      start(field);
    },
    dispose() {
      disposed = true;
      for (const value of entries.values()) {
        value.generation++;
        value.controller?.abort();
      }
      preload.dispose();
      entries.clear();
    },
  };
}
