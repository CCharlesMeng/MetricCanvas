/**
 * 查询错误分类的唯一声明(issue #51)。
 *
 * 数据网关执行生效查询失败时抛出携带此分类的错误
 * (真元:`DqeGatewayError.code` 直接以本联合为类型),分类随错误贯通
 * 数据快照错误态、组件呈现与嵌入事件,消费方按分类决定重试、重新登录
 * 或展示失败,不解析错误字符串。运行时与嵌入路径不得另造平行分类。
 *
 * 覆盖 issue #51 要求的独立语义:
 * - 取消:DQE_CANCELLED
 * - 需要登录:DQE_AUTH_REQUIRED
 * - 无权限:DQE_FORBIDDEN
 * - 超时:DQE_TIMEOUT
 * - 查询被拒绝:DQE_QUERY_REJECTED
 * - 上游失败:DQE_TRANSPORT_ERROR / DQE_ENVELOPE_ERROR / DQE_ITEM_ERROR
 * - 结果字段契约不匹配:DQE_FIELD_MAPPING_ERROR / DQE_ROW_CONTRACT_ERROR
 * - 查询声明错误(执行前即失败):DQE_CONFIG_ERROR / DQE_FILTER_BINDING_ERROR
 */
export const QUERY_ERROR_CODES = [
  'DQE_CONFIG_ERROR',
  'DQE_FILTER_BINDING_ERROR',
  'DQE_CANCELLED',
  'DQE_AUTH_REQUIRED',
  'DQE_FORBIDDEN',
  'DQE_TIMEOUT',
  'DQE_QUERY_REJECTED',
  'DQE_TRANSPORT_ERROR',
  'DQE_ENVELOPE_ERROR',
  'DQE_ITEM_ERROR',
  'DQE_FIELD_MAPPING_ERROR',
  'DQE_ROW_CONTRACT_ERROR'
] as const;

export type QueryErrorCode = (typeof QUERY_ERROR_CODES)[number];

export function isQueryErrorCode(value: unknown): value is QueryErrorCode {
  return (QUERY_ERROR_CODES as readonly unknown[]).includes(value);
}

/**
 * 数据快照错误态携带的结构化查询错误:稳定分类 + 脱值消息。
 * 消息只允许结构化事实(字段名、行号、返回码、耗时上限),查询结果、
 * 筛选值、Secret 与上游响应正文不得进入(issue #47 红线)。
 * `UNKNOWN` 兜底未携带分类的异常(如自定义数据网关抛出的普通 Error)。
 */
export interface QueryError {
  code: QueryErrorCode | 'UNKNOWN';
  message: string;
}

/** 按错误分类的处理语义:重试 / 重新登录 / 展示失败。 */
export type QueryErrorDisposition = 'retry' | 'reauth' | 'fail';

/**
 * 错误分类 → 处理语义的唯一映射。组件与嵌入宿主据此决定动作,
 * 不各自维护分类分支,也不解析错误字符串。
 */
export function queryErrorDisposition(
  code: QueryError['code']
): QueryErrorDisposition {
  switch (code) {
    case 'DQE_CANCELLED':
    case 'DQE_TIMEOUT':
    case 'DQE_TRANSPORT_ERROR':
      return 'retry';
    case 'DQE_AUTH_REQUIRED':
      return 'reauth';
    default:
      return 'fail';
  }
}
