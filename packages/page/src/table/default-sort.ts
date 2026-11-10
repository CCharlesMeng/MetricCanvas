import type { Page, TableComponent } from '../page';
import type { TypedError } from '../errors';
import { mainColumnField, tableColumnLeaves } from './columns';
import { tableDefaultsRemote } from './header-defaults';
import { resolveDataSourceFields } from '../data-source';

/** Local defaults refer to final visible columns; query ordering stays in its existing source declaration. */
export function tableDefaultSortErrors(page: Page, table: TableComponent, path: string): TypedError[] {
  const rules = table.props.defaultSort;
  if (!rules) return [];
  const errors: TypedError[] = [];
  const issue = (suffix: string, message: string) => errors.push({ type: 'SCHEMA_ERROR', path: `${path}/props/defaultSort${suffix}`, message });
  if (tableDefaultsRemote(page, table)) issue('', '默认本地排序要求完整本地结果；远程排序请在查询或组合源声明');
  const fields = new Set(tableColumnLeaves(table.props.columns).map(column => mainColumnField(column.field)));
  const source = page.dataSources[table.data.main];
  const definitions = source ? resolveDataSourceFields(source) : {};
  const seen = new Set<string>();
  rules.forEach((rule, index) => {
    if (!fields.has(rule.field) || !definitions[rule.field] || definitions[rule.field].role === 'detail') issue(`/${index}/field`, '默认排序必须引用当前表格的静态 main 标量列字段');
    if (seen.has(rule.field)) issue(`/${index}/field`, '默认排序字段不得重复');
    seen.add(rule.field);
  });
  return errors;
}
