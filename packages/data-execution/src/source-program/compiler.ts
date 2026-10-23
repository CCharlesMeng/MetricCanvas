import { aiSummaryRelatedData, activePageComponents, type TabSelections, declaredPaginationLimit, flattenPageComponents, resultSourceIds, type Page, type DataSource } from '@metriccanvas/page/internal';
import { automaticQueryTableSources } from './table-pagination';

export function compileSources(page: Page) {
  const sources = new Map<string, DataSource>(Object.entries(page.dataSources));
  const limits = new Map<string, number>();
  for (const component of flattenPageComponents({ sections: page.sections, detailViews: page.detailViews?.filter(v => v.mode === 'snapshot') })) {
    if (component.type !== 'table' || component.props.pagination?.mode !== 'query') continue;
    const source = sources.get(component.data.main);
    const limit = source?.source.type === 'pagedJoin' ? source.source.pagination.pageSize : source?.source.type === 'query' ? declaredPaginationLimit(source.source.query) : undefined;
    if (limit !== undefined) limits.set(component.data.main, limit);
  }
  return { sources, limits, automatic: automaticQueryTableSources(page) };
}
export function executionSourceIds(page: Page, roots: Iterable<string>): Set<string> {
  const ids = new Set(roots);
  for (const id of ids) resultSourceIds(page.dataSources[id]).forEach(dependency => ids.add(dependency));
  return ids;
}
export function visibleSourceIds(page: Page): Set<string> {
  const ids = new Set<string>();
  for (const component of flattenPageComponents({ sections: page.sections, detailViews: page.detailViews?.filter(v => v.mode === 'snapshot') })) {
    Object.values(component.data ?? {}).forEach(id => ids.add(id));
    if (component.type === 'aiSummary') Object.values(aiSummaryRelatedData(page, component.props, {}, component.id)).forEach(value => ids.add(value.source));
  }
  return executionSourceIds(page, ids);
}

export function activeSourceIds(page: Page, selections: TabSelections = {}): Set<string> {
  const ids = new Set<string>();
  for (const component of activePageComponents(page, selections)) {
    Object.values(component.data ?? {}).forEach(id => ids.add(id));
    if (component.type === 'aiSummary') Object.values(aiSummaryRelatedData(page, component.props, selections, component.id)).forEach(value => ids.add(value.source));
  }
  return executionSourceIds(page, ids);
}
