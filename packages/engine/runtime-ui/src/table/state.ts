import { sourceFilterIds } from '@metriccanvas/page/internal';
import type { Page } from '@metriccanvas/page';
import { flattenPageComponents, conditionSourceIds, type Row } from '@metriccanvas/page/internal';
import type { FilterValues } from '../../../runtime/src';
import type { TableHeaderFilterValue, TableViewState } from '../../../widgets/src/components/table/view-state';
export function changedFilters(previous: FilterValues, next: FilterValues): Set<string> {
    return new Set([...new Set([...previous.keys(), ...next.keys()])].filter(id => JSON.stringify(previous.get(id)) !== JSON.stringify(next.get(id))));
}
/** 全页筛选改变只归一受影响表的页码；Tab 的排序、局部筛选继续归页面实例持有。 */
export function resetFilteredTablePages(page: Page, views: Record<string, TableViewState>, previous: FilterValues, next: FilterValues): Record<string, TableViewState> {
    const changed = changedFilters(previous, next);
    if (changed.size === 0)
        return views;
    const result = { ...views };
    for (const component of flattenPageComponents(page)) {
        if (component.type !== 'table')
            continue;
        const view = views[component.id];
        if (!view || view.pageIndex === 0)
            continue;
        const sources = conditionSourceIds(page, component.data.main);
        const queryAffected = [...sources].some(id => {
            const source = page.dataSources[id];
            return (sourceFilterIds(source).some(filter => changed.has(filter))) ||
                (source?.compute ?? []).some(op => op.op === 'selectField' ? changed.has(op.filter)
                    : op.op === 'timeFill' && 'filter' in op.range && changed.has(op.range.filter));
        });
        const localSearchAffected = component.props.pagination?.mode !== 'query' &&
            (page.filters ?? []).some(filter => filter.type === 'search' && changed.has(filter.id));
        if (queryAffected || localSearchAffected)
            result[component.id] = { ...view, pageIndex: 0 };
    }
    return result;
}
export { sortTableRows } from '@metriccanvas/data-execution/runtime';
import { filterTableRowsByHeaders as evaluate } from '@metriccanvas/data-execution/runtime';
import { normalizeHeaderDraft } from './controller';
export function filterTableRowsByHeaders(rows: readonly Row[], filters: import('@metriccanvas/page/internal').TableHeaderFilters | Readonly<Record<string, TableHeaderFilterValue>>): Row[] {
    const normalized = Object.fromEntries(Object.entries(filters).flatMap(([field, value]) => {
        if (value.mode !== 'numberRange' || typeof value.from === 'number' || typeof value.to === 'number' || (value.from === undefined && value.to === undefined))
            return [[field, value]];
        const applied = normalizeHeaderDraft(value as TableHeaderFilterValue);
        return applied ? [[field, applied]] : [];
    }));
    return evaluate(rows, normalized as import('@metriccanvas/page/internal').TableHeaderFilters);
}
