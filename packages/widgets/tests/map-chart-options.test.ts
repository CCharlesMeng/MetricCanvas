import { describe, expect, it } from 'vitest';
import type { MainDataSlots } from '../src/shared/component-data';
import { geoRegionName, mapOption } from '../src/components/map-chart/options';

const data: MainDataSlots = {
  main: {
    snapshot: {
      status: 'ready',
      rows: [{ region: '上海', rate: 4.24 }]
    },
    fields: {
      region: { type: 'string', role: 'dimension', label: '区域' },
      rate: {
        type: 'number',
        role: 'measure',
        label: '增长率',
        defaultFormat: 'percent-1'
      }
    }
  }
};

describe('mapOption', () => {
  it('地图 tooltip 使用组件字段绑定的最终格式', () => {
    const option = mapOption(
      data,
      {
        map: 'china',
        nameField: 'region',
        valueField: {
          data: 'main',
          field: 'rate',
          format: 'percent-2-signed'
        }
      },
      new Map([['上海', [121.47, 31.23]]])
    ) as unknown as {
      tooltip: { valueFormatter: (value: unknown) => string };
    };

    expect(option.tooltip.valueFormatter([121.47, 31.23, 4.24])).toBe('+4.24%');
  });

  it('非数值的指标不污染 visualMap 的取值区间', () => {
    const option = mapOption(
      {
        main: {
          snapshot: {
            status: 'ready',
            rows: [
              { region: '上海', rate: 10 },
              { region: '北京', rate: '暂无' }
            ]
          },
          fields: data.main.fields
        }
      },
      { map: 'china', nameField: 'region', valueField: 'rate' },
      new Map()
    ) as unknown as { visualMap: { min: number; max: number } };

    expect(option.visualMap.min).toBe(0);
    expect(option.visualMap.max).toBe(10);
  });

  it('空数据使用有限的默认色阶区间', () => {
    const option = mapOption(
      {
        main: {
          snapshot: { status: 'ready', rows: [] },
          fields: data.main.fields
        }
      },
      { map: 'china', nameField: 'region', valueField: 'rate' },
      new Map()
    ) as unknown as { visualMap: { min: number; max: number } };

    expect(option.visualMap).toMatchObject({ min: 0, max: 1 });
  });
});

describe('geoRegionName', () => {
  it('维度值经 nameMap 改名后定位底图区域,未声明时原样返回', () => {
    expect(geoRegionName({ region: '沪' }, 'region', { 沪: '上海' })).toBe('上海');
    expect(geoRegionName({ region: '上海' }, 'region')).toBe('上海');
    expect(geoRegionName({ region: null }, 'region')).toBe('');
  });
});
