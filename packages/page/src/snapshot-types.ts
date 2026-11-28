import type { FieldValue, QueryFieldDefinition } from './field';
import type { QueryError } from './query-error';

/**
 * Pure leaf type definitions shared by `snapshot.ts`, `cell-fallback.ts`,
 * `query-rows.ts`, and `data-source.ts`.
 */

export type Row = Record<string, FieldValue>;

export interface ScalarDisplayFallback {
  raw: string | number | boolean;
  reason: 'TYPE_MISMATCH' | 'INVALID_NUMERIC_VALUE';
}
export type RowCellFallbacks = Record<string, ScalarDisplayFallback>;
export type CellFallbacks = Record<number, RowCellFallbacks>;

/** 按字段和原因计数，不保留原始值、数据行或每行告警。 */
export interface QueryRowNormalizationWarning {
  code:
    | 'MISSING_NUMERIC_QUERY_FIELD'
    | 'INVALID_NUMERIC_VALUE'
    | 'NUMERIC_NULL_NOT_ALLOWED'
    | 'SCALAR_TYPE_MISMATCH'
    | 'SCALAR_NULL_NOT_ALLOWED';
  expectedType?: QueryFieldDefinition['type'];
  fieldId: string;
  queryField: string;
  itemFieldId?: string;
  itemQueryField?: string;
  count: number;
}

/** Safe diagnostics only; no source rows, keys, filter values or response bodies. */
export interface DataWarning {
  code: 'TABLE_RESULT_RECOVERED' | 'COMPUTE_MISSING_KEY_ROWS';
  sourceId: string;
  /** 参与空键判定的页面字段 ID，不包含组织值。 */
  fields?: string[];
  message: string;
  count: number;
}

/**
 * 数据快照 (Data Snapshot):查询编排后分发给组件的数据包,
 * 含数据行与查询状态(就绪/加载/错误/空)。组件只认快照,不感知查询过程。
 * 错误态保留结构化查询错误(稳定分类 + 脱值消息,issue #51)。
 */
export type DataSnapshot =
  | { status: 'loading' }
  | {
      status: 'ready';
      rows: Row[];
      totalCount?: number;
      cellFallbacks?: CellFallbacks;
      warnings?: DataWarning[];
    }
  | { status: 'empty'; totalCount?: number; warnings?: DataWarning[] }
  | { status: 'error'; error: QueryError };
