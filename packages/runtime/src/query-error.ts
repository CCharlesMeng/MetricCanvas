import { isQueryErrorCode, type QueryError } from '@metriccanvas/page';

/**
 * 把数据网关的拒绝保留为结构化查询错误(issue #51)。
 * 按结构判别 code(自定义数据网关不必依赖 DqeGatewayError 类,
 * 跨 realm 时 instanceof 也不可靠);封闭集之外的异常兜底为 UNKNOWN。
 * 数据快照错误态与筛选候选值错误态共用这一份保留逻辑。
 */
export function preservedQueryError(cause: unknown): QueryError {
  const code = cause instanceof Error ? (cause as { code?: unknown }).code : undefined;
  return {
    code: isQueryErrorCode(code) ? code : 'UNKNOWN',
    message: cause instanceof Error ? cause.message : String(cause)
  };
}
