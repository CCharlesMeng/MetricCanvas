import {
  canonicalizeJson,
  IOC_OFFICE_URL_PARAM,
  IOC_REGION_FILTER_ID,
  IOC_REGION_LEGACY_LEVEL_PARAM,
  IOC_REGION_LEVEL_URL_KEYS,
  iocHeaderDeclaration,
  iocOfficeNavigation,
  isIocOfficeLevel,
  isIocRegionFilterId,
  type NavigationTarget,
  type Page,
  readLevelURLSelection,
} from '@metriccanvas/page/internal';
import type { FilterValue } from '../../../runtime/src';

export function officeNavigationTarget(
  page: Page,
  region: FilterValue | undefined,
): NavigationTarget | undefined {
  if (region?.type !== 'dimension' || !isIocOfficeLevel(region.level) || region.values.length !== 1)
    return;
  const target = iocOfficeNavigation(iocHeaderDeclaration(page));
  if (!target) return;
  return {
    ...target,
    query: {
      ...target.query,
      [IOC_OFFICE_URL_PARAM]: { source: 'filter', id: IOC_REGION_FILTER_ID },
    },
  };
}

export interface OfficeNavigationInput {
  value: string;
  forwardedKeys: string[];
}

export function officeNavigationInput(
  target: NavigationTarget,
  value: string,
): OfficeNavigationInput {
  const forwardedKeys = Object.entries(target.query ?? {})
    .filter(
      ([, binding]) =>
        binding.source === 'filter' &&
        isIocRegionFilterId(binding.id) &&
        (binding.part ?? 'value') === 'value',
    )
    .map(([key]) => key);
  return { value, forwardedKeys };
}

function matchesOfficeInput(query: URLSearchParams, office: OfficeNavigationInput): boolean {
  const region = readLevelURLSelection(IOC_REGION_LEVEL_URL_KEYS, query);
  if (region) return isIocOfficeLevel(region.level) && region.value === office.value;

  const legacyLevel = query.get(IOC_REGION_LEGACY_LEVEL_PARAM);
  if (legacyLevel !== null && !isIocOfficeLevel(legacyLevel)) return false;
  const keys = query.has(IOC_REGION_FILTER_ID) ? [IOC_REGION_FILTER_ID] : office.forwardedKeys;
  return keys.some((key) => {
    const values = query.getAll(key);
    return values.length === 1 && values[0] === office.value;
  });
}

export function isOfficeNavigationFeedback(
  source: unknown,
  incoming: unknown,
  search: string,
  office: OfficeNavigationInput,
): boolean {
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
