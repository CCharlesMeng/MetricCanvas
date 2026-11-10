import {
  normalizeTableSelectValues, normalizeTableSelectView, evaluateCondition, flattenPageComponents, hasHeaderDefaults, headerDefaultValues, mainColumnField,
  tableColumnLeaves, tableDefaultsRemote, type ConditionContext, type Page, type TableColumnNode,
  type TableComponent, type TableQueryView
} from '@metriccanvas/page/internal';
import { defaultSourceView } from './source-program/session';
import { tableColumnPresentation } from './table-presentation';

/** Pending facts must settle before a new default-bearing table can read. */
export function tableDefaultInputsPending(columns: readonly TableColumnNode[], context: ConditionContext): boolean {
  return columns.some(column => {
    if (!hasHeaderDefaults([column])) return false;
    const result = evaluateCondition(column.visibleWhen, context);
    if (result.status === 'pending' || result.status === 'error') return true;
    if (result.status === 'deny') return false;
    return column.kind === 'group' && tableDefaultInputsPending(column.children, context);
  });
}
export function defaultTableView(page: Page, table: TableComponent, context: ConditionContext, base: TableQueryView): TableQueryView {
  const columns = tableColumnPresentation(page, table, context).component.props.columns;
  const predicates: TableQueryView['predicates'] = tableColumnLeaves(columns).flatMap(column => {
    const values = normalizeTableSelectValues(column, headerDefaultValues(column, page)), field = mainColumnField(column.field);
    return values.length && field !== undefined ? [{field, op:'in' as const, values:[...values]}] : [];
  });
  return { ...structuredClone(base), sort: structuredClone(table.props.defaultSort ?? base.sort), predicates };
}
/** Complete replacement preserves an explicitly restored empty view. */
export function initialTableViews(page: Page, context: ConditionContext, restored: ReadonlyMap<string, TableQueryView> = new Map(), limits: ReadonlyMap<string, number> = new Map()) {
  const views = new Map(restored), defaults = new Map<string, TableQueryView>(), pending = new Set<string>();
  for (const table of flattenPageComponents(page)) {
    if (table.type !== 'table' || !tableDefaultsRemote(page, table)) continue;
    if (restored.has(table.data.main)) views.set(table.data.main, normalizeTableSelectView(page,table.data.main,table.props.columns,restored.get(table.data.main)!));
    if (!hasHeaderDefaults(table.props.columns)) continue;
    const id = table.data.main;
    if (tableDefaultInputsPending(table.props.columns, context)) { pending.add(id); continue; }
    const baseline = defaultTableView(page, table, context, defaultSourceView(page, id, limits.get(id)));
    defaults.set(id, baseline);
    views.set(id, restored.has(id) ? normalizeTableSelectView(page,id,table.props.columns,restored.get(id)!) : baseline);
  }
  return { views, defaults, pending };
}
export function remoteHeaderDefaultSources(page: Page): Set<string> {
  return new Set(flattenPageComponents(page).flatMap(table =>
    table.type === 'table' && tableDefaultsRemote(page, table) && hasHeaderDefaults(table.props.columns)
      ? [table.data.main] : []));
}
