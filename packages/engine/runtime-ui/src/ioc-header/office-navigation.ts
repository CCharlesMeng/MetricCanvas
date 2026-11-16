import { canonicalizeJson, iocHeaderDeclaration, iocOfficeNavigation, readLevelURLSelection, type NavigationTarget, type Page } from '@metriccanvas/page/internal';
import type { FilterValue } from '../../../runtime/src/filter-state';

export function officeNavigationTarget(page: Page, region: FilterValue | undefined): NavigationTarget | undefined {
  if (region?.type !== 'dimension' || region.level !== 'office' || region.values.length !== 1) return;
  const target = iocOfficeNavigation(iocHeaderDeclaration(page));
  if (!target) return;
  return { ...target, query: { ...target.query, 'rep-office': { source: 'filter', id: 'region' } } };
}

export function isOfficeNavigationFeedback(source: unknown, incoming: unknown, search: string, office: string): boolean {
  const region = readLevelURLSelection(
    { 'node/region-dept': 'region-dept', 'node/office': 'rep-office' },
    new URLSearchParams(search)
  );
  if (region?.level !== 'office' || region.value !== office) return false;
  if (incoming === source) return true;
  try {
    return canonicalizeJson(incoming) === canonicalizeJson(source);
  } catch {
    return false;
  }
}

export function sameNavigationAddress(href: string, current: string, base: string): boolean {
  const destination = new URL(href, base);
  const source = new URL(current);
  destination.searchParams.sort();
  source.searchParams.sort();
  return destination.href === source.href;
}
