import {
  conditionSourceIds,
  type EffectiveQuery,
  IOC_KEY_OFFICE_DIMENSION,
  IOC_REGION_FILTER_ID,
  nativeIocBindingTargets,
  nativeIocRuntimePage,
  type Page,
  type QueryDataSource,
  queryLeaves,
  selectQuery,
} from '@metriccanvas/page/internal';
import { createCandidateRequestPool } from './candidate-session';
import type { FilterValues } from './filter-values';
import { supportsMembershipCandidates } from './membership-candidates';
import type { FilterCandidate, FilterCandidatesRequest, RuntimeDataGateway } from './ports';

type MembershipBinding = { target: 'boolean'; queryField: string; whenTrue: string[] };
function unavailable(): Error {
  return Object.assign(new Error('当前授权重点国代完整名单尚未就绪'), { code: 'DQE_CONFIG_ERROR' });
}
function validMember(candidate: FilterCandidate): boolean {
  return (
    !!candidate &&
    typeof candidate.value === 'string' &&
    candidate.value.length > 0 &&
    typeof candidate.label === 'string' &&
    candidate.parent === undefined &&
    candidate.level === undefined &&
    (candidate.disabled === undefined || typeof candidate.disabled === 'boolean')
  );
}
function memberNames(candidates: FilterCandidate[]): string[] {
  if (!Array.isArray(candidates) || candidates.length > 10000) throw unavailable();
  const seen = new Set<string>(),
    names: string[] = [];
  for (const candidate of candidates) {
    if (!validMember(candidate) || seen.has(candidate.value)) throw unavailable();
    seen.add(candidate.value);
    if (!candidate.disabled) names.push(candidate.value);
  }
  return names;
}
function executionCopy(page: Page, targets: Map<string, string[]>) {
  if (!targets.size) return { page, bindings: new Map<string, MembershipBinding[]>() };
  const dataSources = { ...page.dataSources },
    bindings = new Map<string, MembershipBinding[]>();
  for (const [sourceId, ids] of targets) {
    const source = structuredClone(dataSources[sourceId]) as QueryDataSource;
    dataSources[sourceId] = source;
    for (const leaf of queryLeaves(source.source.query))
      for (const id of ids) {
        if (!leaf.filterBindings?.[IOC_REGION_FILTER_ID] || Object.hasOwn(leaf.filterBindings, id))
          continue;
        const binding: MembershipBinding = {
          target: 'boolean',
          queryField: '代表处',
          whenTrue: [],
        };
        leaf.filterBindings[id] = binding;
        bindings.set(id, [...(bindings.get(id) ?? []), binding]);
      }
  }
  return { page: { ...page, dataSources }, bindings };
}
/** The candidate session owns one execution copy; pending bindings never escape through snapshots. */
export function createNativeIocPreparation(input: Page, gateway: RuntimeDataGateway) {
  const hasMembershipCandidates = supportsMembershipCandidates(gateway);
  input = nativeIocRuntimePage(input, hasMembershipCandidates);
  const targets = nativeIocBindingTargets(input, hasMembershipCandidates),
    copy = executionCopy(input, targets);
  const ready = new Set<string>();
  const failures = new Map<string, unknown>();
  let membershipReads = createCandidateRequestPool();
  function activeTargets(sourceId: string, values: FilterValues): string[] {
    const ids = targets.get(sourceId) ?? [],
      source = copy.page.dataSources[sourceId];
    if (source?.source.type !== 'query') return [];
    try {
      const query = selectQuery(source.source.query, values);
      return ids.filter((id) =>
        copy.bindings.get(id)?.includes(query.filterBindings?.[id] as MembershipBinding),
      );
    } catch {
      return ids;
    }
  }
  function selected(sourceId: string, values: FilterValues): string[] {
    const ids = new Set(
      [...conditionSourceIds(input, sourceId)].flatMap((id) => activeTargets(id, values)),
    );
    return [...ids].filter((id) => {
      const value = values.get(id);
      return value?.type === 'boolean' && value.value;
    });
  }
  async function fetchMembership(request: FilterCandidatesRequest, signal: AbortSignal) {
    try {
      if (!hasMembershipCandidates || !gateway.fetchFilterCandidates) throw unavailable();
      const result = await gateway.fetchFilterCandidates(request, { signal });
      signal.throwIfAborted();
      if (result.kind !== 'values') throw unavailable();
      const names = memberNames(result.candidates);
      for (const binding of copy.bindings.get(request.filterId) ?? [])
        binding.whenTrue = [...names];
      ready.add(request.filterId);
      return result;
    } catch (cause) {
      if (!signal.aborted) failures.set(request.filterId, cause);
      throw cause;
    }
  }
  async function load(id: string, signal: AbortSignal): Promise<void> {
    if (ready.has(id)) return;
    if (failures.has(id)) throw failures.get(id);
    const request = {
      filterId: id,
      dimension: IOC_KEY_OFFICE_DIMENSION,
      constraints: { dimensions: {}, times: {}, booleans: { [id]: true } },
    };
    await membershipReads.read(request, '', signal, (shared) => fetchMembership(request, shared));
  }
  async function ensureSelected(ids: string[], signal: AbortSignal): Promise<void> {
    await Promise.all(ids.map((id) => load(id, signal)));
    signal.throwIfAborted();
  }
  return {
    page: copy.page,
    active: (sourceId: string, values: FilterValues) => selected(sourceId, values).length > 0,
    waiting: (sourceId: string, values: FilterValues) =>
      selected(sourceId, values).some((id) => !ready.has(id)),
    captured: (sourceId: string, values: FilterValues, query: EffectiveQuery | undefined) =>
      selected(sourceId, values).length ? undefined : query,
    retry(sourceId: string, values: FilterValues) {
      for (const id of selected(sourceId, values)) failures.delete(id);
    },
    ensure(sourceId: string, values: FilterValues, signal: AbortSignal) {
      const ids = selected(sourceId, values);
      if (ids.length) return ensureSelected(ids, signal);
    },
    reset() {
      membershipReads.dispose();
      membershipReads = createCandidateRequestPool();
      ready.clear();
      failures.clear();
      for (const bindings of copy.bindings.values())
        for (const binding of bindings) binding.whenTrue = [];
    },
    dispose() {
      membershipReads.dispose();
    },
  };
}
