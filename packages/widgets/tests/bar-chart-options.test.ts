import { describe, expect, it } from 'vitest';
import type { BarChartProps } from '@metriccanvas/page';
import type { MainDataSlots } from '../src/shared/component-data';
import { barOption } from '../src/components/bar-chart/options';

interface TestedBarOption {
  tooltip: { trigger: string; confine: boolean };
  legend?: { top: number; left: number };
  xAxis: { type: string; data: string[] };
  yAxis: { type: string };
  dataZoom?: unknown;
  toolbox?: unknown;
  series: Array<{
    name: string;
    stack?: string;
    data: Array<number | undefined>;
    label?: unknown;
    itemStyle?: {
      color?: string;
      opacity?: number;
      borderColor?: string;
      borderType?: string;
      borderWidth?: number;
    };
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
    expect(option.legend).toEqual({ top: 0, left: 0 });
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

    expect(coreActual.itemStyle?.color).toBeTruthy();
    expect(communicationActual.itemStyle?.color).toBeTruthy();
    expect(coreForecast.itemStyle).toMatchObject({
      color: coreActual.itemStyle?.color,
      borderColor: coreActual.itemStyle?.color,
      opacity: 0.35,
      borderType: 'dashed',
      borderWidth: 1
    });
    expect(communicationForecast.itemStyle).toMatchObject({
      color: communicationActual.itemStyle?.color,
      borderColor: communicationActual.itemStyle?.color,
      opacity: 0.35,
      borderType: 'dashed',
      borderWidth: 1
    });
  });

  it('只提供轴向 Tooltip 与图例，不生成标签、缩放或工具箱', () => {
    const option = barOption(data, props) as unknown as TestedBarOption;

    expect(option.tooltip).toEqual({ trigger: 'axis', confine: true });
    expect(option.legend).toBeDefined();
    expect(option.dataZoom).toBeUndefined();
    expect(option.toolbox).toBeUndefined();
    expect(option.series.every((series) => series.label === undefined)).toBe(true);
  });
});
