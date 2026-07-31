export type ErrorType =
  | 'SCHEMA_ERROR'
  | 'FIELD_CONTRACT_ERROR'
  | 'QUERY_MAPPING_ERROR'
  | 'FILTER_BINDING_ERROR'
  | 'DQE_PROTOCOL_ERROR'
  | 'DQE_EXECUTION_ERROR'
  | 'DATA_CONTEXT_ERROR';

export interface TypedError {
  type: ErrorType;
  /** JSON Pointer 定位,如 "/sections/0/components/0/layout/span" */
  path: string;
  message: string;
}
