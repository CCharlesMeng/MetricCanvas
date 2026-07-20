export type Row = Record<string, string | number | null>;

/**
 * 数据快照 (Data Snapshot):查询编排后分发给组件的数据包,
 * 含数据行与查询状态(就绪/加载/错误/空)。组件只认快照,不感知查询过程。
 */
export type DataSnapshot =
  | { status: 'loading' }
  | { status: 'ready'; rows: Row[] }
  | { status: 'empty' }
  | { status: 'error'; error: { message: string } };
