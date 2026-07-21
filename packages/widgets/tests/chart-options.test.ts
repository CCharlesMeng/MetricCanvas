import { describe, expect, it } from 'vitest';
import type { MainDataSlots } from '../src/component-data';
import { lineOption } from '../src/chart-options';

interface TestedLineOption {
  tooltip: { confine: boolean; hideDelay: number };
  xAxis: { name?: string; data: string[] };
  yAxis:
    | {
        axisLabel?: { show: boolean };
        axisTick?: { show: boolean };
        axisLine?: { show: boolean };
      }
    | unknown[];
  series: Array<{
    name: string;
    data: Array<number | undefined>;
    label?: { position: string; formatter: (params: unknown) => string };
  }>;
}

describe('lineOption', () => {
  it('从字段契约继承日期格式与趋势系列标签', () => {
    const data: MainDataSlots = {
      main: {
        snapshot: {
          status: 'ready',
          rows: [
            { date: '06-22', tokens: 830_960_000_000 },
            { date: '06-23', tokens: 866_160_000_000 }
          ]
        },
        fields: {
          date: { type: 'date', role: 'dimension', label: '日期', format: 'date-month-day' },
          tokens: { type: 'number', role: 'metric', label: 'Tokens消耗总量' }
        }
      }
    };
    const option = lineOption(data, {
      xField: 'date',
      series: [{ field: 'tokens' }]
    }) as unknown as TestedLineOption;

    expect(option.xAxis.data).toEqual(['06-22', '06-23']);
    expect(option.xAxis.name).toBe('日期');
    expect(option.series[0].name).toBe('Tokens消耗总量');
    expect(option.series[0].data).toEqual([830_960_000_000, 866_160_000_000]);
  });

  it('props 控制图形选项，字段格式控制点标签且原始数据不变', () => {
    const data: MainDataSlots = {
      main: {
        snapshot: {
          status: 'ready',
          rows: [{ statDate: '2026-06-23T00:00:00Z', rate: 4.24 }]
        },
        fields: {
          statDate: {
            type: 'date',
            role: 'dimension',
            label: '日期',
            format: 'date-month-day'
          },
          rate: {
            type: 'number',
            role: 'metric',
            label: '较昨日',
            format: 'percent-2-signed'
          }
        }
      }
    };
    const option = lineOption(data, {
      xField: 'statDate',
      series: [{ field: 'rate' }],
      showPointLabels: true,
      hideYAxis: true
    }) as unknown as TestedLineOption;

    expect(option.tooltip).toMatchObject({ confine: true, hideDelay: 200 });
    expect(option.xAxis).toMatchObject({ name: '日期', data: ['06-23'] });
    expect(option.series[0].name).toBe('较昨日');
    expect(option.series[0].data).toEqual([4.24]);
    expect(option.series[0].label?.position).toBe('top');
    expect(option.series[0].label?.formatter({ value: 4.24 })).toBe('+4.24%');
    expect(option.yAxis).toMatchObject({
      axisLabel: { show: false },
      axisTick: { show: false },
      axisLine: { show: false }
    });
  });
});
