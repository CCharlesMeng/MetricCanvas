import { describe, expect, it } from 'vitest';
import type { BarChartProps } from '@metriccanvas/page';
import type { MainDataSlots } from '../src/shared/component-data';
import { barOption } from '../src/components/bar-chart/options';

interface TestedBarOption {
  grid?: { top: number };
  tooltip: { trigger: string; confine: boolean };
  legend?: { top: number; left?: number; right?: number };
  xAxis: { type: string; data: string[] };
  yAxis: { type: string; name?: string; axisLabel?: { formatter?: (value: number) => string } };
  dataZoom?: unknown;
  toolbox?: unknown;
  series: Array<{
    name: string;
    stack?: string;
    data: Array<
      | number
      | undefined
      | {
          value: number;
          label?: {
            color?: string;
            backgroundColor?: string;
            borderRadius?: number;
            padding?: number[];
          };
        }
    >;
    label?: {
      show?: boolean;
      position?: string;
      color?: string;
      backgroundColor?: string;
      borderRadius?: number;
      padding?: number[];
      formatter?: (params: { value: number }) => string;
    };
    labelLayout?:
      | { moveOverlap?: string }
      | ((params: { text: string }) => { moveOverlap?: string });
    markPoint?: {
      data?: Array<{ value: number }>;
      label?: { formatter?: (params: { value: number }) => string };
    };
    itemStyle?: {
      color?: string;
      opacity?: number;
      borderColor?: string;
      borderType?: string;
      borderWidth?: number;
      borderRadius?: number[];
    };
    barWidth?: number;
  }>;
}

const data: MainDataSlots = {
  main: {
    fields: {
      month: { type: 'string', role: 'dimension' },
      coreActual: {
        type: 'money',
        role: 'measure',
        currency: 'CNY',
        defaultFormat: 'cny-adaptive'
      },
      communicationActual: {
        type: 'money',
        role: 'measure',
        currency: 'CNY',
        defaultFormat: 'cny-adaptive'
      },
      coreForecast: {
        type: 'money',
        role: 'measure',
        currency: 'CNY',
        defaultFormat: 'cny-adaptive'
      },
      communicationForecast: {
        type: 'money',
        role: 'measure',
        currency: 'CNY',
        defaultFormat: 'cny-adaptive'
      }
    },
    snapshot: {
      status: 'ready',
      rows: [
        {
          month: '1月',
          coreActual: 8_200_000,
          communicationActual: 3_100_000,
          coreForecast: null,
          communicationForecast: null
        },
        {
          month: '2月',
          coreActual: 8_400_000,
          communicationActual: 3_200_000,
          coreForecast: null,
          communicationForecast: null
        },
        {
          month: '3月',
          coreActual: null,
          communicationActual: null,
          coreForecast: 8_600_000,
          communicationForecast: 3_300_000
        }
      ]
    }
  }
};

const props = {
  variant: 'reportForecast',
  categoryField: 'month',
  stacked: true,
  series: [
    { field: 'coreActual', label: 'Core流水', role: 'actual' },
    { field: 'communicationActual', label: '云通信流水', role: 'actual' },
    { field: 'coreForecast', label: 'Core流水(预测)', role: 'forecast' },
    { field: 'communicationForecast', label: '云通信流水(预测)', role: 'forecast' }
  ]
} satisfies BarChartProps;

