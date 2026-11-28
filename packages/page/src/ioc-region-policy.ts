import type { DimensionFilterDeclaration } from './filter';
import { iocHeaderDeclaration } from './header-binding';
import type { Page } from './page';

export const IOC_REGION_FILTER_ID = 'region' as const;
export const IOC_GLOBAL_REGION_VALUE = '全球' as const;
export const IOC_REGION_LEVELS = {
  regionDept: 'region-dept',
  office: 'office',
} as const;
export type IocOrganizationLevel = (typeof IOC_REGION_LEVELS)[keyof typeof IOC_REGION_LEVELS];
export const IOC_OFFICE_URL_PARAM = 'rep-office' as const;
export const IOC_REGION_DEPT_URL_PARAM = 'region-dept' as const;
export const IOC_REGION_LEGACY_LEVEL_PARAM = 'region.level' as const;
export const IOC_REGION_LEVEL_URL_KEYS = {
  'node/region-dept': IOC_REGION_DEPT_URL_PARAM,
  'node/office': IOC_OFFICE_URL_PARAM,
} as const;
export const IOC_OPERATION_MAP_REGION_DIMENSIONS: ReadonlySet<string> = new Set([
  'geo-pc-code',
  'region-dept-code',
  'rep-office-code',
]);
export const IOC_KEY_OFFICE_DIMENSION = 'rep-office-name' as const;

export function isIocRegionFilterId(filterId: string | undefined): boolean {
  return filterId === IOC_REGION_FILTER_ID;
}

export function isIocOrganizationLevel(level: string | undefined): level is IocOrganizationLevel {
  return level === IOC_REGION_LEVELS.regionDept || level === IOC_REGION_LEVELS.office;
}

export function isIocOfficeLevel(level: string | undefined): boolean {
  return level === IOC_REGION_LEVELS.office;
}

export function isIocRegionDeptLevel(level: string | undefined): boolean {
  return level === IOC_REGION_LEVELS.regionDept;
}

export function isIocGlobalRegionValue(value: string | undefined): boolean {
  return value === IOC_GLOBAL_REGION_VALUE;
}

export function hasIocRegionHeaderFilter(page: Page | undefined): boolean {
  return (
    page !== undefined &&
    iocHeaderDeclaration(page)?.filterIds?.includes(IOC_REGION_FILTER_ID) === true
  );
}

export function findIocRegionFilter(
  page: Page | undefined,
): DimensionFilterDeclaration | undefined {
  return page?.filters?.find(
    (filter): filter is DimensionFilterDeclaration =>
      isIocRegionFilterId(filter.id) && filter.type === 'dimension',
  );
}

/** IOC global selection is presentation state; it never narrows an execution scope. */
export function isUnrestrictedIocRegion(
  page: Page | undefined,
  filterId: string,
  value: { type: string; values?: readonly string[] } | undefined,
): boolean {
  if (
    !page ||
    !isIocRegionFilterId(filterId) ||
    value?.type !== 'dimension' ||
    value.values?.length !== 1 ||
    !isIocGlobalRegionValue(value.values[0])
  ) {
    return false;
  }
  return hasIocRegionHeaderFilter(page);
}

export function isIocRegionMapHierarchyFilter(hierarchyFilter: string | undefined): boolean {
  return isIocRegionFilterId(hierarchyFilter);
}

export function isIocOperationMapRegionRequest(filterId: string, dimension: string): boolean {
  return isIocRegionFilterId(filterId) && IOC_OPERATION_MAP_REGION_DIMENSIONS.has(dimension);
}
