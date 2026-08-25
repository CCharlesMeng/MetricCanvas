import { describe, expect, it } from 'vitest';
import type { FilterDeclaration } from '@metriccanvas/page';
import {
  currentHierarchyLevelId,
  filterMapRows,
  resolveMapBasemap,
  resolveMapClick
} from '../src/map-hierarchy';

const region: FilterDeclaration & {
  type: 'dimension';
  hierarchy: NonNullable<Extract<FilterDeclaration, { type: 'dimension' }>['hierarchy']>;
} = {
  id: 'region',
  type: 'dimension',
  dimension: 'geo-pc-code',
  hierarchy: [
    { id: 'geo', dimension: 'geo-pc-code', label: '全球' },
    { id: 'region-dept', dimension: 'region-dept-code', label: '地区部' },
    { id: 'office', dimension: 'rep-office-code', label: '代表处' }
  ],
  defaultLevel: 'geo'
};

const rows = [
  { 'map-level': 'geo', 'region-name': 'China', 'region-code': 'CN', 'parent-code': '' },
  { 'map-level': 'geo', 'region-name': 'Japan', 'region-code': 'JP', 'parent-code': '' },
  {
    'map-level': 'region-dept',
    'region-name': '北京',
    'region-code': 'BJ-01',
    'parent-code': 'CN'
  },
  {
    'map-level': 'office',
    'region-name': '北京',
    'region-code': 'BJ-01',
    'parent-code': 'BJ-01'
  }
];

const props = {
  nameField: 'region-name',
  codeField: 'region-code',
  levelField: 'map-level',
  parentField: 'parent-code',
  map: 'world' as const,
  levelMaps: { geo: 'world' as const, 'region-dept': 'china' as const, office: 'china' as const }
};

describe('地图层级下钻', () => {
  it('缺省停在第一级,底图按 levelMaps 切换', () => {
    expect(currentHierarchyLevelId(region, undefined)).toBe('geo');
    expect(resolveMapBasemap(props, region, undefined)).toBe('world');
    expect(
      resolveMapBasemap(props, region, {
        type: 'dimension',
        dimension: 'region-dept-code',
        values: ['CN'],
        level: 'region-dept'
      })
    ).toBe('china');
  });

  it('按当前层级与父级取值收窄行', () => {
    expect(
      filterMapRows(rows, props, region, undefined).map((row) => row['region-code'])
    ).toEqual(['CN', 'JP']);
    expect(
      filterMapRows(rows, props, region, {
        type: 'dimension',
        dimension: 'region-dept-code',
        values: ['CN'],
        level: 'region-dept'
      }).map((row) => row['region-code'])
    ).toEqual(['BJ-01']);
  });

  it('中间级点击产出下一层筛选值,最深一级转为跨页导航', () => {
    expect(
      resolveMapClick(props, region, undefined, rows[0]!)
    ).toEqual({
      kind: 'drill',
      filterId: 'region',
      value: {
        type: 'dimension',
        dimension: 'region-dept-code',
        values: ['CN'],
        level: 'region-dept'
      }
    });
    expect(
      resolveMapClick(
        props,
        region,
        {
          type: 'dimension',
          dimension: 'rep-office-code',
          values: ['BJ-01'],
          level: 'office'
        },
        rows[3]!
      )
    ).toEqual({ kind: 'navigate' });
  });
});
