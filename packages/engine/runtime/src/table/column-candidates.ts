import type { ColumnCandidate, ColumnCandidatesPage } from '@metriccanvas/data-execution';
import { candidateKey } from '@metriccanvas/data-execution/runtime';
import { preservedQueryError } from '../query-error';
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
};
/** Candidate UI state is per consumer; business views stay in TableSession. */
export function createColumnCandidatesSession(read: (field: string, search: string, offset: number, signal: AbortSignal, preload?: boolean) => Promise<ColumnCandidatesPage>, contextKey: (field: string) => string, changed: () => void,
    preloadOptions: { fields?: () => readonly string[]; schedule?: IdleSchedule } = {}) {
    const entries = new Map<string, Entry>();
    let disposed = false;
    const preload = createCandidatePreload({
        fields: preloadOptions.fields ?? (() => []), schedule: preloadOptions.schedule,
        needed: field => { const value = entry(field); return value.key !== contextKey(field) || value.snapshot.status === 'idle'; },
        load: field => {
            const value = entry(field);
            if (value.snapshot.status === 'loading' && value.key === contextKey(field)) return value.pending ?? Promise.resolve();
            return start(field, false, true);
        },
        cancel: field => { const value = entry(field); if (!value.open) cancel(value); }
    });
    function cancel(value: Entry) {
        if (disposed) return;
        value.generation++; value.controller?.abort();
        if (value.snapshot.status === 'loading') {
            value.snapshot = { status: 'idle', candidates: [], search: value.snapshot.search };
            changed();
        }
    }
    function entry(field: string): Entry {
        let value = entries.get(field);
        if (!value) {
            value = { key: '', open: false, generation: 0, snapshot: { status: 'idle', candidates: [], search: '' } };
            entries.set(field, value);
        }
        return value;
    }
    function start(field: string, append = false, background = false): Promise<void> {
        if (disposed)
            return Promise.resolve();
        const value = entry(field), offset = append ? value.snapshot.candidates.length : 0;
        value.controller?.abort();
        const controller = new AbortController(), generation = ++value.generation;
        const before = value.snapshot;
        value.controller = controller;
        value.key = contextKey(field);
        value.snapshot = { status: 'loading', search: before.search, candidates: append ? before.candidates : [], ...(append ? { totalCount: before.totalCount } : {}) };
        changed();
        value.pending = read(field, before.search, offset, controller.signal, background).then(page => {
            if (disposed || generation !== value.generation || controller.signal.aborted)
                return;
            if (page.kind === 'unavailable')
                value.snapshot = { status: 'unavailable', candidates: [], search: before.search };
            else {
                const candidates = append ? [...before.candidates, ...page.candidates] : page.candidates;
                if (append && (before.totalCount !== page.totalCount || new Set(candidates.map(c => candidateKey(c.value))).size !== candidates.length)) {
                    throw Object.assign(new Error('候选分页范围已变化，请重试'), { code: 'DQE_ROW_CONTRACT_ERROR' });
                }
                value.snapshot = { status: candidates.length ? 'ready' : 'empty', candidates, totalCount: page.totalCount, search: before.search };
            }
            changed();
        }).catch(cause => {
            if (disposed || generation !== value.generation || controller.signal.aborted)
                return;
            const error = preservedQueryError(cause);
            value.snapshot = error.code === 'DQE_CANCELLED'
                ? { status: 'idle', candidates: [], search: before.search }
                : { status: 'error', candidates: [], search: before.search, error };
            changed();
        });
        return value.pending;
    }
    return {
        preloadVisible: preload.visible,
        retain(fields: ReadonlySet<string>) { for (const [field, value] of entries)
            if (!fields.has(field)) {
                value.generation++;
                value.controller?.abort();
                entries.delete(field);
            } },
        snapshots(): Record<string, ColumnCandidatesSnapshot> { return Object.fromEntries([...entries].map(([field, value]) => [field, value.snapshot])); },
        open(field: string) { const value = entry(field); value.open = true; if (value.key !== contextKey(field) || ['idle', 'error'].includes(value.snapshot.status))
            start(field); },
        close(field: string) { const value = entry(field); value.open = false; cancel(value); },
        sync() { for (const [field, value] of entries)
            if (value.key !== contextKey(field)) {
                if (value.open)
                    start(field);
                else {
                    value.generation++;
                    value.controller?.abort();
                    value.key = '';
                    value.snapshot = { status: 'idle', candidates: [], search: value.snapshot.search };
                }
            } preload.sync(); },
        search(field: string, search: string) { const value = entry(field); if (search === value.snapshot.search)
            return; value.snapshot = { ...value.snapshot, search }; start(field); },
        more(field: string) { const value = entry(field); if (value.snapshot.status === 'ready' && value.snapshot.totalCount! > value.snapshot.candidates.length)
            start(field, true); },
        retry(field: string) { start(field); },
        dispose() { disposed = true; for (const value of entries.values()) {
            value.generation++;
            value.controller?.abort();
        } preload.dispose(); entries.clear(); }
    };
}
