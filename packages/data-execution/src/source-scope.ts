import type { Page } from '@metriccanvas/page';
import { computeDependencies, flattenPageComponents, queryResultDependencies } from '@metriccanvas/page/internal';

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
  const delayed = dependencies(page, referencedSources({
    sections: [], detailViews: page.detailViews?.filter(view => view.mode === 'query')
  }));
  return Object.entries(page.dataSources).flatMap(([id, source]) =>
    source.source.type === 'query' && (!delayed.has(id) || live.has(id)) ? [id] : []);
}
