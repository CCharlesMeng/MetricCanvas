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

describe('mapOption · 形态分档色', () => {
  const props = { map: 'china' as const, nameField: 'region', valueField: 'rate' };
  const scale = ['#7184e7', '#acb9f0', '#d9dff6', 'rgba(0, 0, 0, 0.05)'];

  it('分档色缺席时是连续渐变,取值与改动前逐字相同', () => {
    const option = mapOption(data, props, new Map()) as unknown as {
      visualMap: { type: string; itemHeight?: number; inRange: { color: string[] } };
    };

    expect(option.visualMap.type).toBe('continuous');
    expect(option.visualMap.itemHeight).toBe(80);
    expect(option.visualMap.inRange.color).toEqual(['#dbeafe', '#2563eb']);
  });

  it('分档色给出时换成分档,档数取色列长度', () => {
    const option = mapOption(data, props, new Map(), undefined, false, scale) as unknown as {
      visualMap: { type: string; splitNumber: number };
    };

    expect(option.visualMap.type).toBe('piecewise');
    expect(option.visualMap.splitNumber).toBe(4);
  });

  it('色列从高档到低档,而 inRange 从低到高,所以要翻过来', () => {
    const option = mapOption(data, props, new Map(), undefined, false, scale) as unknown as {
      visualMap: { inRange: { color: string[] } };
    };

    expect(option.visualMap.inRange.color).toEqual([
      'rgba(0, 0, 0, 0.05)',
      '#d9dff6',
      '#acb9f0',
      '#7184e7'
    ]);
  });

  it('翻转不改写传入的色列', () => {
    const input = [...scale];
    mapOption(data, props, new Map(), undefined, false, input);

    expect(input).toEqual(scale);
  });
});

describe('geoRegionName', () => {
  it('维度值经 nameMap 改名后定位底图区域,未声明时原样返回', () => {
    expect(geoRegionName({ region: '沪' }, 'region', { 沪: '上海' })).toBe('上海');
    expect(geoRegionName({ region: '上海' }, 'region')).toBe('上海');
    expect(geoRegionName({ region: null }, 'region')).toBe('');
  });
});

/** 8 个地区部 → world 底图区域名(占位锚点,真实口径见 ioc-legacy-handoff.md) */
const REGION_DEPTS = [
  ['欧洲', 'Germany'],
  ['亚太', 'Indonesia'],
  ['北部非洲', 'Egypt'],
  ['中东中亚', 'Saudi Arabia'],
  ['中国', 'China'],
  ['拉美', 'Brazil'],
  ['南部非洲', 'South Africa'],
  ['俄罗斯', 'Russia']
] as const;

const regionDeptData: MainDataSlots = {
  main: {
    snapshot: {
      status: 'ready',
      rows: REGION_DEPTS.map(([dept], index) => ({
        'region-name': dept,
        'support-rate': 40 + index
      }))
    },
    fields: {
      'region-name': { type: 'string', role: 'dimension', label: '地区部' },
      'support-rate': {
        type: 'number',
        role: 'measure',
        label: '管道支撑率',
        defaultFormat: 'percent-1'
      }
    }
  }
};

const regionDeptProps = {
  map: 'world' as const,
  nameField: 'region-name',
  valueField: 'support-rate',
  scatter: 'point' as const,
  nameMap: Object.fromEntries(REGION_DEPTS)
};

const worldCenters = new Map<string, [number, number]>([
  ['Germany', [9.68, 50.96]],
  ['Indonesia', [101.89, -0.95]],
  ['Egypt', [29.45, 26.19]],
  ['Saudi Arabia', [44.7, 23.81]],
  ['China', [106.34, 32.5]],
  ['Brazil', [-49.56, -12.1]],
  ['South Africa', [23.67, -29.71]],
  ['Russia', [44.69, 58.25]]
]);

interface ScatterSeries {
  type: string;
  data: { name: string; value: number[] }[];
  label?: { show?: boolean };
}

