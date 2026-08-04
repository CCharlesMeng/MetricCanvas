import type { InlineDataSource, QueryDataSource } from './data-source';
import type { QueryFieldDefinition } from './field';
import type { Page } from './page';

/**
 * query 页面数据源的局部显式字段声明。字段角色由所在分组决定，
 * 其余结果字段契约与查询字段映射必须在当前页面数据源中写全。
 */
export type GroupedQueryFieldDefinition = Omit<QueryFieldDefinition, 'role'>;

export interface GroupedQueryFields {
  dimensions?: Record<string, GroupedQueryFieldDefinition>;
  measures?: Record<string, GroupedQueryFieldDefinition>;
}

export interface GroupedQueryDataSource extends Omit<QueryDataSource, 'fields'> {
  fields: GroupedQueryFields;
}

export type PageDataSourceDocument =
  | InlineDataSource
  | QueryDataSource
  | GroupedQueryDataSource;

export type PageDataSourcesDocument = Record<string, PageDataSourceDocument>;

/**
 * 页面修订中持久化的自包含文档。query 页面数据源可以使用按角色
 * 分组的局部显式形式；跨过统一运行时接缝前必须解析为 Page。
 */
export interface PageDocument extends Omit<Page, 'dataSources'> {
  dataSources: PageDataSourcesDocument;
}
