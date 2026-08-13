import type { FieldValue } from './field';
import type { QueryError } from './query-error';

export type Row = Record<string, FieldValue>;

/**
 * 数据快照 (Data Snapshot):查询编排后分发给组件的数据包,
 * 含数据行与查询状态(就绪/加载/错误/空)。组件只认快照,不感知查询过程。
 * 错误态保留结构化查询错误(稳定分类 + 脱值消息,issue #51)。
 */
export type DataSnapshot =
  | { status: 'loading' }
  | { status: 'ready'; rows: Row[]; totalCount?: number }
  | { status: 'empty'; totalCount?: number }
  | { status: 'error'; error: QueryError };
