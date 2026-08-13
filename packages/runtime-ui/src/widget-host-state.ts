import {
  queryErrorDisposition,
  type DataSnapshot,
  type QueryError,
  type QueryErrorDisposition
} from '@metriccanvas/page';

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

export interface QueryErrorView {
  /** 按处理语义(重试/重登/失败)选择的可读标题。 */
  headline: string;
  /** 稳定错误分类,原样透出供定位与断言,消费方不解析错误字符串。 */
  code: QueryError['code'];
  /** 脱值消息:只含结构化事实,不含业务值(issue #47)。 */
  message: string;
}

const QUERY_ERROR_HEADLINES: Record<QueryErrorDisposition, string> = {
  retry: '查询暂时不可用，请稍后重试',
  reauth: '登录状态已失效，请重新登录后重试',
  fail: '查询失败'
};

/**
 * 错误态统一呈现的唯一投影(issue #51):标题由错误分类经处理语义
 * 决定,不按错误字符串分支;分类与脱值消息原样透出。
 */
export function queryErrorView(error: QueryError): QueryErrorView {
  return {
    headline: QUERY_ERROR_HEADLINES[queryErrorDisposition(error.code)],
    code: error.code,
    message: error.message
  };
}
