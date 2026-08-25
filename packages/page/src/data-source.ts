import type { ComputeOperator } from './compute';
import {
  hasQueryFieldMapping,
  type DataRow,
  type FieldDefinition,
  type QueryDataSourceFieldDefinition,
  type ResolvedFieldDefinition
} from './field';
import type { PageQuery } from './query';

export interface InlineSource {
  type: 'inline';
  rows: DataRow[];
}

export interface EmbeddedInitialRows {
  /** PageDocument 解析后已经按 queryField 归一化为稳定页面字段。 */
  capturedAt: string;
  rows: DataRow[];
  totalCount?: number;
}

export interface QuerySource {
  type: 'query';
  initial?: EmbeddedInitialRows;
  /** 以 language 为判别符的页面查询定义(判别联合,ADR-0034)。 */
  query: PageQuery;
}

export interface InlineDataSource {
  fields: Record<string, FieldDefinition>;
  /** 受控计算阶段（ADR-0046）；inline 与 query 都在同一位置声明。 */
  compute?: ComputeOperator[];
  source: InlineSource;
}

export interface QueryDataSource {
  fields: Record<string, QueryDataSourceFieldDefinition>;
  compute?: ComputeOperator[];
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
  if (isInlineDataSource(dataSource)) {
    return Object.fromEntries(
      Object.entries(dataSource.fields).map(([fieldId, definition]) => [
        fieldId,
        { ...definition }
      ])
    );
  }
  return Object.fromEntries(
    Object.entries(dataSource.fields).map(([fieldId, definition]) => {
      // 计算阶段产出字段本就没有外部响应字段名，直接原样交付。
      if (!hasQueryFieldMapping(definition)) return [fieldId, { ...definition }];
      if (definition.type !== 'recordList') {
        const { queryField: _queryField, ...field } = definition;
        return [fieldId, field];
      }
      const { queryField: _queryField, ...field } = definition;
      return [
        fieldId,
        {
          ...field,
          items: {
            fields: Object.fromEntries(
              Object.entries(definition.items.fields).map(([itemFieldId, itemDefinition]) => {
                const { queryField: _itemQueryField, ...itemField } = itemDefinition;
                return [itemFieldId, itemField];
              })
            )
          }
        }
      ];
    })
  );
}
