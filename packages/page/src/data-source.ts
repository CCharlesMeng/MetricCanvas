import type {
  DataRow,
  FieldDefinition,
  QueryFieldDefinition,
  ResolvedFieldDefinition
} from './field';
import type { DqeQueryDefinition } from './query';

export interface InlineSource {
  type: 'inline';
  rows: DataRow[];
}

export interface EmbeddedInitialRows {
  capturedAt: string;
  rows: DataRow[];
  totalCount?: number;
}

export interface QuerySource {
  type: 'query';
  initial?: EmbeddedInitialRows;
  query: DqeQueryDefinition;
}

export interface InlineDataSource {
  fields: Record<string, FieldDefinition>;
  source: InlineSource;
}

export interface QueryDataSource {
  fields: Record<string, QueryFieldDefinition>;
  source: QuerySource;
}

export type DataSource = InlineDataSource | QueryDataSource;
export type DataSources = Record<string, DataSource>;
export type DataSourceMode = 'inline' | 'query' | 'mixed';

export function dataSourceMode(dataSources: DataSources): DataSourceMode {
  const kinds = new Set(
    Object.values(dataSources).map((dataSource) => dataSource.source.type)
  );
  if (kinds.size > 1) return 'mixed';
  return kinds.has('query') ? 'query' : 'inline';
}

export function isInlineDataSource(
  dataSource: DataSource
): dataSource is InlineDataSource {
  return dataSource.source.type === 'inline';
}

export function isQueryDataSource(
  dataSource: DataSource
): dataSource is QueryDataSource {
  return dataSource.source.type === 'query';
}

export function resolveDataSourceFields(
  dataSource: DataSource
): Record<string, ResolvedFieldDefinition> {
  return Object.fromEntries(
    Object.entries(dataSource.fields).map(([fieldId, definition]) => {
      if (!('queryField' in definition)) return [fieldId, { ...definition }];
      const { queryField: _queryField, ...field } = definition;
      return [fieldId, field];
    })
  );
}
