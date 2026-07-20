export type Row = Record<string, string | number | null>;

/**
 * 数据快照 (Data Snapshot):查询编排后分发给组件的数据包,
 * 含数据行与查询状态(就绪/加载/错误/空)。组件只认快照,不感知查询过程。
 */
export type DataSnapshot =
  | { status: 'loading' }
  /**
   * hasMore 仅在分页查询(生效查询带 limit)时出现:数据服务响应不返回总条数,
   * 编排器以盲翻探测(多取一行)判定是否存在下一页,组件据此禁用"下一页"。
   */
  | { status: 'ready'; rows: Row[]; hasMore?: boolean }
  | { status: 'empty' }
  | { status: 'error'; error: { message: string } };
