import type { DataRow, FieldDefinition } from './field';
import type { StructuredQuery } from './query';

export interface InlineSource {
  type: 'inline';
  rows: DataRow[];
}

export interface QuerySource {
  type: 'query';
  query: StructuredQuery;
}

export type DataSourceSpec = InlineSource | QuerySource;

/**
 * 命名数据源同时声明输出字段与取数方式。组件只依赖此输出契约，
 * 因而可在 inline/query 之间切换而不改变字段绑定。
 */
export interface DataSource {
  fields: Record<string, FieldDefinition>;
  source: DataSourceSpec;
}

export type DataSources = Record<string, DataSource>;
export type DataSourceMode = 'inline' | 'query' | 'mixed';

export function dataSourceMode(dataSources: DataSources): DataSourceMode {
  const kinds = new Set(Object.values(dataSources).map((dataSource) => dataSource.source.type));
  if (kinds.size > 1) return 'mixed';
  return kinds.has('query') ? 'query' : 'inline';
}
