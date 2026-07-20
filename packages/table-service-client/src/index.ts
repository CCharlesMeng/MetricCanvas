import type { EffectiveQuery, Row } from '@metriccanvas/spec-schema';

/** 与 @metriccanvas/runtime 的 TableServicePort 结构一致,由应用壳注入 */
export interface TableServiceClient {
  fetchData(query: EffectiveQuery): Promise<Row[]>;
}

/**
 * mock 实现:按生效查询的形状造确定性假数据,供离线开发与演示。
 * 真实表服务实现(apiQuery 方言翻译/归一化/批量分批)在切片2(#3)落地。
 */
export function createMockClient(options: { delayMs?: number } = {}): TableServiceClient {
  const { delayMs = 400 } = options;
  return {
    async fetchData(query: EffectiveQuery): Promise<Row[]> {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      const row: Row = {};
      for (const metric of query.metrics) {
        row[metric] = deterministicValue(metric);
      }
      return [row];
    }
  };
}

/** 同一指标永远返回同一数值,页面刷新不跳变,便于目验与演示 */
function deterministicValue(seed: string): number {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return (Math.abs(hash) % 9_000_000) + 1_000_000;
}
