import { describe, expect, it } from 'vitest';
import type { BarChartProps } from '@metriccanvas/page';
import type { MainDataSlots } from '../src/shared/component-data';
import { barOption } from '../src/components/bar-chart/options';

interface TestedBarOption {
  tooltip: { trigger: string; confine: boolean };
  legend?: { top: number; left?: number; right?: number };
  xAxis: { type: string; data: string[] };
  yAxis: { type: string; name?: string; axisLabel?: { formatter?: (value: number) => string } };
  dataZoom?: unknown;
  toolbox?: unknown;
  series: Array<{
    name: string;
    stack?: string;
    data: Array<number | undefined>;
    label?: {
      show?: boolean;
      formatter?: (params: { value: number }) => string;
    };
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
      coreActual: { type: 'number', role: 'measure', defaultFormat: 'compact-wan-0' },
      communicationActual: {
        type: 'number',
        role: 'measure',
        defaultFormat: 'compact-wan-0'
      },
      coreForecast: { type: 'number', role: 'measure', defaultFormat: 'compact-wan-0' },
      communicationForecast: {
        type: 'number',
        role: 'measure',
        defaultFormat: 'compact-wan-0'
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
    expect(option.yAxis.name).toBe('万');
    expect(option.yAxis.axisLabel?.formatter?.(12_000_000)).toBe('1200');
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

  it('按声明的堆叠顺序把绿色系列置底，并配置分段与总额万单位标签', () => {
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
    expect(option.series[0]?.label?.formatter?.({ value: 3_100_000 })).toBe('310万');
    expect(option.series[2]?.markPoint?.data?.map((point) => point.value)).toEqual([
      11_300_000,
      11_600_000
    ]);
    expect(option.series[2]?.markPoint?.label?.formatter?.({ value: 11_300_000 })).toBe(
      '1,130万'
    );
    expect(option.series[3]?.markPoint?.data?.map((point) => point.value)).toEqual([11_900_000]);
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
