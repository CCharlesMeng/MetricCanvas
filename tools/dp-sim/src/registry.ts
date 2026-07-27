import { randomUUID } from 'node:crypto';

export type DpMetricStatus = 'draft' | 'published';

export interface DpMetric {
  id: string;
  code: string | null;
  name: string;
  definition: string;
  dimensions: string[];
  aggregations: string[];
  status: DpMetricStatus;
  catalog: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDpMetricInput {
  name: string;
  definition: string;
  dimensions?: readonly string[];
  aggregations?: readonly string[];
}

export interface SearchDpMetricsInput {
  query: string;
  requiredDimensions?: readonly string[];
  requiredAggregations?: readonly string[];
  statuses?: readonly DpMetricStatus[];
}

export interface DpMetricCandidate {
  metric: DpMetric;
  matchReasons: string[];
  missingDimensions: string[];
  missingAggregations: string[];
}

export interface DpMetricRegistry {
  search(input: SearchDpMetricsInput): DpMetricCandidate[];
  get(id: string): DpMetric | undefined;
  create(input: CreateDpMetricInput): DpMetric;
  publish(id: string, code: string, catalog: string): DpMetric | undefined;
}

export interface DpMetricRegistryOptions {
  seed?: readonly DpMetric[];
  now?: () => Date;
  createId?: () => string;
}

export function createDpMetricRegistry({
  seed = defaultDpMetrics(),
  now = () => new Date(),
  createId = () => randomUUID()
}: DpMetricRegistryOptions = {}): DpMetricRegistry {
  const metrics = new Map(seed.map((metric) => [metric.id, cloneMetric(metric)]));

  return {
    search({
      query,
      requiredDimensions = [],
      requiredAggregations = [],
      statuses = ['draft', 'published']
    }) {
      const needle = normalize(query);
      if (!needle) return [];
      const allowedStatuses = new Set(statuses);

      return [...metrics.values()]
        .filter((metric) => allowedStatuses.has(metric.status))
        .flatMap((metric) => {
          const reasons = matchReasons(metric, needle);
          return reasons.length === 0
            ? []
            : [
                {
                  metric: cloneMetric(metric),
                  matchReasons: reasons,
                  missingDimensions: missing(requiredDimensions, metric.dimensions),
                  missingAggregations: missing(requiredAggregations, metric.aggregations)
                }
              ];
        })
        .sort(
          (left, right) =>
            matchRank(left.matchReasons) - matchRank(right.matchReasons) ||
            statusRank(left.metric.status) - statusRank(right.metric.status) ||
            left.metric.name.localeCompare(right.metric.name)
        );
    },

    get(id) {
      const metric = metrics.get(id);
      return metric ? cloneMetric(metric) : undefined;
    },

    create(input) {
      const timestamp = now().toISOString();
      const metric: DpMetric = {
        id: createId(),
        code: null,
        name: input.name.trim(),
        definition: input.definition.trim(),
        dimensions: unique(input.dimensions ?? []),
        aggregations: unique(input.aggregations ?? []),
        status: 'draft',
        catalog: null,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      metrics.set(metric.id, metric);
      return cloneMetric(metric);
    },

    publish(id, code, catalog) {
      const metric = metrics.get(id);
      if (!metric) return undefined;
      const normalizedCode = code.trim();
      const normalizedCatalog = catalog.trim();
      const duplicate = [...metrics.values()].find(
        (candidate) =>
          candidate.id !== id &&
          candidate.status === 'published' &&
          candidate.code === normalizedCode
      );
      if (duplicate) {
        throw new DpMetricConflictError(`指标 code 已被 ${duplicate.id} 使用`);
      }
      if (
        metric.status === 'published' &&
        (metric.code !== normalizedCode || metric.catalog !== normalizedCatalog)
      ) {
        throw new DpMetricConflictError('已发布指标不能更换 code 或数据服务目录');
      }

      const published: DpMetric = {
        ...metric,
        code: normalizedCode,
        catalog: normalizedCatalog,
        status: 'published',
        updatedAt: metric.status === 'published' ? metric.updatedAt : now().toISOString()
      };
      metrics.set(id, published);
      return cloneMetric(published);
    }
  };
}

export class DpMetricConflictError extends Error {}

export function defaultDpMetrics(): DpMetric[] {
  return [
    {
      id: 'dp-metric-gmv',
      code: 'gmv',
      name: '成交总额',
      definition: '统计成交订单的含税总金额。',
      dimensions: ['region', 'channel'],
      aggregations: ['sum'],
      status: 'published',
      catalog: 'data-service',
      createdAt: '2026-07-20T00:00:00.000Z',
      updatedAt: '2026-07-20T00:00:00.000Z'
    },
    {
      id: 'dp-metric-token-revenue',
      code: null,
      name: 'Tokens 总流水',
      definition: '统计 Tokens 使用产生的总流水。',
      dimensions: ['region', 'office', 'model', 'customer'],
      aggregations: ['day', 'month', 'dod', 'mom'],
      status: 'draft',
      catalog: null,
      createdAt: '2026-07-22T00:00:00.000Z',
      updatedAt: '2026-07-22T00:00:00.000Z'
    }
  ];
}

function matchReasons(metric: DpMetric, needle: string): string[] {
  const code = normalize(metric.code ?? '');
  const name = normalize(metric.name);
  const definition = normalize(metric.definition);
  if (code === needle) return ['code_exact'];
  if (name === needle) return ['name_exact'];

  const reasons: string[] = [];
  if (name.includes(needle) || needle.includes(name)) reasons.push('name_contains');
  else if (isSubsequence(needle, name)) reasons.push('name_subsequence');
  if (code && (code.includes(needle) || needle.includes(code))) reasons.push('code_contains');
  if (definition.includes(needle)) reasons.push('definition_contains');
  return reasons;
}

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, '');
}

function missing(required: readonly string[], available: readonly string[]): string[] {
  const availableSet = new Set(available);
  return unique(required).filter((value) => !availableSet.has(value));
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function matchRank(reasons: readonly string[]): number {
  if (reasons.includes('code_exact')) return 0;
  if (reasons.includes('name_exact')) return 1;
  if (reasons.includes('name_contains')) return 2;
  if (reasons.includes('name_subsequence')) return 3;
  if (reasons.includes('code_contains')) return 4;
  return 5;
}

function statusRank(status: DpMetricStatus): number {
  return status === 'published' ? 0 : 1;
}

function cloneMetric(metric: DpMetric): DpMetric {
  return {
    ...metric,
    dimensions: [...metric.dimensions],
    aggregations: [...metric.aggregations]
  };
}

function isSubsequence(needle: string, candidate: string): boolean {
  let offset = 0;
  for (const character of candidate) {
    if (character === needle[offset]) offset += 1;
    if (offset === needle.length) return true;
  }
  return false;
}
