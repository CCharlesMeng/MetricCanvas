import { describe, expect, it } from 'vitest';
import type { MapChartProps } from '@metriccanvas/page';
import type { MainDataSlots } from '../src/shared/component-data';
import {
  mapLegendFrameStyle,
  mapLegendLevels,
  mapLegendPieces
} from '../src/components/map-chart/legend';
import {
  regionalOverviewFrameStyle
} from '../src/components/map-chart/regional-overview';
import {
  mapTooltipMarkup,
  mapTooltipRows
} from '../src/components/map-chart/tooltip';
import { mapOption } from '../src/components/map-chart/options';
import { projectionRect } from '../src/components/map-chart/options';

/** 设计源的分档色列:从高档到低档。 */
const scale = ['#7184e7', '#acb9f0', '#d9dff6', 'rgba(0, 0, 0, 0.05)'];

/** 设计源那四档「管道支持率」,按协议序(下界升序)声明。 */
const bands = [
  { label: '0', from: 0 },
  { label: '1%~50%', from: 1 },
  { label: '51%~80%', from: 51 },
  { label: '80%以上', from: 81 }
];

describe('mapLegendLevels', () => {
  it('上界由下一档的下界隐含,最高档开口向上', () => {
    expect(mapLegendLevels(bands)).toEqual([
      { label: '80%以上', from: 81 },
      { label: '51%~80%', from: 51, to: 81 },
      { label: '1%~50%', from: 1, to: 51 },
      { label: '0', from: 0, to: 1 }
    ]);
  });

  it('展示序从高到低,与分档色列同序', () => {
    expect(mapLegendLevels(bands, scale).map((level) => [level.label, level.color])).toEqual([
      ['80%以上', '#7184e7'],
      ['51%~80%', '#acb9f0'],
      ['1%~50%', '#d9dff6'],
      ['0', 'rgba(0, 0, 0, 0.05)']
    ]);
  });

  it('声明顺序颠倒也按下界归一,不指望声明顺序', () => {
    expect(mapLegendLevels([...bands].reverse(), scale)).toEqual(
      mapLegendLevels(bands, scale)
    );
  });

  it('色板缺席时档位无色(报表形态没有分档色)', () => {
    for (const level of mapLegendLevels(bands)) {
      expect(level).not.toHaveProperty('color');
    }
  });

  it('档数多于色数时低档取最低那一级色,不回卷到高档色撞色', () => {
    const levels = mapLegendLevels(bands, ['#7184e7', '#acb9f0']);
    expect(levels.map((level) => level.color)).toEqual([
      '#7184e7',
      '#acb9f0',
      '#acb9f0',
      '#acb9f0'
    ]);
  });
});

describe('mapLegendPieces', () => {
  it('档位翻成分段视觉映射的区间,区间就是图例上写的那几档', () => {
    expect(mapLegendPieces(mapLegendLevels(bands, scale))).toEqual([
      { gte: 81, label: '80%以上', color: '#7184e7' },
      { gte: 51, lt: 81, label: '51%~80%', color: '#acb9f0' },
      { gte: 1, lt: 51, label: '1%~50%', color: '#d9dff6' },
      { gte: 0, lt: 1, label: '0', color: 'rgba(0, 0, 0, 0.05)' }
    ]);
  });
});

describe('mapLegendFrameStyle', () => {
  it('消费与地图 option 同一份 projection rectangle', () => {
    const projection = projectionRect({ x: 628, y: 12, width: 532, height: 474 });
    expect(projection).toEqual({ x: 657, y: 12, width: 474, height: 474 });
    expect(mapLegendFrameStyle(projection)).toBe(
      'left:657px;top:12px;width:474px;height:474px;'
    );
  });

  it('安全区缺席或无正面积时不写局部几何，由 frame 的 inset 回退覆盖全图', () => {
    expect(mapLegendFrameStyle(undefined)).toBeUndefined();
    expect(mapLegendFrameStyle({ x: 0, y: 0, width: 0, height: 474 })).toBeUndefined();
  });
});

describe('regionalOverviewFrameStyle', () => {
  it('从安全区派生横向受控、纵向对齐安全区底边的地域注释帧', () => {
    expect(regionalOverviewFrameStyle({ x: 580, y: 280, width: 1053, height: 642 })).toBe(
      'left:620px;top:302px;width:980px;height:620px;'
    );
  });

  it('安全区变窄时夹取宽度并保持底边，未就绪时使用右下回退', () => {
    expect(regionalOverviewFrameStyle({ x: 20, y: 30, width: 700, height: 500 })).toBe(
      'left:60px;top:52px;width:628px;height:478px;'
    );
    expect(regionalOverviewFrameStyle()).toBe(
      'right:33px;bottom:0;width:980px;height:502px;'
    );
  });
});

