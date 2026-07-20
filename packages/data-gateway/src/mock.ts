import type { EffectiveQuery, Row } from '@metriccanvas/page';
import type { DataGateway } from '@metriccanvas/runtime';

/**
 * mock 适配器:按生效查询的形状造确定性假数据,供离线开发与演示。
 * delayMs 模拟网络延迟,让骨架屏在开发期可见。
 */
export function createMockGateway(options: { delayMs?: number } = {}): DataGateway {
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
