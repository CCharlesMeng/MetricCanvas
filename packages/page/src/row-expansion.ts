import type { Page, TableComponent, TableProps, TableColumn, TableColumnNode } from './page';
import type { Row } from './snapshot';
import type { EffectiveQuery } from './query';
import { hasQueryFieldMapping } from './field';
import { resolveDataSourceFields } from './data-source';
import { flattenPageComponents } from './component-walk';

export type RowExpansion = NonNullable<TableProps['rowExpansion']>;

export function rowExpansionQuerySources(page: Pick<Page, 'sections' | 'detailViews'>): Set<string> {
  return new Set(flattenPageComponents(page).flatMap(component => {
    const input = component.type === 'table' ? component.props.rowExpansion?.data : undefined;
    return input?.type === 'query' ? [input.source] : [];
  }));
}

export function rowExpansionColumns(columns: TableColumnNode[]): TableColumn[] {
  return columns.flatMap(column => column.kind === 'group' ? rowExpansionColumns(column.children) : [column]);
}

/** A template becomes one ordinary table inside a private execution scope. */
export function rowExpansionPage(page: Page, parent: TableComponent, rows: Row[] = []): { page: Page; table: TableComponent } {
  const expansion = parent.props.rowExpansion;
  if (!expansion) throw new Error('表格未声明子表格');
  const input = expansion.data;
  const sourceId = input.type === 'query' ? input.source : `${parent.id}-row-data`;
  const parentFields = resolveDataSourceFields(page.dataSources[parent.data.main]!);
  const field = input.type === 'recordList' ? parentFields[input.field] : undefined;
  if (input.type === 'recordList' && field?.type !== 'recordList') throw new Error('子表格必须绑定嵌套明细字段');
  const source = page.dataSources[sourceId];
  if (input.type === 'query' && source?.source.type !== 'query') throw new Error('子表格查询数据源不可用');
  const table: TableComponent = {
    id: `${parent.id}-row-table`, type: 'table', layout: { span: 12 }, data: { main: sourceId },
    props: { ...expansion.table, pagination: expansion.table.pagination ?? { mode: 'local', pageSize: 10, numbered: true } }
  };
  const scope: Page = { ...page, dashboardToolbar: undefined, iocHeader: undefined, detailViews: undefined,
    sectionGroups: undefined, defaultSectionGroup: undefined, sectionGroupParam: undefined, sectionAnchors: undefined,
    dataSources: input.type === 'query' && source?.source.type === 'query'
      ? { [sourceId]: { ...source, source: { ...source.source, initial: undefined } } }
      : { [sourceId]: { fields: field?.type === 'recordList' ? field.items.fields : {}, source: { type: 'inline', rows } } },
    sections: [{ id: 'row-content', container: 'plain', components: [table] }]
  };
  // Page input can be a reactive UI proxy. The isolated scope owns JSON metadata,
  // and must never leak proxies into a host DataGateway.
  const isolated = JSON.parse(JSON.stringify(scope)) as Page;
  return { page: isolated, table: isolated.sections[0]!.components[0] as TableComponent };
}

/** Preserve primitive types: numeric 1 and string "1" are different row identities. */
export function expansionRowKey(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? `s:${value}`
    : typeof value === 'number' && Number.isFinite(value) ? `n:${value}` : undefined;
}

/** Add deterministic tie-breaking without changing the user's visible sort controls. */
export function stableRowQuery(query: EffectiveQuery, rowKey: string): EffectiveQuery {
  const field = query.fieldMappings[rowKey];
  if (!field || !hasQueryFieldMapping(field)) throw new Error('子表格行键没有查询映射');
  const order = query.body.dsl_list[0]?.order;
  const by = order && typeof order === 'object' && !Array.isArray(order) ? order.by : undefined;
  const defaults: NonNullable<EffectiveQuery['sort']> = [];
  if (!query.sort && by !== undefined) {
    if (!Array.isArray(by)) throw new Error('子表格默认排序格式不可用');
    for (const item of by) {
      if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.field !== 'string' || !['asc', 'desc'].includes(String(item.type))) throw new Error('子表格默认排序格式不可用');
      defaults.push({ queryField: item.field, direction: item.type as 'asc' | 'desc' });
    }
  }
  const sort = [...(query.sort ?? defaults)];
  if (!sort.some(rule => rule.queryField === field.queryField)) sort.push({ queryField: field.queryField, direction: 'asc' });
  return { ...query, sort };
}
