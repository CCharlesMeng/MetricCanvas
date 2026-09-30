import type { Page } from '@metriccanvas/page';
import { flattenPageComponents, computeDependencies, type Row } from '@metriccanvas/page/internal';
import type { FilterValues } from '../../runtime/src';
import type { TableViewState } from '../../widgets/src/components/table/view-state';

export function changedFilters(previous: FilterValues, next: FilterValues): Set<string> {
  return new Set([...new Set([...previous.keys(), ...next.keys()])].filter(
    id => JSON.stringify(previous.get(id)) !== JSON.stringify(next.get(id))
  ));
}

/** 全页筛选改变只归一受影响表的页码；Tab 的排序、局部筛选继续归页面实例持有。 */
export function resetFilteredTablePages(
  page: Page,
  views: Record<string, TableViewState>,
  previous: FilterValues,
  next: FilterValues
): Record<string, TableViewState> {
  const changed = changedFilters(previous, next);
  if (changed.size === 0) return views;
  const result = { ...views };
  for (const component of flattenPageComponents(page)) {
    if (component.type !== 'table') continue;
    const view = views[component.id];
    if (!view || view.pageIndex === 0) continue;
    const sources = new Set([component.data.main]);
    for (const id of sources) {
      for (const dependency of computeDependencies(page.dataSources[id]?.compute ?? [])) sources.add(dependency);
    }
    const queryAffected = [...sources].some(id => {
      const source = page.dataSources[id];
      return (source?.source.type === 'query' &&
        Object.keys(source.source.query.filterBindings ?? {}).some(filter => changed.has(filter))) ||
        (source?.compute ?? []).some(op => op.op === 'selectField' ? changed.has(op.filter)
          : op.op === 'timeFill' && 'filter' in op.range && changed.has(op.range.filter));
    });
    const localSearchAffected = component.props.pagination?.mode !== 'query' &&
      (page.filters ?? []).some(filter => filter.type === 'search' && changed.has(filter.id));
    if (queryAffected || localSearchAffected) result[component.id] = { ...view, pageIndex: 0 };
  }
  return result;
}

/** 按原始值排序，缺失和非有限数在升降序下都排尾；相同值保持输入顺序。 */
export function sortTableRows(rows: readonly Row[], rules: TableViewState['sort']): Row[] {
  const missing = (value: unknown) => value == null || (typeof value === 'number' && !Number.isFinite(value));
  return [...rows].sort((left, right) => {
    for (const rule of rules) {
      const a = left[rule.field];
      const b = right[rule.field];
      if (missing(a) || missing(b)) {
        if (missing(a) !== missing(b)) return missing(a) ? 1 : -1;
        continue;
      }
      const comparison = a! < b! ? -1 : a! > b! ? 1 : 0;
      if (comparison !== 0) return rule.direction === 'desc' ? -comparison : comparison;
    }
    return 0;
  });
}
