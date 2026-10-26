import { reconcileColumnView, columnViewBehaviorChanged } from './reconcile-view';
import type { TableColumnPresentation } from './column-presentation';
import { tableQueryViewZ, type TableQueryView, type TableHeaderFilters, tablePredicates } from '@metriccanvas/page/internal';
/** Sole writer of committed table state. Draft strings never enter this module. */
export function createTableSession(initial: TableQueryView, changed: (view: TableQueryView) => void = () => { }) {
    let view = structuredClone(initial), generation = 0;
    let userSorted = false;
    const defaultSort = structuredClone(initial.sort);
    let controller = new AbortController();
    function commit(next: TableQueryView, notify = true, advance = true) {
        if (!tableQueryViewZ.safeParse(next).success || JSON.stringify(next) === JSON.stringify(view))
            return false;
        view = structuredClone(next);
        if (advance)
            invalidate();
        if (notify)
            changed(snapshot());
        return true;
    }
    function snapshot(): TableQueryView { return structuredClone(view); }
    function invalidate() { generation++; controller.abort(); controller = new AbortController(); return generation; }
    return {
        snapshot, invalidate, get generation() { return generation; }, get signal() { return controller.signal; },
        setPage(pageIndex: number) { return commit({ ...view, pageIndex }); },
        setPageSize(pageSize: number) { return commit({ ...view, pageSize, pageIndex: 0 }); },
        setSort(sort: TableQueryView['sort']) { userSorted = JSON.stringify(sort) !== JSON.stringify(defaultSort); return commit({ ...view, sort, pageIndex: 0 }); },
        setHeaders(filters: TableHeaderFilters) { if (Object.values(filters).some(value => value.mode === 'numberRange' && value.from !== undefined && value.to !== undefined && value.from > value.to))
            return false; return commit({ ...view, predicates: tablePredicates(filters), pageIndex: 0 }); },
        setSearch(search: NonNullable<TableQueryView['search']>) { return commit({ ...view, search: { ...search, fields: [...search.fields], query: search.query.trim() }, pageIndex: 0 }); },
        reconcileColumns(columns: TableColumnPresentation, notify = true) { const next = reconcileColumnView(view, columns, defaultSort, userSorted), affects = columnViewBehaviorChanged(view, next); const committed = commit(next, notify && affects, affects); return committed && affects; },
        resetPresentation() { userSorted = false; return commit({ ...view, pageIndex: 0, sort: [], predicates: [], search: undefined }, false); },
        resetPage() { return commit({ ...view, pageIndex: 0 }, false); },
        correct(next: TableQueryView, expectedGeneration: number) { return expectedGeneration === generation && commit(next, false, false); },
        dispose() { controller.abort(); generation++; }
    };
}
export type TableSession = ReturnType<typeof createTableSession>;
