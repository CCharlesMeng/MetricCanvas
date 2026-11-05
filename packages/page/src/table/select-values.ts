import type { Page, TableColumn, TableColumnNode } from '../page';
import type { TableQueryView } from './query-view';
import { resolveDataSourceFields } from '../data-source';
import { mainColumnField, tableColumnLeaves } from './columns';

/** Enum labels never imply unrestricted selection. Compare typed raw sets. */
export function normalizeTableSelectValues(column: TableColumn, values: readonly (string | number)[]): readonly (string | number)[] {
  if (column.filterable?.mode !== 'select' || column.filterable.allBehavior !== 'unrestricted' || !column.enumValues) return values;
  return values.length === column.enumValues.length && column.enumValues.every(option => values.includes(option.value)) ? [] : values;
}
/** New explicit selection policies validate restored/manual values before a session commits. */
export function normalizeTableSelectView(page: Page, sourceId: string, columns: readonly TableColumnNode[], view: TableQueryView): TableQueryView {
  const leaves = tableColumnLeaves(columns);
  const fields = resolveDataSourceFields(page.dataSources[sourceId]);
  const predicates = view.predicates.flatMap(predicate => {
    const column = leaves.find(column => mainColumnField(column.field) === predicate.field);
    if (predicate.op !== 'in' || column?.filterable?.mode !== 'select') return [predicate];
    if (column.filterable.initialParam !== undefined || column.filterable.allBehavior !== undefined) {
      const type = fields[predicate.field]?.type;
      if (selectValueErrors(column, predicate.values, type).length) throw new Error(`表头筛选值不合法: ${predicate.field}`);
    }
    const values = normalizeTableSelectValues(column, predicate.values);
    return values.length ? [{...predicate, values: [...values]}] : [];
  });
  return {...view, predicates};
}
export function selectValueErrors(column: TableColumn, values: readonly (string | number)[], type: string | undefined): number[] {
  return values.flatMap((value, index) => {
    const matches = type === 'number' || type === 'money' ? typeof value === 'number' && Number.isFinite(value) : typeof value === 'string';
    return !matches || values.indexOf(value) !== index || column.enumValues && !column.enumValues.some(option => option.value === value) ? [index] : [];
  });
}
