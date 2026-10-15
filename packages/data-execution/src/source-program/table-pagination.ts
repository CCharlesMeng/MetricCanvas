import type { Page } from '@metriccanvas/page';
import {
  computeDependencies, declaredPaginationLimit, flattenPageComponents, isFirstQueryWindow,
  queryResultDependencies, type DataSnapshot, type QueryDataSource
} from '@metriccanvas/page/internal';

/** Query windows may change only sources owned by one live table. */
export function automaticQueryTableSources(page: Page): Set<string> {
  const components = flattenPageComponents({ sections: page.sections,
    detailViews: page.detailViews?.filter(view => view.mode === 'snapshot') });
  const liveComponents = flattenPageComponents({ sections: page.sections });
  const references = new Map<string, number>();
  const reference = (id: string) => references.set(id, (references.get(id) ?? 0) + 1);
  for (const component of components) {
    Object.values(component.data ?? {}).forEach(reference);
    if (component.type === 'aiSummary') {
      Object.values(component.props.relatedData).forEach(value => reference(value.source));
    }
  }
  for (const source of Object.values(page.dataSources)) {
    [...computeDependencies(source.compute ?? []), ...queryResultDependencies(source)].forEach(reference);
  }
  return new Set(liveComponents.flatMap(component => {
    if (component.type !== 'table' || component.props.pagination !== undefined) return [];
    const id = component.data.main;
    const source = page.dataSources[id];
    if (references.get(id) !== 1 || source?.source.type !== 'query' ||
      source.compute?.length || source.source.resultScope === 'complete') return [];
    if (!isFirstQueryWindow(source.source.query)) return [];
    return [id];
  }));
}

/** Infer once from an actual first window; later short pages cannot resize it. */
export function automaticQueryPageSize(source: QueryDataSource, snapshot: DataSnapshot | undefined): number | undefined {
  if (snapshot?.status !== 'ready' || snapshot.rows.length === 0 ||
    snapshot.totalCount === undefined || !Number.isSafeInteger(snapshot.totalCount) ||
    snapshot.totalCount <= snapshot.rows.length) return undefined;
  const declared = declaredPaginationLimit(source.source.query);
  // Preserve explicit query windows. An incomplete declared first page is not
  // enough evidence to derive a different offset progression.
  if (declared !== undefined && snapshot.rows.length !== declared) return undefined;
  return declared ?? snapshot.rows.length;
}
