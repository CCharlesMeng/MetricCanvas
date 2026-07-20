/**
 * 元数据快照 (Catalog Snapshot):数据服务指标/维度目录的版本化副本(供给侧清单),
 * 语义校验的确定性参照,由 `sync-catalog` 命令同步、提交入仓库(仓库根 catalog/ 目录)。
 * 零数据行;业务数据永远实时查询、不落盘。
 */
export interface CatalogSnapshot {
  /** 快照格式大版本,独立于页面文档的 formatVersion 演进 */
  formatVersion: '1.0';
  /** 同步时刻(ISO 8601),由 sync-catalog 写入 */
  syncedAt: string;
  /** 快照来源说明(数据服务地址或"手工构造"),供评审辨识 */
  source: string;
  metrics: CatalogMetric[];
  dimensions: CatalogDimension[];
}

/**
 * 指标目录项。availableDimensions / availableAggregations 是语义校验的白名单;
 * 后端 MetricBaseInfo 尚未提供这两个字段(共建中,见《中间层分析.md》§4.5),
 * sync-catalog 初版按默认策略填充,后端扩展后替换为真实供给。
 */
export interface CatalogMetric {
  code: string;
  name: string;
  /** 指标值类型,mock 适配器按此造数:integer 整数 / decimal 两位小数 / percent 0~100 */
  valueType: 'integer' | 'decimal' | 'percent';
  /** 可用维度 code 白名单 */
  availableDimensions: string[];
  /** 可用聚合方式白名单(如 sum/avg/count) */
  availableAggregations: string[];
}

/** 维度目录项。cardinality(维度基数)供 mock 适配器决定造多少个枚举值 */
export interface CatalogDimension {
  code: string;
  name: string;
  cardinality: number;
  /** 样例枚举值(可选);mock 优先使用,不足 cardinality 时按 code 补造 */
  sampleValues?: string[];
}
