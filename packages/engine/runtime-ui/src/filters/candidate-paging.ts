import type { FilterCandidate, FilterCandidatesResult } from '@metriccanvas/data-execution';
import { debugWarn, preservedQueryError } from '@metriccanvas/data-execution/runtime';

export interface CandidatePageReader {
  key: string;
  filterId:string;
  sourceId:string;
  limit:number;
  read(offset:number, search:string, signal:AbortSignal):Promise<FilterCandidatesResult>;
}

export interface CandidatePages {
  candidates:FilterCandidate[];
  total?:number;
  loading:boolean;
  error:boolean;
}

const empty = (): CandidatePages => ({candidates:[], loading:false, error:false});

/** One open menu, one dependency context and at most one live window request. */
export function candidatePaging(publish:(page:CandidatePages)=>void) {
  let reader:CandidatePageReader|undefined;
  let snapshot = empty();
  let open = false, search = '';
  let inflight:AbortController|undefined;

  function update(next:CandidatePages) {
    snapshot = next;
    publish(next);
  }

  function reset() {
    inflight?.abort();
    inflight = undefined;
    update(empty());
    if (open) more();
  }

  function merge(result:FilterCandidatesResult, current:CandidatePageReader, offset:number):void {
    if (result.kind !== 'values' || result.totalCount === undefined) {
      failedWindow(current, offset, '候选回执不可用');
      return;
    }
    const previous = snapshot.candidates;
    if (snapshot.total !== undefined && snapshot.total !== result.totalCount) {
      failedWindow(current, offset, '候选总数已变化');
      return;
    }
    const loaded = new Set(previous.map(item => item.value));
    if (result.candidates.some(item => loaded.has(item.value))) {
      failedWindow(current, offset, '候选稳定值跨批重复');
      return;
    }
    update({candidates:[...previous,...result.candidates], total:result.totalCount, loading:false, error:false});
  }

  function failedWindow(current:CandidatePageReader, offset:number, reason:string) {
    debugWarn('[MetricCanvas][FILTER_CANDIDATE_WINDOW]', {filterId:current.filterId, dataSourceId:current.sourceId, offset, limit:current.limit, reason});
    update({...snapshot, loading:false, error:true});
  }

  async function load(current:CandidatePageReader, request:AbortController, offset:number) {
    try {
      const result = await current.read(offset, search, request.signal);
      if (request === inflight) merge(result, current, offset);
    } catch (cause) {
      if (request === inflight) failedWindow(current, offset, preservedQueryError(cause).code);
    } finally {
      if (inflight === request) inflight = undefined;
    }
  }

  function more() {
    const offset = snapshot.candidates.length;
    if (!reader || !open || inflight || offset >= (snapshot.total ?? Infinity)) return;
    inflight = new AbortController();
    update({...snapshot, loading:true, error:false});
    void load(reader, inflight, offset);
  }

  return {
    configure(next:CandidatePageReader|undefined) {
      const changed = reader?.key !== next?.key;
      reader = next;
      if (changed) reset();
    },
    setOpen(next:boolean) {
      if (next === open) return;
      open = next;
      search = '';
      reset();
    },
    search(term:string) {
      const next = term.trim();
      if (next === search) return;
      search = next;
      reset();
    },
    more,
    dispose() { inflight?.abort(); inflight = undefined; }
  };
}
