import { reconcileColumnView, columnViewBehaviorChanged } from './reconcile-view';
import type { TableColumnPresentation } from './column-presentation';
import { tableQueryViewZ, type TableQueryView, type TableHeaderFilters, tablePredicates } from '@metriccanvas/page/internal';
/** Sole writer of committed table state. Draft strings never enter this module. */
export function createTableSession(initial: TableQueryView, changed: (view: TableQueryView) => void = () => { }, prepare:(view:TableQueryView,field?:string)=>TableQueryView=view=>view) {
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
        setSort(sort: TableQueryView['sort']) { const next=prepare({ ...view, sort, pageIndex: 0 },changedRuleField(view.sort,sort)); userSorted = JSON.stringify(sort) !== JSON.stringify(defaultSort); return commit(next); },
        setHeaders(filters: TableHeaderFilters,field?:string) { if (Object.values(filters).some(value => value.mode === 'numberRange' && value.from !== undefined && value.to !== undefined && value.from > value.to))
            return false; return commit(prepare({ ...view, predicates: tablePredicates(filters), pageIndex: 0 },field??changedRuleField(view.predicates,tablePredicates(filters)))); },
        setSearch(search: NonNullable<TableQueryView['search']>) { return commit(prepare({ ...view, search: { ...search, fields: [...search.fields], query: search.query.trim() }, pageIndex: 0 })); },
        reconcileColumns(columns: TableColumnPresentation, notify = true) { const reconciled = reconcileColumnView(view, columns, defaultSort, userSorted), next=prepare(reconciled,reconciled.predicates[0]?.field), affects = columnViewBehaviorChanged(view, next); const committed = commit(next, notify && affects, affects); return committed && affects; },
        resetDefault() { userSorted=false;return commit(structuredClone(initial),false); },
        resetPresentation() { userSorted = false; return commit({ ...view, pageIndex: 0, sort: [], predicates: [], search: undefined }, false); },
        resetPage() { return commit({ ...view, pageIndex: 0 }, false); },
        correct(next: TableQueryView, expectedGeneration: number) { return expectedGeneration === generation && commit(next, false, false); },
        dispose() { controller.abort(); generation++; }
    };
}
function changedRuleField(before:readonly {field:string}[],after:readonly {field:string}[]):string|undefined{
 const previous=Object.fromEntries(before.map(rule=>[rule.field,rule]));
 const next=Object.fromEntries(after.map(rule=>[rule.field,rule]));
 const changed=[...new Set([...Object.keys(previous),...Object.keys(next)])].filter(field=>JSON.stringify(previous[field])!==JSON.stringify(next[field]));
 return changed.length===1?changed[0]:undefined;
}
export type TableSession = ReturnType<typeof createTableSession>;