function scatterSeries(option: unknown): ScatterSeries {
  const { series } = option as { series: ScatterSeries[] };
  const found = series.find((item) => item.type === 'scatter' || item.type === 'effectScatter');
  if (!found) throw new Error('option 里没有散点系列');
  return found;
}

describe('mapOption · 地区部散点(AT-IOC-S1-004)', () => {
  it('8 行地区部经 nameMap 全部拿到中心点,散点名是中文原值', () => {
    const scatter = scatterSeries(
      mapOption(regionDeptData, regionDeptProps, worldCenters)
    );

    expect(scatter.data).toHaveLength(8);
    expect(scatter.data.map((point) => point.name)).toEqual(
      REGION_DEPTS.map(([dept]) => dept)
    );
    // 坐标仍取映射后底图区域的中心点
    expect(scatter.data[0]?.value.slice(0, 2)).toEqual([9.68, 50.96]);
  });

  it('nameMap 无命中的行不产散点,数量差异可被数出来', () => {
    const scatter = scatterSeries(
      mapOption(
        {
          main: {
            snapshot: {
              status: 'ready',
              rows: [
                { 'region-name': '中国', 'support-rate': 1 },
                { 'region-name': '未知地区部', 'support-rate': 2 }
              ]
            },
            fields: regionDeptData.main.fields
          }
        },
        regionDeptProps,
        worldCenters
      )
    );

    expect(scatter.data).toHaveLength(1);
    expect(scatter.data[0]?.name).toBe('中国');
  });
});

describe('mapOption · 散点文字标签开关(AT-IOC-S1-008a)', () => {
  // 双向断言:单向写法会恒绿——改动前散点系列完全没有 label 配置,
  // 「紧凑档不含标签」在改动前就已成立(dev-baseline.md 的 F1-4)。
  it('桌面档散点带文字标签', () => {
    const scatter = scatterSeries(
      mapOption(regionDeptData, regionDeptProps, worldCenters, undefined, false)
    );

    expect(scatter.label?.show).toBe(true);
  });

  it('紧凑档散点不带文字标签', () => {
    const scatter = scatterSeries(
      mapOption(regionDeptData, regionDeptProps, worldCenters, undefined, true)
    );

    expect(scatter.label?.show).toBe(false);
  });

  it('不给档位入参时按桌面档处理', () => {
    const scatter = scatterSeries(mapOption(regionDeptData, regionDeptProps, worldCenters));

    expect(scatter.label?.show).toBe(true);
  });
});

describe('mapOption · 投影到安全区(AT-IOC-S1-002)', () => {
  it('给 safeArea 时 geo 产出 layoutCenter 与 layoutSize', () => {
    const option = mapOption(regionDeptData, regionDeptProps, worldCenters, {
      x: 100,
      y: 50,
      width: 800,
      height: 400
    }) as unknown as {
      geo: { layoutCenter?: [string, string]; layoutSize?: number };
    };

    // 中心 = 矩形中心;尺寸取短边,保证地图内容整体落在矩形内
    expect(option.geo.layoutCenter).toEqual(['500px', '250px']);
    expect(option.geo.layoutSize).toBe(400);
  });

  it('safeArea 缺席时不产出投影字段,退回全容器渲染', () => {
    const option = mapOption(regionDeptData, regionDeptProps, worldCenters) as unknown as {
      geo: Record<string, unknown>;
    };

    expect(option.geo).not.toHaveProperty('layoutCenter');
    expect(option.geo).not.toHaveProperty('layoutSize');
  });

  it('safeArea 宽或高非正时视为无解,同样退回全容器', () => {
    const option = mapOption(regionDeptData, regionDeptProps, worldCenters, {
      x: 10,
      y: 10,
      width: 0,
      height: 400
    }) as unknown as { geo: Record<string, unknown> };

    expect(option.geo).not.toHaveProperty('layoutCenter');
    expect(option.geo).not.toHaveProperty('layoutSize');
  });
});