describe('barOption 实际/预测系列', () => {
  it('保持月份 X 轴、金额 Y 轴、四图例和统一堆叠键', () => {
    const option = barOption(data, props) as unknown as TestedBarOption;

    expect(option.xAxis).toEqual({ type: 'category', data: ['1月', '2月', '3月'] });
    expect(option.yAxis).toMatchObject({ type: 'value' });
    expect(option.legend).toEqual({ top: 0, right: 0 });
    expect(option.grid?.top).toBe(44);
    expect(option.yAxis.name).toBeUndefined();
    expect(option.yAxis.axisLabel?.formatter?.(12_000_000)).toBe('1,200万');
    expect(option.series.map((series) => series.name)).toEqual([
      'Core流水',
      '云通信流水',
      'Core流水(预测)',
      '云通信流水(预测)'
    ]);
    expect(new Set(option.series.map((series) => series.stack))).toEqual(new Set(['total']));
  });

  it('历史与未来空值保持互斥，forecast 使用同业务色虚线半透明描边', () => {
    const option = barOption(data, props) as unknown as TestedBarOption;
    const [coreActual, communicationActual, coreForecast, communicationForecast] = option.series;

    expect(coreActual.data).toEqual([8_200_000, 8_400_000, undefined]);
    expect(communicationActual.data).toEqual([3_100_000, 3_200_000, undefined]);
    expect(coreForecast.data).toEqual([undefined, undefined, 8_600_000]);
    expect(communicationForecast.data).toEqual([undefined, undefined, 3_300_000]);

    expect(coreActual.itemStyle?.color).toBe('#1476ff');
    expect(communicationActual.itemStyle?.color).toBe('#0cb8b2');
    expect(coreForecast.itemStyle).toMatchObject({
      color: 'rgba(20, 118, 255, 0.2)',
      borderColor: coreActual.itemStyle?.color,
      borderType: 'dashed',
      borderWidth: 1
    });
    expect(communicationForecast.itemStyle).toMatchObject({
      color: 'rgba(12, 184, 178, 0.2)',
      borderColor: communicationActual.itemStyle?.color,
      borderType: 'dashed',
      borderWidth: 1
    });
    expect(option.series.every((series) => series.barWidth === 40)).toBe(true);
  });

  it('只提供轴向 Tooltip 与图例，不生成标签、缩放或工具箱', () => {
    const option = barOption(data, props) as unknown as TestedBarOption;

    expect(option.tooltip).toEqual({ trigger: 'axis', confine: true });
    expect(option.legend).toBeDefined();
    expect(option.dataZoom).toBeUndefined();
    expect(option.toolbox).toBeUndefined();
    expect(option.series.every((series) => series.label === undefined)).toBe(true);
  });

  it('按声明顺序堆叠，短金额保持柱内样式并继承人民币格式', () => {
    const labeledProps = {
      ...props,
      rounded: true,
      showSegmentLabels: true,
      showStackTotalLabels: true,
      series: [
        { ...props.series[0], stackOrder: 2 },
        { ...props.series[1], stackOrder: 1 },
        { ...props.series[2], stackOrder: 2 },
        { ...props.series[3], stackOrder: 1 }
      ]
    } as unknown as BarChartProps;
    const option = barOption(data, labeledProps) as unknown as TestedBarOption;

    expect(option.series.map((series) => series.name)).toEqual([
      '云通信流水',
      '云通信流水(预测)',
      'Core流水',
      'Core流水(预测)'
    ]);
    expect(option.series[0]?.itemStyle?.color).toBe('#0cb8b2');
    expect(option.series[2]?.itemStyle?.color).toBe('#1476ff');
    expect(option.series[0]?.itemStyle?.borderRadius).toEqual([0, 0, 0, 0]);
    expect(option.series[1]?.itemStyle?.borderRadius).toEqual([0, 0, 0, 0]);
    expect(option.series[2]?.itemStyle?.borderRadius).toEqual([4, 4, 0, 0]);
    expect(option.series[3]?.itemStyle?.borderRadius).toEqual([4, 4, 0, 0]);
    expect(option.series.every((series) => series.label?.show === true)).toBe(true);
    expect(option.series.every((series) => series.label?.position === 'inside')).toBe(true);
    const labelLayout = option.series[0]?.labelLayout;
    expect(typeof labelLayout).toBe('function');
    if (typeof labelLayout === 'function') {
      expect(labelLayout({ text: '1.22亿' })).toEqual({});
      expect(labelLayout({ text: '1,220.0亿' })).toEqual({ moveOverlap: 'shiftX' });
    }
    expect(option.series.map((series) => series.label?.color)).toEqual([
      '#fff',
      '#0cb8b2',
      '#fff',
      '#1476ff'
    ]);
    expect(
      option.series.every(
        (series) =>
          series.label?.backgroundColor === undefined &&
          series.label?.borderRadius === undefined &&
          series.label?.padding === undefined
      )
    ).toBe(true);
    expect(option.series[0]?.label?.formatter?.({ value: 3_100_000 })).toBe('310万');
    expect(option.series[0]?.label?.formatter?.({ value: 9_999 })).toBe('9,999元');
    expect(option.series[0]?.label?.formatter?.({ value: 10_000 })).toBe('1.00万');
    expect(option.series[0]?.label?.formatter?.({ value: 100_000_000 })).toBe('1.00亿');
    expect(option.series[0]?.label?.formatter?.({ value: 1_000_000_000 })).toBe('10.0亿');
    expect(option.series[0]?.label?.formatter?.({ value: 123_456_789_000 })).toBe('1,234.6亿');
    expect(option.series[2]?.markPoint?.data?.map((point) => point.value)).toEqual([
      11_300_000,
      11_600_000
    ]);
    expect(option.series[2]?.markPoint?.label?.formatter?.({ value: 11_300_000 })).toBe(
      '1,130万'
    );
    expect(option.series[3]?.markPoint?.data?.map((point) => point.value)).toEqual([11_900_000]);
  });

  it('只为超出柱宽的长金额数据项增加悬浮底', () => {
    const longAmountData: MainDataSlots = {
      main: {
        ...data.main,
        snapshot: {
          ...data.main.snapshot,
          rows: data.main.snapshot.rows.map((row, index) =>
            index === 0 ? { ...row, coreActual: 123_456_789_000 } : row
          )
        }
      }
    };
    const option = barOption(longAmountData, {
      ...props,
      showSegmentLabels: true
    }) as unknown as TestedBarOption;
    const coreActual = option.series.find((series) => series.name === 'Core流水');

    expect(coreActual?.data[0]).toEqual({
      value: 123_456_789_000,
      label: {
        color: '#1476ff',
        backgroundColor: 'rgba(255, 255, 255, 0.88)',
        borderRadius: 2,
        padding: [1, 3]
      }
    });
    expect(coreActual?.data[1]).toBe(8_400_000);
  });

  it('非堆叠系列各自保留生长端圆角', () => {
    const option = barOption(data, {
      ...props,
      stacked: false,
      rounded: true
    }) as unknown as TestedBarOption;

    expect(option.series.every((series) =>
      JSON.stringify(series.itemStyle?.borderRadius) === JSON.stringify([4, 4, 0, 0])
    )).toBe(true);
  });

  it('无 role 的堆叠系列只在整体顶部保留圆角', () => {
    const option = barOption(data, {
      ...props,
      rounded: true,
      series: [
        { field: 'coreActual', label: 'Core流水' },
        { field: 'communicationActual', label: '云通信流水' }
      ]
    }) as unknown as TestedBarOption;

    expect(option.series[0]?.itemStyle?.borderRadius).toEqual([0, 0, 0, 0]);
    expect(option.series[1]?.itemStyle?.borderRadius).toEqual([4, 4, 0, 0]);
  });
});

