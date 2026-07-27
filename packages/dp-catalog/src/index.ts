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

export interface SearchDpMetricCandidates {
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

export interface DpMetricCandidates {
  candidates: DpMetricCandidate[];
}

export interface DpCatalog {
  searchCandidates(input: SearchDpMetricCandidates): Promise<DpMetricCandidates>;
  getMetric(id: string): Promise<DpMetric | null>;
}

export type DpCatalogErrorCode =
  | 'DP_UNAVAILABLE'
  | 'DP_INVALID_RESPONSE'
  | 'DP_QUERY_FAILED';

export class DpCatalogError extends Error {
  constructor(
    public readonly code: DpCatalogErrorCode,
    message: string
  ) {
    super(message);
  }
}

export interface HttpDpCatalogOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}

export function createHttpDpCatalog(options: HttpDpCatalogOptions): DpCatalog {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const baseUrl = options.baseUrl.replace(/\/+$/u, '');

  return {
    async searchCandidates(input) {
      const response = await request(fetchImpl, `${baseUrl}/v1/metric-candidates/search`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input)
      });
      if (!isRecord(response) || !Array.isArray(response.candidates)) {
        throw new DpCatalogError(
          'DP_INVALID_RESPONSE',
          'DP 候选查询响应缺少 candidates 数组'
        );
      }
      return {
        candidates: response.candidates.map(parseCandidate)
      };
    },

    async getMetric(id) {
      let response: Response;
      try {
        response = await fetchImpl(
          `${baseUrl}/v1/metrics/${encodeURIComponent(id)}`
        );
      } catch (cause) {
        throw new DpCatalogError(
          'DP_UNAVAILABLE',
          `DP 查询不可用:${cause instanceof Error ? cause.message : String(cause)}`
        );
      }
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new DpCatalogError(
          'DP_QUERY_FAILED',
          `DP 查询失败:HTTP ${response.status}`
        );
      }
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new DpCatalogError('DP_INVALID_RESPONSE', 'DP 响应不是合法 JSON');
      }
      if (!isRecord(payload)) {
        throw new DpCatalogError('DP_INVALID_RESPONSE', 'DP 指标查询响应不合法');
      }
      return parseMetric(payload.metric);
    }
  };
}

export function createMemoryDpCatalog(seed: readonly DpMetric[]): DpCatalog {
  const metrics = seed.map(cloneMetric);

  return {
    async searchCandidates({
      query,
      requiredDimensions = [],
      requiredAggregations = [],
      statuses = ['draft', 'published']
    }) {
      const needle = normalize(query);
      const allowedStatuses = new Set(statuses);
      if (!needle) return { candidates: [] };

      return {
        candidates: metrics.flatMap((metric) => {
          if (!allowedStatuses.has(metric.status)) return [];
          const matchReasons = reasonsFor(metric, needle);
          if (matchReasons.length === 0) return [];
          return [
            {
              metric: cloneMetric(metric),
              matchReasons,
              missingDimensions: missing(requiredDimensions, metric.dimensions),
              missingAggregations: missing(requiredAggregations, metric.aggregations)
            }
          ];
        })
      };
    },

    async getMetric(id) {
      const metric = metrics.find((candidate) => candidate.id === id);
      return metric ? cloneMetric(metric) : null;
    }
  };
}

async function request(
  fetchImpl: typeof globalThis.fetch,
  url: string,
  init?: RequestInit
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch (cause) {
    throw new DpCatalogError(
      'DP_UNAVAILABLE',
      `DP 查询不可用:${cause instanceof Error ? cause.message : String(cause)}`
    );
  }
  if (!response.ok) {
    throw new DpCatalogError(
      'DP_QUERY_FAILED',
      `DP 查询失败:HTTP ${response.status}`
    );
  }
  try {
    return await response.json();
  } catch {
    throw new DpCatalogError('DP_INVALID_RESPONSE', 'DP 响应不是合法 JSON');
  }
}

function parseCandidate(value: unknown): DpMetricCandidate {
  if (
    !isRecord(value) ||
    !Array.isArray(value.matchReasons) ||
    !Array.isArray(value.missingDimensions) ||
    !Array.isArray(value.missingAggregations)
  ) {
    throw new DpCatalogError('DP_INVALID_RESPONSE', 'DP 候选结构不合法');
  }
  return {
    metric: parseMetric(value.metric),
    matchReasons: parseStringArray(value.matchReasons, 'matchReasons'),
    missingDimensions: parseStringArray(value.missingDimensions, 'missingDimensions'),
    missingAggregations: parseStringArray(
      value.missingAggregations,
      'missingAggregations'
    )
  };
}

function parseMetric(value: unknown): DpMetric {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    (value.code !== null && typeof value.code !== 'string') ||
    typeof value.name !== 'string' ||
    typeof value.definition !== 'string' ||
    !Array.isArray(value.dimensions) ||
    !Array.isArray(value.aggregations) ||
    (value.status !== 'draft' && value.status !== 'published') ||
    (value.catalog !== null && typeof value.catalog !== 'string') ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    throw new DpCatalogError('DP_INVALID_RESPONSE', 'DP 指标结构不合法');
  }
  return {
    id: value.id,
    code: value.code,
    name: value.name,
    definition: value.definition,
    dimensions: parseStringArray(value.dimensions, 'dimensions'),
    aggregations: parseStringArray(value.aggregations, 'aggregations'),
    status: value.status,
    catalog: value.catalog,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  };
}

function parseStringArray(value: unknown[], field: string): string[] {
  if (value.some((candidate) => typeof candidate !== 'string')) {
    throw new DpCatalogError('DP_INVALID_RESPONSE', `DP 字段 ${field} 不是字符串数组`);
  }
  return value as string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function reasonsFor(metric: DpMetric, needle: string): string[] {
  const code = normalize(metric.code ?? '');
  const name = normalize(metric.name);
  const definition = normalize(metric.definition);
  if (code === needle) return ['code_exact'];
  if (name === needle) return ['name_exact'];

  const reasons: string[] = [];
  if (name.includes(needle) || needle.includes(name)) reasons.push('name_contains');
  if (code && (code.includes(needle) || needle.includes(code))) {
    reasons.push('code_contains');
  }
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

function cloneMetric(metric: DpMetric): DpMetric {
  return {
    ...metric,
    dimensions: [...metric.dimensions],
    aggregations: [...metric.aggregations]
  };
}
