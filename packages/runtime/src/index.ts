export type { SpecProvider, TableServicePort } from './ports.js';

import type { DataSnapshot, EffectiveQuery, Widget } from '@metriccanvas/spec-schema';
import type { TableServicePort } from './ports.js';

/**
 * 查询编排器(切片1 最简版):合成生效查询 → 并发取数 → 包装数据快照分发。
 * 后续切片在此加厚:筛选状态合成(#5)、去重/缓存/分批(#6)、分页排序(#7)。
 */
export async function orchestrate(
  widgets: Widget[],
  port: TableServicePort,
  onSnapshot: (widgetId: string, snapshot: DataSnapshot) => void
): Promise<Map<string, DataSnapshot>> {
  const finals = new Map<string, DataSnapshot>();
  await Promise.all(
    widgets.map(async (widget) => {
      onSnapshot(widget.id, { status: 'loading' });
      const snapshot = await execute(toEffectiveQuery(widget), port);
      finals.set(widget.id, snapshot);
      onSnapshot(widget.id, snapshot);
    })
  );
  return finals;
}

/** 生效查询 = 结构化查询 × 订阅筛选器当前值;切片1 尚无筛选状态,conditions 恒空 */
function toEffectiveQuery(widget: Widget): EffectiveQuery {
  const { metrics, dimensions, granularity } = widget.query;
  return {
    metrics,
    ...(dimensions ? { dimensions } : {}),
    ...(granularity ? { granularity } : {}),
    conditions: []
  };
}

async function execute(query: EffectiveQuery, port: TableServicePort): Promise<DataSnapshot> {
  try {
    const rows = await port.fetchData(query);
    return rows.length === 0 ? { status: 'empty' } : { status: 'ready', rows };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return { status: 'error', error: { message } };
  }
}
