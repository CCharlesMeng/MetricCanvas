import type { DataSnapshot } from '@metriccanvas/page';

type EmptyWidgetHostSnapshot = Extract<DataSnapshot, { status: 'empty' | 'error' }>;

/** 查询错误保留在快照中供诊断使用，但组件表面统一按空数据状态呈现。 */
export function isWidgetHostEmptyState(
  snapshot: DataSnapshot
): snapshot is EmptyWidgetHostSnapshot {
  return snapshot.status === 'empty' || snapshot.status === 'error';
}
