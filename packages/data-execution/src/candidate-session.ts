import { canonicalizeJson } from '@metriccanvas/page/internal';
import { createCandidateCache } from './candidate-cache';
import { validFilterCandidates } from './filter-candidates';
import { inheritMembershipCandidates } from './membership-candidates';
import type { FilterCandidatesGateway, RuntimeDataGateway, FilterCandidatesRequest, FilterCandidatesResult } from './ports';

type Receipt = Extract<FilterCandidatesResult, {kind:'values'}>;
type Flight = {
  controller: AbortController;
  promise: Promise<FilterCandidatesResult>;
  consumers: number;
};

export function createCandidateRequestPool() {
  const receipts = createCandidateCache<Receipt>(result => result.candidates.length);
  const pending = new Map<string, Flight>();
  const active = new Set<Flight>();
  let disposed = false;

  function start(key: string, load: (signal: AbortSignal) => Promise<FilterCandidatesResult>): Flight {
    const controller = new AbortController();
    const flight: Flight = {controller, consumers:0, promise:fetch()};
    pending.set(key, flight);
    active.add(flight);
    return flight;

    async function fetch() {
      try {
        // Defer the loader until the flight has an owner, including synchronous gateway failures.
        await Promise.resolve();
        controller.signal.throwIfAborted();
        const result = await load(controller.signal);
        controller.signal.throwIfAborted();
        if (pending.get(key) === flight && cacheable(result)) receipts.set(key, structuredClone(result));
        return result;
      } finally {
        if (pending.get(key) === flight) pending.delete(key);
        active.delete(flight);
      }
    }
  }

  function read(request: FilterCandidatesRequest, scope: string, signal: AbortSignal, load: (signal: AbortSignal) => Promise<FilterCandidatesResult>) {
    signal.throwIfAborted();
    if (disposed) throw Object.assign(new Error('候选会话已结束'), {code:'DQE_CANCELLED'});
    const key = candidateRequestPrefix(request) + scope;
    const cached = receipts.get(key);
    if (cached) return Promise.resolve(structuredClone(cached));
    const flight = pending.get(key) ?? start(key, load);
    return consumeFlight(flight, signal, () => {
      if (pending.get(key) === flight) pending.delete(key);
      flight.controller.abort();
    });
  }

  return {
    read,
    invalidate(request: FilterCandidatesRequest) {
      const prefix = candidateRequestPrefix(request);
      for (const key of receipts.keys()) if (key.startsWith(prefix)) receipts.delete(key);
      for (const key of pending.keys()) if (key.startsWith(prefix)) pending.delete(key);
    },
    dispose() {
      disposed = true;
      receipts.clear();
      pending.clear();
      for (const flight of active) flight.controller.abort();
      active.clear();
    }
  };
}

function consumeFlight(flight: Flight, signal: AbortSignal, abandon: () => void): Promise<FilterCandidatesResult> {
  const combined = AbortSignal.any([signal, flight.controller.signal]);
  flight.consumers++;
  return new Promise((resolve, reject) => {
    function release() {
      combined.removeEventListener('abort', abort);
      flight.consumers--;
    }
    function abort() {
      release();
      if (!flight.consumers) abandon();
      reject(combined.reason);
    }
    combined.addEventListener('abort', abort, {once:true});
    void flight.promise.then(result => {
      if (combined.aborted) return;
      release();
      try { resolve(structuredClone(result)); }
      catch (cause) { reject(cause); }
    }, cause => {
      if (combined.aborted) return;
      release();
      reject(cause);
    });
  });
}

function candidateRequestPrefix(request: FilterCandidatesRequest): string {
  const read = request.sourceRead;
  const sourceRead = read?.kind === 'selection' ? {...read, values:[...new Set(read.values)].sort()} : read;
  return canonicalizeJson({...request, sourceRead}) + '\n';
}

function cacheable(result: FilterCandidatesResult): result is Receipt {
  if (result.kind !== 'values' || !Array.isArray(result.candidates)) return false;
  const levels = result.candidates.flatMap(item => item?.level === undefined ? [] : [item.level]);
  return validFilterCandidates(result.candidates, levels.length ? levels : undefined);
}

/** Preserve the underlying gateway's method receivers when installing a candidate reader. */
export function bindCandidateGateway(base: RuntimeDataGateway, fetch?: FilterCandidatesGateway['fetchFilterCandidates']): RuntimeDataGateway {
  return inheritMembershipCandidates({
    ...base,
    fetchData: base.fetchData.bind(base),
    ...(base.fetchColumnCandidates ? {fetchColumnCandidates:base.fetchColumnCandidates.bind(base)} : {}),
    ...(base.fetchDimensionValues ? {fetchDimensionValues:base.fetchDimensionValues.bind(base)} : {}),
    ...(base.fetchMetricDefinitions ? {fetchMetricDefinitions:base.fetchMetricDefinitions.bind(base)} : {}),
    ...(fetch ? {fetchFilterCandidates:fetch} : {})
  }, base);
}

/** Per runtime instance. Reuse receipts across UI and execution validation. */
export function createCandidateGatewaySession(base: RuntimeDataGateway) {
  const pool = createCandidateRequestPool();
  const fetch = base.fetchFilterCandidates?.bind(base);
  const gateway = bindCandidateGateway(base, fetch && (async (request, {signal}) => {
    const frozen = structuredClone(request);
    return pool.read(frozen, '', signal, shared => fetch(frozen, {signal:shared}));
  }));
  return {gateway, invalidate:pool.invalidate, dispose:pool.dispose};
}
