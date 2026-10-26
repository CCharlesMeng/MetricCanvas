import { evaluateCondition, hasColumnConditions, columnMainFields, columnPrimaryFields, projectComponentFields, type ConditionContext, type Page, type TableColumnNode, type TableComponent } from '@metriccanvas/page/internal';
type Search = NonNullable<TableComponent['props']['toolbar']>['search'];
export interface TableColumnPresentation {
    enabled: boolean;
    component: TableComponent;
    fields: ReadonlySet<string>;
    search: Search;
}
function visibleColumns(nodes: readonly TableColumnNode[], context: ConditionContext): TableColumnNode[] {
    return nodes.flatMap<TableColumnNode>(node => {
        if (evaluateCondition(node.visibleWhen, context).status !== 'allow')
            return [];
        if (node.kind !== 'group')
            return [node];
        const children = visibleColumns(node.children, context);
        return children.length ? [{ ...node, children }] : [];
    });
}
function visibleSearch(search: Search, fields: ReadonlySet<string>): Search {
    if (!search)
        return undefined;
    if ('fields' in search) {
        const visible = search.fields.filter(field => fields.has(field));
        return visible.length ? { ...search, fields: visible } : undefined;
    }
    const options = search.options.filter(option => fields.has(option.field));
    if (!options.length)
        return undefined;
    return { ...search, options, defaultValue: options.some(option => option.value === search.defaultValue) ? search.defaultValue : options[0].value };
}
/** One immutable projection for execution, screen and frozen exports. */
export function tableColumnPresentation(page: Page, table: TableComponent, context: ConditionContext): TableColumnPresentation {
    const enabled = hasColumnConditions(table.props.columns);
    const bound = enabled ? projectComponentFields(page, table, context.filters) as TableComponent : table;
    const columns = enabled ? visibleColumns(bound.props.columns, context) : bound.props.columns;
    const fields = columnPrimaryFields(columns);
    const toolbar = bound.props.toolbar;
    let search = toolbar?.search;
    if (enabled)
        search = visibleSearch(search, columnMainFields(columns, true));
    const component: TableComponent = enabled ? { ...bound, props: { ...bound.props, columns,
            toolbar: toolbar && columns.length ? { ...toolbar, search } : undefined } } : bound;
    return { enabled, component, fields, search };
}
