import { activePageComponents } from '@metriccanvas/page/internal';
import type { Page } from '@metriccanvas/page';
import { rowExpansionQuerySources, computeDependencies, definitionSourceIds, flattenPageComponents, queryResultDependencies } from '@metriccanvas/page/internal';

function referencedSources(page: Pick<Page, 'sections' | 'detailViews'>): Set<string> {
  const ids = new Set<string>();
  for (const component of flattenPageComponents(page)) {
    Object.values(component.data ?? {}).forEach(id => ids.add(id));
    if (component.type === 'aiSummary') {
      Object.values(component.props.relatedData).forEach(value => ids.add(value.source));
    }
  }
  return ids;
}

function dependencies(page: Page, ids: Set<string>): Set<string> {
  for (const id of ids) {
    const source = page.dataSources[id];
    for (const dependency of [
      ...queryResultDependencies(source), ...computeDependencies(source?.compute ?? [])
    ]) ids.add(dependency);
  }
  return ids;
}

/** All declared sources except sources used exclusively by click-time query views. */
export function initialQuerySourceIds(page: Page): string[] {
  const live = dependencies(page, referencedSources({
    sections: page.sections,
    detailViews: page.detailViews?.filter(view => view.mode === 'snapshot')
  }));
  const allLive = new Set(live);
  const active = dependencies(page, new Set(activePageComponents(page).flatMap(component => [...Object.values(component.data ?? {}), ...(component.type === 'aiSummary' ? Object.values(component.props.relatedData).map(data => data.source) : [])])));
  const delayed = dependencies(page, referencedSources({
    sections: [], detailViews: page.detailViews?.filter(view => view.mode === 'query')
  }));
  for (const id of rowExpansionQuerySources(page)) delayed.add(id);
  const members = new Set(Object.values(page.dataSources).flatMap(definitionSourceIds));
  return Object.entries(page.dataSources).flatMap(([id, source]) =>
    source.source.type !== 'inline' && (!allLive.has(id) || active.has(id)) && (!delayed.has(id) || live.has(id)) && (!members.has(id) || live.has(id)) ? [id] : []);
}