const data: MainDataSlots = {
  main: {
    snapshot: {
      status: 'ready',
      rows: [
        { region: '中国', rate: 92, deals: 46, amount: 40 },
        { region: '德国', rate: 30, deals: 8, amount: 6 }
      ]
    },
    fields: {
      region: { type: 'string', role: 'dimension', label: '国家' },
      rate: { type: 'number', role: 'measure', label: '管道支持率', defaultFormat: 'percent-0' },
      deals: { type: 'number', role: 'measure', label: '机会点数' },
      amount: { type: 'number', role: 'measure', label: '预签金额' }
    }
  }
};

const props: MapChartProps = {
  nameField: 'region',
  valueField: 'rate',
  map: 'world'
};

const centers = new Map<string, [number, number]>();

interface VisualMap {
  type: string;
  show?: boolean;
  splitNumber?: number;
  pieces?: Array<{ gte: number; lt?: number; color?: string }>;
}

function visualMap(option: unknown): VisualMap {
  return (option as { visualMap: VisualMap }).visualMap;
}

describe('mapOption · 分档着色由档位决定', () => {
  it('声明了档位就按档位取色,不再按取值区间均分', () => {
    const mapped = visualMap(
      mapOption(
        data,
        { ...props, legend: { title: '管道支持率', bands } },
        centers,
        undefined,
        false,
        scale
      )
    );

    expect(mapped.type).toBe('piecewise');
    expect(mapped.pieces?.map((piece) => [piece.gte, piece.color])).toEqual([
      [81, '#7184e7'],
      [51, '#acb9f0'],
      [1, '#d9dff6'],
      [0, 'rgba(0, 0, 0, 0.05)']
    ]);
    // 图例由组件用 DOM 画,图表库自己那块关掉,免得同一份档位画两遍
    expect(mapped.show).toBe(false);
    expect(mapped.splitNumber).toBeUndefined();
  });

  it('没有分档色板时档位无色可配,退回原来的连续渐变', () => {
    const mapped = visualMap(
      mapOption(data, { ...props, legend: { title: '管道支持率', bands } }, centers)
    );

    expect(mapped.type).toBe('continuous');
    expect(mapped.pieces).toBeUndefined();
  });

  it('没有档位声明时仍按色列长度均分,与改动前一致', () => {
    const mapped = visualMap(mapOption(data, props, centers, undefined, false, scale));

    expect(mapped.type).toBe('piecewise');
    expect(mapped.splitNumber).toBe(4);
    expect(mapped.pieces).toBeUndefined();
  });
});

describe('mapTooltipRows / mapTooltipMarkup', () => {
  it('按声明顺序取标签与取值,取值走字段契约的展示格式', () => {
    expect(
      mapTooltipRows({ deals: 46, amount: 40 }, [
        { label: '机会点数', field: 'deals' },
        { label: '预签金额', field: 'amount' }
      ])
    ).toEqual([
      { label: '机会点数', value: '46' },
      { label: '预签金额', value: '40' }
    ]);
  });

  it('行缺席或字段缺值时走空值文本,不写出 undefined', () => {
    expect(mapTooltipRows(undefined, [{ label: '机会点数', field: 'deals' }])).toEqual([
      { label: '机会点数', value: '—' }
    ]);
  });

  it('数据里的尖括号转义,不当成标签渲染', () => {
    expect(mapTooltipMarkup('<b>注入</b>', [{ label: '&', value: '"1"' }])).toBe(
      '<div><b>&lt;b&gt;注入&lt;/b&gt;</b></div>' +
        '<div>&amp;：<b>&quot;1&quot;</b></div>'
    );
  });
});

describe('mapOption · tooltip 追加字段', () => {
  function formatter(option: unknown) {
    return (option as { tooltip: { formatter?: (params: unknown) => string } }).tooltip
      .formatter;
  }

  it('声明了追加字段就自己组装 tooltip:地域名 + 主取值 + 追加项', () => {
    const option = mapOption(
      data,
      {
        ...props,
        tooltipFields: [
          { label: '机会点数', field: 'deals' },
          { label: '预签金额', field: 'amount' }
        ]
      },
      centers
    );

    expect(formatter(option)?.({ name: '中国' })).toBe(
      '<div><b>中国</b></div>' +
        '<div>管道支持率：<b>92%</b></div>' +
        '<div>机会点数：<b>46</b></div>' +
        '<div>预签金额：<b>40</b></div>'
    );
  });

  it('区域名经 nameMap 改过名也查回同一行', () => {
    const option = mapOption(
      data,
      {
        ...props,
        nameMap: { 德国: 'Germany' },
        tooltipFields: [{ label: '机会点数', field: 'deals' }]
      },
      centers
    );

    expect(formatter(option)?.({ name: 'Germany' })).toBe(
      '<div><b>德国</b></div><div>管道支持率：<b>30%</b></div><div>机会点数：<b>8</b></div>'
    );
  });

  it('没有追加字段时 tooltip 仍是原来的 valueFormatter 形状', () => {
    const tooltip = (mapOption(data, props, centers) as {
      tooltip: Record<string, unknown>;
    }).tooltip;

    expect(tooltip.formatter).toBeUndefined();
    expect(typeof tooltip.valueFormatter).toBe('function');
  });
});
