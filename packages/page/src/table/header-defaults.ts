import type { Page, TableColumn, TableColumnNode, TableComponent } from '../page';
import type { PagedJoinDataSource } from '../paged-join';
import { queryLeaves } from '../query-selection';
import type { TypedError } from '../errors';
import { walkPageComponents } from '../component-walk';
import { resolveDataSourceFields } from '../data-source';
import { hasQueryFieldMapping } from '../field';
import { aiSummaryRelatedData } from '../ai-summary';
import { definitionSourceIds, resultSourceIds } from '../data-source-references';
import { isPagedJoinQuery, pagedJoinViewOwner } from '../paged-join-view';
import { mainColumnField, tableColumnLeaves, visitTableColumns } from './columns';

export function hasHeaderDefaults(columns: readonly TableColumnNode[]): boolean {
  return tableColumnLeaves(columns).some(column => column.filterable?.mode === 'select' && column.filterable.defaultValues !== undefined);
}
export function headerDefaultValues(column: TableColumn): readonly (string | number)[] {
  return column.filterable?.mode === 'select' ? column.filterable.defaultValues ?? [] : [];
}
/** Explicit complete results stay local; a query window remains remote. */
export function tableDefaultsRemote(page: Page, table: TableComponent): boolean {
  const source = page.dataSources[table.data.main]?.source;
  if (!source || source.type === 'inline') return false;
  if (source.type !== 'query' || source.resultScope !== 'complete' || table.props.pagination?.mode === 'query') return true;
  return queryLeaves(source.query).some(query => {
    const order=query.body.dsl_list[0]?.order;
    return !!order && typeof order==='object' && ('limit' in order || 'offset' in order);
  });
}
const issue = (path: string, message: string): TypedError => ({ type: 'SCHEMA_ERROR', path, message });
function columnDefaultErrors(page: Page, table: TableComponent, column: TableColumn, path: string): TypedError[] {
  if (column.filterable?.mode !== 'select' || column.filterable.defaultValues === undefined) return [];
  const target = path + '/filterable/defaultValues', values = column.filterable.defaultValues;
  const field = mainColumnField(column.field);
  if (field === undefined) return [issue(target, '默认筛选只允许静态 main 字段绑定')];
  const source = page.dataSources[table.data.main];
  const definition = source && resolveDataSourceFields(source)[field];
  const errors: TypedError[] = [];
  if (source?.source.type==='query' && tableDefaultsRemote(page,table) && (!source.fields[field] || !hasQueryFieldMapping(source.fields[field])))
    errors.push(issue(target, '远程默认筛选字段必须具有 queryField 映射'));
  if (new Set(values.map(value => JSON.stringify([typeof value, value]))).size !== values.length)
    errors.push(issue(target, '默认筛选原始值不得重复'));
  values.forEach((value, index) => {
    if (!defaultTypeMatches(definition?.type, value)) errors.push(issue(target + '/' + index, '默认筛选值必须符合字段原始类型'));
    if (column.enumValues && !column.enumValues.some(option => option.value === value))
      errors.push(issue(target + '/' + index, '默认筛选值必须存在于列枚举中'));
  });
  return errors;
}
function defaultTypeMatches(type: string | undefined, value: string | number): boolean {
  if (type === 'number' || type === 'money') return typeof value === 'number' && Number.isFinite(value);
  return ['string','date','datetime'].includes(type ?? '') && typeof value === 'string';
}
function sourceUsages(page: Page): Map<string, string[]> {
  const references = new Map<string, string[]>();
  function add(id: string, path: string) { references.set(id, [...references.get(id) ?? [], path]); }
  walkPageComponents(page, (component, path) => {
    for (const [slot, id] of Object.entries(component.data ?? {})) add(id, path + '/data/' + slot);
    if (component.type === 'aiSummary')
      Object.values(aiSummaryRelatedData(page, component.props, {}, component.id)).forEach(value => add(value.source, path + '/props'));
  });
  for (const [id, source] of Object.entries(page.dataSources))
    for (const dependency of [...definitionSourceIds(source), ...resultSourceIds(source)]) add(dependency, '/dataSources/' + id);
  return references;
}
function memberDefaultErrors(page: Page, table: TableComponent, path: string): TypedError[] {
  const source = page.dataSources[table.data.main];
  if (source?.source.type !== 'pagedJoin' || !isPagedJoinQuery(source.source)) return [];
  const fields = unconditionalDefaultFields(table.props.columns);
  if (!fields.length) return [];
  try {
    pagedJoinViewOwner(source as PagedJoinDataSource, {pageIndex:0,pageSize:source.source.pagination.pageSize,sort:source.source.ordering.default,
      predicates:fields.map(field => ({field,op:'in',values:['__check_owner__']}))});
    return [];
  } catch {
    return [issue(path + '/props/columns', '按需组合查询的默认筛选与默认排序必须来自同一个查询成员')];
  }
}
function unconditionalDefaultFields(columns: readonly TableColumnNode[]): string[] {
  return columns.flatMap(column => {
    if(column.visibleWhen)return [];
    if(column.kind==='group')return unconditionalDefaultFields(column.children);
    const field=mainColumnField(column.field);
    return field!==undefined&&headerDefaultValues(column).length?[field]:[];
  });
}
export function tableHeaderDefaultErrors(page: Page): TypedError[] {
  const errors: TypedError[] = [], usages = sourceUsages(page);
  walkPageComponents(page, (component, path) => {
    if (component.type !== 'table' || !hasHeaderDefaults(component.props.columns)) return;
    visitTableColumns(component.props.columns, path + '/props/columns', (column, own) => {
      if (column.kind !== 'group') errors.push(...columnDefaultErrors(page, component, column, own));
    });
    if (tableDefaultsRemote(page, component) && usages.get(component.data.main)?.length !== 1)
      errors.push(issue(path + '/data/main', '默认筛选的远程表格必须独占页面数据源，不能共享组件或查询依赖'));
    errors.push(...memberDefaultErrors(page, component, path));
  });
  return errors;
}
