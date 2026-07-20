import type {
  CatalogSnapshot,
  CatalogDimension,
  CatalogMetric,
  EffectiveQuery,
  FilterCondition,
  Row
} from '@metriccanvas/page';
import type { DataGateway } from '@metriccanvas/runtime';

export interface MockGatewayOptions {
  /** 模拟网络延迟,让骨架屏在开发期可见 */
  delayMs?: number;
  /** 元数据快照:提供时按指标类型与维度基数造形状正确的假数据 */
  catalog?: CatalogSnapshot;
}

/**
 * mock 适配器:按生效查询的形状造确定性假数据,供离线开发与演示。
 * 提供元数据快照时,维度行按基数/样例值展开(多维度取笛卡尔积),
 * 指标值按 valueType 成形;不提供时保持切片1 的单行行为。
 * 感知筛选(切片4):维度 in 条件收窄该维度的行集,其余条件与时间范围
 * 参与数值扰动——模拟真实数据"过滤切行、条件改数"的形态,联动可目验。
 */
export function createMockGateway(options: MockGatewayOptions = {}): DataGateway {
  const { delayMs = 400, catalog } = options;
  const wait = () => new Promise((resolve) => setTimeout(resolve, delayMs));

  return {
    async fetchData(query: EffectiveQuery): Promise<Row[]> {
      await wait();
      const dimensions = query.dimensions ?? [];
      const combos = dimensionCombos(dimensions, query.conditions, catalog);
      const context = contextKey(query, dimensions);
      return combos.map((combo) => {
        const row: Row = { ...combo };
        for (const metric of query.metrics) {
          const seed = metric + JSON.stringify(combo) + context;
          row[metric] = metricValue(seed, findMetric(metric, catalog));
        }
        return row;
      });
    },

    async fetchDimensionValues(dimension: string): Promise<string[]> {
      await wait();
      return dimensionValues(dimension, catalog?.dimensions.find((d) => d.code === dimension));
    }
  };
}

/**
 * 维度值组合:无维度时单行(空组合);多维度取笛卡尔积;
 * 维度自身的 in 条件收窄该维度参与组合的值集(过滤切行)。
 */
function dimensionCombos(
  dimensions: string[],
  conditions: FilterCondition[],
  catalog?: CatalogSnapshot
): Array<Record<string, string>> {
  let combos: Array<Record<string, string>> = [{}];
  for (const code of dimensions) {
    let values = dimensionValues(code, catalog?.dimensions.find((d) => d.code === code));
    const own = conditions.find(
      (condition) => condition.dimension === code && condition.operator === 'in'
    );
    if (own && Array.isArray(own.value)) {
      const selected = new Set(own.value.map(String));
      values = values.filter((value) => selected.has(value));
    }
    combos = combos.flatMap((combo) => values.map((value) => ({ ...combo, [code]: value })));
  }
  return combos;
}

/**
 * 数值扰动上下文:时间范围 + 落在查询维度之外的条件(维度内条件已经切行,不再改数)。
 * 无筛选时返回空串,保持与切片3 相同的种子(既有假数不跳变)。
 */
function contextKey(query: EffectiveQuery, dimensions: string[]): string {
  const external = query.conditions.filter(
    (condition) => !dimensions.includes(condition.dimension)
  );
  if (external.length === 0 && !query.timeRange) return '';
  return JSON.stringify({ conditions: external, timeRange: query.timeRange ?? null });
}

/** 维度枚举值:优先快照样例值,不足基数时按 code 补造;快照缺失该维度时造 3 个 */
function dimensionValues(code: string, dimension?: CatalogDimension): string[] {
  const cardinality = dimension?.cardinality ?? 3;
  const samples = dimension?.sampleValues ?? [];
  const values = samples.slice(0, cardinality);
  for (let i = values.length; i < cardinality; i++) {
    values.push(`${code}-${i + 1}`);
  }
  return values;
}

function findMetric(code: string, catalog?: CatalogSnapshot): CatalogMetric | undefined {
  return catalog?.metrics.find((m) => m.code === code);
}

/** 指标值按快照 valueType 成形;无快照信息时保持切片1 的整数行为 */
function metricValue(seed: string, metric?: CatalogMetric): number {
  const base = deterministicValue(seed);
  switch (metric?.valueType) {
    case 'percent':
      return Math.round((base % 10_000) / 100 * 100) / 100;
    case 'decimal':
      return Math.round(base * 1.37) / 100 + 100;
    case 'integer':
    default:
      return base;
  }
}

/** 同一种子永远返回同一数值,页面刷新不跳变,便于目验与演示 */
function deterministicValue(seed: string): number {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return (Math.abs(hash) % 9_000_000) + 1_000_000;
}
