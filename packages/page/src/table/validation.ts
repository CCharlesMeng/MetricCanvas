import type { Page, TableComponent } from '../page';
import type { TypedError } from '../errors';
import { resolveDataSourceFields } from '../data-source';
import { hasQueryFieldMapping } from '../field';
import { hasColumnConditions, columnBindingKey, tableColumnLeaves } from './columns';
import { tableSlotSearchPlan } from './slot-search';
import type { FieldReference } from '../field';
import type { DataSource } from '../data-source';
const schemaError = (path: string, message: string): TypedError => ({ type: 'SCHEMA_ERROR', path, message });
export function tableSearchErrors(page: Page, component: TableComponent, componentPath: string): TypedError[] {
    const errors: TypedError[] = [];
    const search = component.props.toolbar?.search;
    if (search) {
        const declared = hasColumnConditions(component.props.columns) ? new Set(tableColumnLeaves(component.props.columns).flatMap(column => [column.field, column.secondaryField, column.badgeField]).filter((field): field is NonNullable<typeof field> => field !== undefined).map(columnBindingKey)) : undefined;
        const base = `${componentPath}/props/toolbar/search`;
        const targets = 'fields' in search ? search.fields.map((id, index) => ({ reference: id, path: `${base}/fields/${index}` })) : search.options.map((option, index) => ({ reference: option.field, path: `${base}/options/${index}/field` }));
        if ('fields' in search && new Set(search.fields).size !== search.fields.length)
            errors.push(schemaError(`${base}/fields`, '搜索字段不得重复'));
        if ('options' in search) {
            if (new Set(search.options.map(option => option.value)).size !== search.options.length)
                errors.push(schemaError(`${base}/options`, '搜索选项值不得重复'));
            if (search.defaultValue !== undefined && !search.options.some(option => option.value === search.defaultValue))
                errors.push(schemaError(`${base}/defaultValue`, '默认搜索选项必须存在'));
        }
        targets.forEach(({ reference, path }) => {
            if (declared && !declared.has(columnBindingKey(reference)))
                errors.push(schemaError(path, '启用列显隐时搜索字段必须属于已声明列的主字段、次字段或徽标字段'));
            errors.push(...searchReferenceErrors(page, component, reference, path));
        });
    }
    return errors;
}

function searchReferenceErrors(page: Page, table: TableComponent, reference: FieldReference, path: string): TypedError[] {
    if (typeof reference !== 'string' && reference.data !== 'main') {
        try { tableSlotSearchPlan(page, table, reference); return []; }
        catch (cause) { return [schemaError(path, cause instanceof Error ? cause.message : '跨槽搜索配置无效')]; }
    }
    const id = typeof reference === 'string' ? reference : reference.field;
    const source = page.dataSources[table.data.main], fields = source ? resolveDataSourceFields(source) : {};
    const errors: TypedError[] = [];
    if (!fields[id] || fields[id].type !== 'string') errors.push(schemaError(path, '搜索必须引用 main 数据槽中的文本标量字段'));
    if (source?.source.type === 'query' && source.source.resultScope !== 'complete' && (!source.fields[id] || !hasQueryFieldMapping(source.fields[id]))) errors.push(schemaError(path, '查询搜索字段必须具有 queryField 映射'));
    return errors;
}
/** New ownership restriction applies only to tables opting into column conditions. */
export function conditionalTableNeedsOwner(table: TableComponent, source: DataSource | undefined): boolean {
    if (!hasColumnConditions(table.props.columns) || source?.source.type !== 'query' || source.source.resultScope === 'complete')
        return false;
    return !!table.props.toolbar?.search || tableColumnLeaves(table.props.columns).some(column => column.sortable || column.filterable);
}
