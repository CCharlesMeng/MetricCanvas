import {
  IOC_GLOBAL_REGION_VALUE,
  isIocGlobalRegionValue,
  isIocOperationMapRegionRequest,
} from '@metriccanvas/page/internal';
import { inheritMembershipCandidates } from './membership-candidates';
import type {
  FilterCandidate,
  FilterCandidatesRequest,
  FilterCandidatesResult,
  RuntimeDataGateway,
} from './ports';

/** Install once per host application; credentials and upstream access remain in the Adapter. */
export interface OperationMapRegionAdapter {
  fetchRegionCandidates(
    request: FilterCandidatesRequest,
    options: { signal: AbortSignal },
  ): Promise<FilterCandidatesResult>;
}

function canonicalRegionCandidates(candidates: FilterCandidate[]): FilterCandidate[] {
  const globals = candidates.filter((candidate) => isIocGlobalRegionValue(candidate.label));
  const canonical = (level: string | undefined, value: string) =>
    globals.some((candidate) => candidate.level === level && candidate.value === value)
      ? IOC_GLOBAL_REGION_VALUE
      : value;
  return candidates.map((candidate) => ({
    ...candidate,
    value: canonical(candidate.level, candidate.value),
    ...(candidate.parent
      ? {
          parent: {
            ...candidate.parent,
            value: canonical(candidate.parent.level, candidate.parent.value),
          },
        }
      : {}),
  }));
}

/** Standard Region routes use the host adapter; all other capabilities keep the base gateway. */
export function withOperationMapRegion(
  base: RuntimeDataGateway,
  adapter: OperationMapRegionAdapter,
): RuntimeDataGateway {
  return inheritMembershipCandidates(
    {
      ...base,
      ...(base.fetchMetricDefinitions
        ? { fetchMetricDefinitions: base.fetchMetricDefinitions.bind(base) }
        : {}),
      async fetchFilterCandidates(request, options) {
        options.signal.throwIfAborted();
        if (!isIocOperationMapRegionRequest(request.filterId, request.dimension)) {
          return base.fetchFilterCandidates?.(request, options) ?? { kind: 'unavailable' };
        }
        const result = await adapter.fetchRegionCandidates(request, options);
        options.signal.throwIfAborted();
        return result.kind === 'values'
          ? { kind: 'values', candidates: canonicalRegionCandidates(result.candidates) }
          : result;
      },
    },
    base,
  );
}
