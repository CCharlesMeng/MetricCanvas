/** 页面校验错误闭集；同时作为跨语言契约导出的运行时真源。 */
export const ERROR_TYPES = [
  'SCHEMA_ERROR',
  'FIELD_CONTRACT_ERROR',
  'QUERY_MAPPING_ERROR',
  'FILTER_BINDING_ERROR',
  'DQE_PROTOCOL_ERROR',
  'DQE_EXECUTION_ERROR',
  'DATA_CONTEXT_ERROR'
] as const;

export type ErrorType = (typeof ERROR_TYPES)[number];

export interface TypedError {
  type: ErrorType;
  /** JSON Pointer 定位,如 "/sections/0/components/0/layout/span" */
  path: string;
  message: string;
}
