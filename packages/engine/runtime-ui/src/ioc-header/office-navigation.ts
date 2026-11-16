import { canonicalizeJson, iocHeaderDeclaration, iocOfficeNavigation, readLevelURLSelection, type NavigationTarget, type Page } from '@metriccanvas/page/internal';
import type { FilterValue } from '../../../runtime/src/filter-state';

export function officeNavigationTarget(page: Page, region: FilterValue | undefined): NavigationTarget | undefined {
  if (region?.type !== 'dimension' || region.level !== 'office' || region.values.length !== 1) return;
  const target = iocOfficeNavigation(iocHeaderDeclaration(page));
  if (!target) return;
  return { ...target, query: { ...target.query, 'rep-office': { source: 'filter', id: 'region' } } };
}

export interface OfficeNavigationInput {
  value: string;
  forwardedKeys: string[];
}

export function officeNavigationInput(target: NavigationTarget, value: string): OfficeNavigationInput {
  const forwardedKeys = Object.entries(target.query ?? {})
    .filter(([, binding]) => binding.source === 'filter' && binding.id === 'region' && (binding.part ?? 'value') === 'value')
    .map(([key]) => key);
  return { value, forwardedKeys };
}

function matchesOfficeInput(query: URLSearchParams, office: OfficeNavigationInput): boolean {
  const region = readLevelURLSelection(
    { 'node/region-dept': 'region-dept', 'node/office': 'rep-office' },
    query
  );
  if (region) return region.level === 'office' && region.value === office.value;

  const legacyLevel = query.get('region.level');
  if (legacyLevel !== null && legacyLevel !== 'office') return false;
  const keys = query.has('region') ? ['region'] : office.forwardedKeys;
  return keys.some(key => {
    const values = query.getAll(key);
    return values.length === 1 && values[0] === office.value;
  });
}

export function isOfficeNavigationFeedback(source: unknown, incoming: unknown, search: string, office: OfficeNavigationInput): boolean {
  if (!matchesOfficeInput(new URLSearchParams(search), office)) return false;
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
