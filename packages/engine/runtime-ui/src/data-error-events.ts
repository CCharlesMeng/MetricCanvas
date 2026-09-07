import type { DataSnapshot, QueryError } from '@metriccanvas/page';

/**
 * 数据快照错误事件:统一运行时视图(及嵌入 API)向宿主上抛的
 * 结构化查询错误,携带页面数据源 id、稳定分类与脱值消息,
 * 宿主按分类决定重试、重新登录或展示失败(issue #51)。
 */
export interface DataErrorEvent {
  type: 'data-error';
  dataSourceId: string;
  code: QueryError['code'];
  message: string;
}

/**
 * 从一次快照推送中提取需要上抛的错误事件:只在进入错误态或错误
 * 内容变化时上抛一次;离开错误态后再次失败会重新上抛。
 * emitted 由调用方按页面会话持有(数据源 id → 上次上抛的错误指纹)。
 */
export function collectDataErrors(
  emitted: Map<string, string>,
  snapshots: ReadonlyMap<string, DataSnapshot>
): DataErrorEvent[] {
  const events: DataErrorEvent[] = [];
  for (const [dataSourceId, snapshot] of snapshots) {
    if (snapshot.status !== 'error') {
      emitted.delete(dataSourceId);
      continue;
    }
    const fingerprint = `${snapshot.error.code}\n${snapshot.error.message}`;
    if (emitted.get(dataSourceId) === fingerprint) continue;
    emitted.set(dataSourceId, fingerprint);
    events.push({
      type: 'data-error',
      dataSourceId,
      code: snapshot.error.code,
      message: snapshot.error.message
    });
  }
  return events;
}
