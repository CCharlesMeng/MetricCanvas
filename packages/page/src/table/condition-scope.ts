import type { Page, TableColumnNode } from '../page';
import type { TypedError } from '../errors';
import { conditionLeaves } from '../condition';
import { walkPageComponents } from '../component-walk';
import { visitTableColumns } from './columns';
export function columnFilterIds(columns: readonly TableColumnNode[]): Set<string> {
    const ids = new Set<string>();
    visitTableColumns(columns, '', node => {
        if (node.visibleWhen)
            for (const leaf of conditionLeaves(node.visibleWhen))
                if ('filter' in leaf)
                    ids.add(leaf.filter);
    });
    return ids;
}
/** Child templates are not ordinary component nodes, but their conditions consume inputs. */
export function expandedColumnFilterIds(page: Page): Set<string> {
    const ids = new Set<string>();
    walkPageComponents(page, table => {
        if (table.type === 'table' && table.props.rowExpansion?.selection) ids.add(table.props.rowExpansion.selection.filter);
        if (table.type === 'table' && table.props.rowExpansion)
            for (const id of columnFilterIds(table.props.rowExpansion.table.columns))
                ids.add(id);
    });
    return ids;
}
function privateOwners(page: Page): Map<string, string> {
    const owners = new Map<string, string>();
    for (const view of page.detailViews ?? [])
        for (const id of view.filters ?? [])
            owners.set(id, `detail:${view.id}`);
    walkPageComponents(page, table => {
        const input = table.type === 'table' ? table.props.rowExpansion?.data : undefined;
        if (table.type === 'table' && table.props.rowExpansion?.selection)
            for (const id of table.props.rowExpansion.selection.parentLookup.filters) owners.set(id, `lookup:${table.id}`);
        if (input?.type === 'query')
            for (const id of input.filters)
                owners.set(id, `row:${table.id}`);
    });
    return owners;
}
/** New column references cannot read another detail/expanded instance's private input. */
export function columnScopeErrors(page: Page): TypedError[] {
    const owners = privateOwners(page), errors: TypedError[] = [];
    function check(columns: readonly TableColumnNode[], path: string, scope?: string) {
        visitTableColumns(columns, path, (node, own) => {
            if (!node.visibleWhen)
                return;
            const ids = conditionLeaves(node.visibleWhen).flatMap(leaf => 'filter' in leaf ? [leaf.filter] : []);
            for (const id of ids)
                if (owners.has(id) && owners.get(id) !== scope)
                    errors.push({
                        type: 'SCHEMA_ERROR', path: `${own}/visibleWhen`, message: '列条件不能读取其他作用域的私有筛选输入'
                    });
        });
    }
    walkPageComponents(page, (table, path) => {
        if (table.type !== 'table')
            return;
        const detail = /^\/detailViews\/(\d+)\//.exec(path);
        const scope = detail ? `detail:${page.detailViews![Number(detail[1])].id}` : undefined;
        check(table.props.columns, `${path}/props/columns`, scope);
        if (table.props.rowExpansion)
            check(table.props.rowExpansion.table.columns, `${path}/props/rowExpansion/table/columns`, `row:${table.id}`);
    });
    return errors;
}
