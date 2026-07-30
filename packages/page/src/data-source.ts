import type { CatalogSnapshot } from './catalog';
import type {
  DataRow,
  FieldDefinition,
  FieldOverride,
  ResolvedFieldDefinition
} from './field';
import type { StructuredQuery } from './query';

export interface InlineSource {
  type: 'inline';
  rows: DataRow[];
}

export interface QuerySource {
  type: 'query';
  query: StructuredQuery;
}

export interface InlineDataSource {
  fields: Record<string, FieldDefinition>;
  fieldOverrides?: never;
  source: InlineSource;
}

/** schemaVersion 1.0 的 query 页面数据源，由迁移器升级为紧凑形态。 */
export interface LegacyQueryDataSource {
  fields: Record<string, FieldDefinition>;
  fieldOverrides?: never;
  source: QuerySource;
}

/**
 * schemaVersion 2.0 的 query 页面数据源。完整输出字段契约由结构化查询与
 * 元数据快照解析，页面只声明必要的展示覆盖。
 */
export interface QueryDataSource {
  fields?: never;
  fieldOverrides?: Record<string, FieldOverride>;
  source: QuerySource;
}

export type DataSource = InlineDataSource | LegacyQueryDataSource | QueryDataSource;
export type DataSources = Record<string, DataSource>;
export type DataSourceMode = 'inline' | 'query' | 'mixed';

export function dataSourceMode(dataSources: DataSources): DataSourceMode {
  const kinds = new Set(Object.values(dataSources).map((dataSource) => dataSource.source.type));
  if (kinds.size > 1) return 'mixed';
  return kinds.has('query') ? 'query' : 'inline';
}

export function isInlineDataSource(dataSource: DataSource): dataSource is InlineDataSource {
  return dataSource.source.type === 'inline';
}

export function isQueryDataSource(
  dataSource: DataSource
): dataSource is LegacyQueryDataSource | QueryDataSource {
  return dataSource.source.type === 'query';
}

/**
 * 把两种持久化来源统一解析为运行时字段契约：
 * - inline 直接使用页面声明；
 * - 1.0 query 兼容旧 fields；
 * - 2.0 query 从结构化查询与元数据快照推导，再合并字段名称覆盖；
 * - 元数据快照 defaultFormat 与旧 format 均归一为运行时 defaultFormat。
 *
 * catalog 缺席时仍按 query 的 metrics/dimensions 推导最小角色与标量类型，
 * 供纯结构/引用校验使用；正式渲染必须传入元数据快照。
 */
export function resolveDataSourceFields(
  dataSource: DataSource,
  catalog?: CatalogSnapshot
): Record<string, ResolvedFieldDefinition> {
  if (isInlineDataSource(dataSource) || 'fields' in dataSource) {
    return Object.fromEntries(
      Object.entries(dataSource.fields ?? {}).map(([code, definition]) => [
        code,
        normalizeFieldDefinition(definition)
      ])
    );
  }

  const metrics = new Map(catalog?.metrics.map((metric) => [metric.code, metric]) ?? []);
  const dimensions = new Map(
    catalog?.dimensions.map((dimension) => [dimension.code, dimension]) ?? []
  );
  const resolved: Record<string, ResolvedFieldDefinition> = {};

  for (const code of dataSource.source.query.dimensions ?? []) {
    const definition = dimensions.get(code);
    resolved[code] = mergeOverride(
      {
        type: definition?.valueType ?? 'string',
        role: 'dimension',
        ...(definition?.name ? { label: definition.name } : {}),
        ...catalogDefaultFormat(definition)
      },
      dataSource.fieldOverrides?.[code]
    );
  }
  for (const code of dataSource.source.query.metrics) {
    const definition = metrics.get(code);
    resolved[code] = mergeOverride(
      {
        type: 'number',
        role: 'metric',
        ...(definition?.name ? { label: definition.name } : {}),
        ...catalogDefaultFormat(definition)
      },
      dataSource.fieldOverrides?.[code]
    );
  }
  return resolved;
}

function mergeOverride(
  definition: ResolvedFieldDefinition,
  override: FieldOverride | undefined
): ResolvedFieldDefinition {
  if (!override) return definition;
  return {
    ...definition,
    ...(override.label ? { label: override.label } : {}),
    ...(override.format ? { defaultFormat: override.format } : {})
  };
}

function normalizeFieldDefinition(
  definition: FieldDefinition
): ResolvedFieldDefinition {
  const { format, ...dataDefinition } = definition;
  return {
    ...dataDefinition,
    ...(format ? { defaultFormat: format } : {})
  };
}

function catalogDefaultFormat(
  definition:
    | CatalogSnapshot['metrics'][number]
    | CatalogSnapshot['dimensions'][number]
    | undefined
): Pick<ResolvedFieldDefinition, 'defaultFormat'> | Record<string, never> {
  const defaultFormat = definition?.defaultFormat ?? definition?.format;
  return defaultFormat ? { defaultFormat } : {};
}
