import type {
  InlineDataSource,
  QueryDataSource,
  QuerySource
} from './data-source';
import type {
  DataRow,
  QueryFieldDefinition,
  QueryScalarFieldDefinition,
  QueryStandardScalarFieldDefinition
} from './field';
import type { Page } from './page';

/** 与查询定义一起保存的 DQE 原始执行结果，字段键使用 DQE 输出字段名。 */
export interface EmbeddedInitialRowsDocument {
  capturedAt: string;
  rows: DataRow[];
  totalCount?: number;
}

export interface QuerySourceDocument extends Omit<QuerySource, 'initial'> {
  initial?: EmbeddedInitialRowsDocument;
}

export interface QueryDataSourceDocument extends Omit<QueryDataSource, 'source'> {
  source: QuerySourceDocument;
}

/**
 * query 页面数据源的局部显式字段声明。字段角色由所在分组决定，
 * 其余结果字段契约与查询字段映射必须在当前页面数据源中写全。
 */
type WithoutRole<Field> = Field extends QueryScalarFieldDefinition
  ? Field extends QueryScalarFieldDefinition
    ? Omit<Field, 'role'>
    : never
  : never;

export type GroupedDimensionQueryFieldDefinition =
  WithoutRole<QueryStandardScalarFieldDefinition>;
export type GroupedMeasureQueryFieldDefinition =
  WithoutRole<QueryScalarFieldDefinition>;

export interface GroupedQueryFields {
  dimensions?: Record<string, GroupedDimensionQueryFieldDefinition>;
  measures?: Record<string, GroupedMeasureQueryFieldDefinition>;
}

export interface GroupedQueryDataSource extends Omit<QueryDataSourceDocument, 'fields'> {
  fields: GroupedQueryFields;
}

export type PageDataSourceDocument =
  | InlineDataSource
  | QueryDataSourceDocument
  | GroupedQueryDataSource;

export type PageDataSourcesDocument = Record<string, PageDataSourceDocument>;

/**
 * 页面修订中持久化的自包含文档。query 页面数据源可以使用按角色
 * 分组的局部显式形式；跨过统一运行时接缝前必须解析为 Page。
 */
export interface PageDocument extends Omit<Page, 'dataSources'> {
  dataSources: PageDataSourcesDocument;
}
