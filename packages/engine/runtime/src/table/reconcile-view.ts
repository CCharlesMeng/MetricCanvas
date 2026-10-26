import type { TableQueryView } from '@metriccanvas/page/internal';
import type { TableColumnPresentation } from './column-presentation';
function reconcileSearch(current: TableQueryView['search'], search: TableColumnPresentation['search']): TableQueryView['search'] {
    if (!current || !current.query.trim() || !search)
        return undefined;
    if ('fields' in search)
        return { ...current, fields: [...search.fields] };
    return search.options.some(option => option.field === current.fields[0]) ? current : undefined;
}
/** No effects, clocks or UI branches; default sort provenance belongs to the session. */
export function reconcileColumnView(view: TableQueryView, columns: TableColumnPresentation, defaultSort: TableQueryView['sort'], userSorted: boolean): TableQueryView {
    if (!columns.enabled)
        return view;
    let sort = userSorted ? view.sort.filter(rule => columns.fields.has(rule.field)) : view.sort;
    if (userSorted && !sort.length)
        sort = defaultSort;
    const predicates = view.predicates.filter(rule => columns.fields.has(rule.field));
    const search = reconcileSearch(view.search, columns.search);
    const next = { ...view, sort, predicates, search };
    const changed = queryShape(next) !== queryShape(view);
    return { ...next, pageIndex: changed ? 0 : view.pageIndex };
}
function queryShape(view: TableQueryView): string {
    const search = view.search?.query.trim() ? view.search : undefined;
    return JSON.stringify([view.sort, view.predicates, search]);
}
export function columnViewBehaviorChanged(previous: TableQueryView, next: TableQueryView): boolean {
    return previous.pageIndex !== next.pageIndex || previous.pageSize !== next.pageSize || queryShape(previous) !== queryShape(next);
}
