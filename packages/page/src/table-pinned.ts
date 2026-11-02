import {tableColumnLeaves as tableLeafColumns} from './table/columns';
export {tableColumnLeaves as tableLeafColumns} from './table/columns';
import { fieldBindingLeaves, fieldName, type FieldBinding, type FieldDefinition } from './field';
import type { Page, TableComponent, TableColumn } from './page';
import { resolveDataSourceFields } from './data-source';
import { conditionSourceIds } from './data-source-references';
import { queryLeaves } from './query-selection';
import type { TypedError } from './errors';

export function tablePinnedSlots(props: Pick<TableComponent['props'], 'pinnedTop'>): string[] {
  const pinned = props.pinnedTop;
  return pinned ? [pinned.data, ...(pinned.additionalData ?? [])] : [];
}
export function tableAlignedSlots(table: TableComponent): [string, string][] {
  const pinned = new Set(tablePinnedSlots(table.props));
  return Object.entries(table.data).filter(([slot]) => !pinned.has(slot));
}
function bindingDefinition(page: Page, table: TableComponent, binding: FieldBinding): FieldDefinition | undefined {
  const slot = typeof binding === 'string' ? 'main' : 'data' in binding ? binding.data : '';
  const source = page.dataSources[table.data[slot]];
  return source && resolveDataSourceFields(source)[fieldName(binding)];
}
function semantics(field: FieldDefinition): string {
  return JSON.stringify([field.type, field.role, 'currency' in field ? field.currency : null, 'unit' in field ? field.unit : null]);
}
function pinnedBindingErrors(page: Page, table: TableComponent, column: TableColumn, path: string): TypedError[] {
  const errors: TypedError[] = [];
  if (!column.pinnedTop) return errors;
  for (const key of ['field', 'secondaryField', 'badgeField'] as const) {
    const binding = column.pinnedTop[key];
    if (!binding) continue;
    for (const leaf of fieldBindingLeaves(binding)) {
      const slot = typeof leaf === 'string' ? 'main' : leaf.data;
      const field = bindingDefinition(page, table, leaf);
      if (!tablePinnedSlots(table.props).includes(slot) || !field) errors.push(error(path + '/' + key, '置顶字段必须引用已声明的置顶槽及有效字段'));
      const body = column[key];
      if (field && body) for (const bodyLeaf of fieldBindingLeaves(body)) {
        const original = bindingDefinition(page, table, bodyLeaf);
        if (original && semantics(original) !== semantics(field)) errors.push(error(path + '/' + key, '置顶字段与对应明细字段的类型、角色、币种和单位必须一致'));
      }
    }
  }
  return errors;
}
const error = (path: string, message: string): TypedError => ({ type: 'SCHEMA_ERROR', path, message });
export function tablePinnedErrors(page: Page, table: TableComponent, path: string): TypedError[] {
  const errors: TypedError[] = [];
  const slots = tablePinnedSlots(table.props);
  tableLeafColumns(table.props.columns).forEach((column, index) => {
    const at = path + '/props/columns/' + index + '/pinnedTop';
    errors.push(...pinnedBindingErrors(page, table, column, at));
    if (column.pinnedTop && slots.length === 0) errors.push(error(at, '置顶单元格需要声明置顶数据槽'));
    for (const key of ['field', 'secondaryField', 'badgeField'] as const) {
      if (column[key] && fieldBindingLeaves(column[key]).some(leaf => typeof leaf !== 'string' && slots.includes(leaf.data))) errors.push(error(at, '置顶槽不得作为明细对齐字段'));
    }
  });
  if (new Set(slots).size !== slots.length) errors.push(error(path + '/props/pinnedTop', '置顶数据槽不得重复'));
  const ids = slots.map(slot => table.data[slot]);
  if (new Set(ids).size !== ids.length) errors.push(error(path + '/props/pinnedTop', '置顶数据槽必须引用不同的独立查询'));
  for (const slot of slots) errors.push(...pinnedSourceErrors(page, table, slot, path));
  return errors;
}
function pinnedSourceErrors(page: Page, table: TableComponent, slot: string, path: string): TypedError[] {
  const id = table.data[slot], source = page.dataSources[id];
  const at = path + '/props/pinnedTop';
  if (slot === 'main' || !source || id === table.data.main) return [error(at, '置顶行必须引用独立的非 main 数据槽')];
  if (source.source.type !== 'query' || source.source.resultScope !== 'complete') return [error(at, '置顶行需要完整的普通 query 数据源')];
  const errors: TypedError[] = [];
  const dependencies = conditionSourceIds(page, id);
  if (tableAlignedSlots(table).some(([, member]) => dependencies.has(member))) errors.push(error(at, '置顶查询不能依赖明细数据源'));
  if (queryLeaves(source.source.query).some(query => hasWindow(query.body.dsl_list[0]))) errors.push(error(at, '置顶查询不能使用 limit 或 offset 截断结果'));
  return errors;
}
function hasWindow(item: Record<string, unknown>): boolean {
  const order = item.order;
  return !!order && typeof order === 'object' && ('limit' in order || 'offset' in order);
}

/** Consumer constraint: a complete source may supply zero or one pinned row. */
export function pinnedSnapshotError(snapshot: import('./snapshot').DataSnapshot): string | undefined {
  if (snapshot.status === 'loading') return undefined;
  if (snapshot.status === 'error') return '置顶查询失败';
  const count = snapshot.status === 'ready' ? snapshot.rows.length : 0;
  if (count > 1) return '置顶查询必须返回零行或一行';
  if (snapshot.totalCount !== undefined && snapshot.totalCount !== count) return '置顶查询结果不完整或总数不一致';
  return undefined;
}