describe('barOption · 形态类别色板', () => {
  const plainProps = {
    categoryField: 'month',
    series: [
      { field: 'coreActual', label: 'Core流水', role: 'actual' },
      { field: 'coreForecast', label: 'Core流水(预测)', role: 'forecast' }
    ]
  } satisfies BarChartProps;

  it('色板缺席时不写顶层 color,role 档位取包内 CHART_PALETTE', () => {
    const option = barOption(data, plainProps) as unknown as {
      color?: string[];
      series: Array<{ itemStyle?: { color?: string } }>;
    };

    expect(option).not.toHaveProperty('color');
    expect(option.series[0]?.itemStyle?.color).toBe('#5470c6');
  });

  it('色板给出时同时接管顶层 color 与 role 档位色', () => {
    const palette = ['#5b72ea', '#3cc6c1'];
    const option = barOption(data, plainProps, palette) as unknown as {
      color?: string[];
      series: Array<{ itemStyle?: { color?: string } }>;
    };

    expect(option.color).toEqual(palette);
    expect(option.series[0]?.itemStyle?.color).toBe('#5b72ea');
  });

  it('reportForecast 变体的实测/预测双色是变体语义色,不受形态色板影响', () => {
    const option = barOption(data, props, ['#5b72ea', '#3cc6c1']) as unknown as {
      series: Array<{ itemStyle?: { color?: string } }>;
    };

    expect(option.series[0]?.itemStyle?.color).toBe('#1476ff');
  });
});
