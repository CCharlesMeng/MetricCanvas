import type { DataSnapshot } from '@metriccanvas/page';

type ReadyDataSnapshot = Extract<DataSnapshot, { status: 'ready' }>;

/**
 * 把数据快照投影为纯渲染组件可消费的就绪快照。
 * 空态投影为空行；加载态和错误态由 WidgetHost 统一呈现。
 */
export function renderableDataSnapshot(
  snapshot: DataSnapshot
): ReadyDataSnapshot | undefined {
  if (snapshot.status === 'loading' || snapshot.status === 'error') return undefined;
  if (snapshot.status === 'ready') return snapshot;
  return {
    status: 'ready',
    rows: [],
    ...(snapshot.totalCount !== undefined
      ? { totalCount: snapshot.totalCount }
      : {})
  };
}
