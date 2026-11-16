import { canonicalizeJson } from '@metriccanvas/page/internal';
import { createCandidateCache, MAX_CACHED_CANDIDATES } from './candidate-cache';
import { inheritMembershipCandidates } from './membership-candidates';
import type { RuntimeDataGateway, FilterCandidatesRequest, FilterCandidatesResult } from './ports';

type CompleteReceipt = Extract<FilterCandidatesResult, { kind: 'values' }>;

/** Per runtime instance. Reuse complete receipts across UI and execution validation, never across identities. */
export function createCandidateGatewaySession(base: RuntimeDataGateway) {
  const receipts = createCandidateCache<CompleteReceipt>(result => result.candidates.length);
  const pending = new Map<string, { count: number }>();
  let disposed = false;

  async function fetchFilterCandidates(request: FilterCandidatesRequest, options: { signal: AbortSignal }) {
    options.signal.throwIfAborted();
    if (disposed) throw Object.assign(new Error('候选会话已结束'), { code: 'DQE_CANCELLED' });
    const key = canonicalizeJson(request);
    const cached = receipts.get(key);
    if (cached) return structuredClone(cached);

    const flight = pending.get(key) ?? { count: 0 };
    flight.count++;
    pending.set(key, flight);
    try {
      const result = await base.fetchFilterCandidates!(request, options);
      options.signal.throwIfAborted();
      if (pending.get(key) === flight && result.kind === 'values') {
        if (result.candidates.length <= MAX_CACHED_CANDIDATES) receipts.set(key, structuredClone(result));
        else receipts.delete(key);
      }
      return result;
    } finally {
      flight.count--;
      if (!flight.count && pending.get(key) === flight) pending.delete(key);
    }
  }

  const gateway: RuntimeDataGateway = {
    ...base,
    fetchData: base.fetchData.bind(base),
    ...(base.fetchColumnCandidates ? { fetchColumnCandidates: base.fetchColumnCandidates.bind(base) } : {}),
    ...(base.fetchDimensionValues ? { fetchDimensionValues: base.fetchDimensionValues.bind(base) } : {}),
    ...(base.fetchFilterCandidates ? { fetchFilterCandidates } : {})
  };
  return {
    gateway: inheritMembershipCandidates(gateway, base),
    invalidate(request: FilterCandidatesRequest) {
      const key = canonicalizeJson(request);
      receipts.delete(key);
      pending.delete(key);
    },
    dispose() {
      disposed = true;
      receipts.clear();
      pending.clear();
    }
  };
}
