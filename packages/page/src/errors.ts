/**
 * 校验错误分型:SCHEMA_ERROR=规格写错(改规格);
 * METRIC_GAP=业务想要、数据服务没有——是需求信号,走 metric-gap issue,不是 bug。
 */
export type ErrorType = 'SCHEMA_ERROR' | 'METRIC_GAP';

export interface TypedError {
  type: ErrorType;
  /** JSON Pointer 定位,如 "/widgets/0/position" */
  path: string;
  message: string;
}
