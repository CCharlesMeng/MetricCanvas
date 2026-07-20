/**
 * 元数据快照 (Catalog Snapshot):数据服务指标/维度目录的版本化副本(供给侧清单),
 * 语义校验的确定性参照。零数据行;业务数据永远实时查询、不落盘。切片3(#4)落地。
 */
export interface CatalogSnapshot {
  syncedAt: string;
  metrics: Array<{ code: string; name: string }>;
  dimensions: Array<{ code: string; name: string }>;
}
