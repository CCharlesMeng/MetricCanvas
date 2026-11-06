import { filterURLKeys, usesIocRegion, walkPageComponents, type Page } from '@metriccanvas/page/internal';
import type { RuntimeNavigation } from './types';

/** Keep declared inputs verbatim: validation, including invalid values, belongs to initialization. */
export function pageURLSearch(page: Page, search: string, preserve: readonly string[] = []): string {
  const keys = new Set(preserve);
  for (const parameter of page.params ?? []) keys.add(parameter.id);
  for (const filter of page.filters ?? []) {
    for (const key of Object.values(filterURLKeys(filter, usesIocRegion(page)))) keys.add(key);
  }
  walkPageComponents(page, component => {
    if (component.type !== 'tabContainer') return;
    keys.add(`tab.${component.id}`);
    if (component.props.initialTabUrlParam) keys.add(component.props.initialTabUrlParam);
  });
  const query = new URLSearchParams(search);
  for (const key of new Set(query.keys())) if (!keys.has(key)) query.delete(key);
  return query.toString();
}

/** Address synchronization must not interrupt an initialized page or its queries. */
export function replaceRuntimeSearch(navigation: RuntimeNavigation | undefined, search: string): void {
  try {
    const result = navigation?.replaceSearch?.(search);
    void Promise.resolve(result).catch(reportSearchError);
  } catch (error) {
    reportSearchError(error);
  }
}

function reportSearchError(error: unknown): void {
  console.warn('MetricCanvas URL synchronization failed', error);
}

export function initializeURLSearch(page: Page, search: string, navigation?: RuntimeNavigation): string {
  const cleaned = pageURLSearch(page, search, navigation?.preserveSearchParams);
  if (cleaned !== new URLSearchParams(search).toString()) replaceRuntimeSearch(navigation, cleaned);
  return cleaned;
}
