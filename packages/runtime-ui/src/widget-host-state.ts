import type { DataSnapshot } from '@metriccanvas/page';

type ReadyDataSnapshot = Extract<DataSnapshot, { status: 'ready' }>;

/**
 * 把数据快照投影为纯渲染组件可消费的就绪快照。
 * 空态和错误态只清空数据行，原始错误仍保留在统一运行时的数据快照中供诊断。
 */
export function renderableDataSnapshot(
  snapshot: DataSnapshot
): ReadyDataSnapshot | undefined {
  if (snapshot.status === 'loading') return undefined;
  if (snapshot.status === 'ready') return snapshot;
  return {
    status: 'ready',
    rows: [],
    ...(snapshot.status === 'empty' && snapshot.totalCount !== undefined
      ? { totalCount: snapshot.totalCount }
      : {})
  };
}
