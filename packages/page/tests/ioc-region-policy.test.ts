import { describe, expect, it } from 'vitest';
import { isUnrestrictedIocRegion as isUnrestrictedFromOverrides } from '../src/filter-overrides';
import {
  findIocRegionFilter,
  hasIocRegionHeaderFilter,
  IOC_GLOBAL_REGION_VALUE,
  IOC_KEY_OFFICE_DIMENSION,
  IOC_OFFICE_URL_PARAM,
  IOC_OPERATION_MAP_REGION_DIMENSIONS,
  IOC_REGION_DEPT_URL_PARAM,
  IOC_REGION_FILTER_ID,
  IOC_REGION_LEGACY_LEVEL_PARAM,
  IOC_REGION_LEVEL_URL_KEYS,
  IOC_REGION_LEVELS,
  isIocGlobalRegionValue,
  isIocOfficeLevel,
  isIocOperationMapRegionRequest,
  isIocOrganizationLevel,
  isIocRegionDeptLevel,
  isIocRegionFilterId,
  isIocRegionMapHierarchyFilter,
  isUnrestrictedIocRegion,
  type Page,
} from '../src/internal';

function makePage(overrides: Partial<Page> = {}): Page {
  return {
    schemaVersion: '6.85',
    id: 'ioc-policy-test',
    title: 'IOC Policy Test',
    layout: 'dashboard',
    dataSources: {},
    sections: [],
    ...overrides,
  } as Page;
}

describe('ioc-region-policy', () => {
  it('exposes canonical IOC region constants and URL keys', () => {
    expect(IOC_REGION_FILTER_ID).toBe('region');
    expect(IOC_GLOBAL_REGION_VALUE).toBe('全球');
    expect(IOC_REGION_LEVELS).toEqual({ regionDept: 'region-dept', office: 'office' });
    expect(IOC_OFFICE_URL_PARAM).toBe('rep-office');
    expect(IOC_REGION_DEPT_URL_PARAM).toBe('region-dept');
    expect(IOC_REGION_LEGACY_LEVEL_PARAM).toBe('region.level');
    expect(IOC_REGION_LEVEL_URL_KEYS).toEqual({
      'node/region-dept': 'region-dept',
      'node/office': 'rep-office',
    });
    expect([...IOC_OPERATION_MAP_REGION_DIMENSIONS]).toEqual([
      'geo-pc-code',
      'region-dept-code',
      'rep-office-code',
    ]);
    expect(IOC_KEY_OFFICE_DIMENSION).toBe('rep-office-name');
  });

  it('identifies region filter IDs, hierarchy filters, and global values', () => {
    expect(isIocRegionFilterId('region')).toBe(true);
    expect(isIocRegionFilterId('country')).toBe(false);
    expect(isIocRegionFilterId(undefined)).toBe(false);

    expect(isIocRegionMapHierarchyFilter('region')).toBe(true);
    expect(isIocRegionMapHierarchyFilter('area')).toBe(false);
    expect(isIocRegionMapHierarchyFilter(undefined)).toBe(false);

    expect(isIocGlobalRegionValue('全球')).toBe(true);
    expect(isIocGlobalRegionValue('华东')).toBe(false);
    expect(isIocGlobalRegionValue(undefined)).toBe(false);
  });

  it('classifies IOC organization levels accurately', () => {
    expect(isIocOrganizationLevel('region-dept')).toBe(true);
    expect(isIocOrganizationLevel('office')).toBe(true);
    expect(isIocOrganizationLevel('geo')).toBe(false);
    expect(isIocOrganizationLevel(undefined)).toBe(false);

    expect(isIocOfficeLevel('office')).toBe(true);
    expect(isIocOfficeLevel('region-dept')).toBe(false);
    expect(isIocOfficeLevel(undefined)).toBe(false);

    expect(isIocRegionDeptLevel('region-dept')).toBe(true);
    expect(isIocRegionDeptLevel('office')).toBe(false);
    expect(isIocRegionDeptLevel(undefined)).toBe(false);
  });

  it('matches Operation Map region candidate requests only for region + known dimensions', () => {
    expect(isIocOperationMapRegionRequest('region', 'geo-pc-code')).toBe(true);
    expect(isIocOperationMapRegionRequest('region', 'region-dept-code')).toBe(true);
    expect(isIocOperationMapRegionRequest('region', 'rep-office-code')).toBe(true);
    expect(isIocOperationMapRegionRequest('region', 'rep-office-name')).toBe(false);
    expect(isIocOperationMapRegionRequest('other', 'geo-pc-code')).toBe(false);
  });

  it('detects IOC header region ownership and finds the region dimension filter', () => {
    const regionFilter = {
      id: 'region',
      type: 'dimension' as const,
      dimension: 'geo-pc-code',
    };
    const withRootHeader = makePage({
      iocHeader: { filterIds: ['region', 'period'] },
      filters: [regionFilter],
    });
    const withComponentHeader = makePage({
      sections: [
        {
          id: 's0',
          components: [
            {
              id: 'hdr',
              type: 'iocHeader',
              props: { components: [{ type: 'regionFilter', props: {} }] },
            },
          ],
        },
      ] as unknown as Page['sections'],
      filters: [regionFilter],
    });
    const withoutRegionClaim = makePage({
      iocHeader: { filterIds: ['period'] },
      filters: [regionFilter],
    });
    const nonDimensionRegion = makePage({
      iocHeader: { filterIds: ['region'] },
      filters: [{ id: 'region', type: 'boolean', label: 'region' }],
    });

    expect(hasIocRegionHeaderFilter(undefined)).toBe(false);
    expect(hasIocRegionHeaderFilter(withRootHeader)).toBe(true);
    expect(hasIocRegionHeaderFilter(withComponentHeader)).toBe(true);
    expect(hasIocRegionHeaderFilter(withoutRegionClaim)).toBe(false);

    expect(findIocRegionFilter(undefined)).toBeUndefined();
    expect(findIocRegionFilter(withRootHeader)).toBe(regionFilter);
    expect(findIocRegionFilter(nonDimensionRegion)).toBeUndefined();
  });

  it('recognizes unrestricted global IOC region selection and keeps filter-overrides re-export', () => {
    expect(isUnrestrictedFromOverrides).toBe(isUnrestrictedIocRegion);

    const iocPage = makePage({
      iocHeader: { filterIds: ['region'] },
    });
    const ordinaryPage = makePage();

    expect(
      isUnrestrictedIocRegion(iocPage, 'region', { type: 'dimension', values: ['全球'] }),
    ).toBe(true);
    expect(
      isUnrestrictedIocRegion(ordinaryPage, 'region', { type: 'dimension', values: ['全球'] }),
    ).toBe(false);
    expect(
      isUnrestrictedIocRegion(iocPage, 'country', { type: 'dimension', values: ['全球'] }),
    ).toBe(false);
    expect(
      isUnrestrictedIocRegion(iocPage, 'region', { type: 'dimension', values: ['中国'] }),
    ).toBe(false);
    expect(
      isUnrestrictedIocRegion(iocPage, 'region', { type: 'dimension', values: ['全球', '中国'] }),
    ).toBe(false);
    expect(isUnrestrictedIocRegion(iocPage, 'region', { type: 'boolean', values: ['全球'] })).toBe(
      false,
    );
    expect(
      isUnrestrictedIocRegion(undefined, 'region', { type: 'dimension', values: ['全球'] }),
    ).toBe(false);
  });
});
