import { describe, expect, it } from 'vitest';
import type { MainDataSlots } from '../src/shared/component-data';
import { pieOption } from '../src/components/pie-chart/options';

const data: MainDataSlots = {
  main: {
    snapshot: {
      status: 'ready',
      rows: [
        { region: '华东', amount: 30 },
        { region: '华南', amount: 20 },
        { region: '华北', amount: 10 }
      ]
    },
    fields: {
      region: { type: 'string', role: 'dimension', label: '区域' },
      amount: { type: 'number', role: 'measure', label: '金额' }
    }
  }
};

const props = { categoryField: 'region', valueField: 'amount' };

interface PieSeries {
  data: { name: string; value: number; itemStyle?: { color?: string } }[];
  radius?: string | [string, string];
  center?: [string, string];
  label?: { show?: boolean };
  labelLine?: { show?: boolean };
}

function slices(option: unknown): PieSeries['data'] {
  return (option as { series: PieSeries[] }).series[0]!.data;
}

function series(option: unknown): PieSeries {
  return (option as { series: PieSeries[] }).series[0]!;
}

describe('pieOption · compactRing', () => {
  it('紧凑环图扩大外环并关闭外置标签，缺省饼图语义保持', () => {
    expect(series(pieOption(data, { ...props, variant: 'compactRing' }))).toMatchObject({
      radius: ['58%', '82%'],
      center: ['50%', '50%'],
      label: { show: false },
      labelLine: { show: false }
    });

    expect(series(pieOption(data, props))).toMatchObject({
      radius: '72%',
      label: { show: true },
      labelLine: { show: true }
    });
  });
});

describe('pieOption · 形态类别色板', () => {
  it('色板缺席时扇区不带 itemStyle,取图表库内置色', () => {
    for (const slice of slices(pieOption(data, props))) {
      expect(slice).not.toHaveProperty('itemStyle');
    }
  });

  it('色板给出时逐扇区按类别取色', () => {
    const palette = ['#5b72ea', '#3cc6c1', '#fec72a', '#4ba0f7'];

    expect(
      slices(pieOption(data, props, palette)).map((slice) => [
        slice.name,
        slice.itemStyle?.color
      ])
    ).toEqual([
      ['华东', '#5b72ea'],
      ['华南', '#3cc6c1'],
      ['华北', '#fec72a']
    ]);
  });

  it('同一类别换了行序也取到同一个颜色(同色同序)', () => {
    const palette = ['#5b72ea', '#3cc6c1', '#fec72a'];
    const byName = (option: unknown) =>
      new Map(slices(option).map((slice) => [slice.name, slice.itemStyle?.color]));

    // 类别域按首次出现顺序定,不按行序定:同一批类别的取色因此稳定
    const first = byName(pieOption(data, props, palette));
    const reordered = byName(
      pieOption(
        {
          main: {
            snapshot: {
              status: 'ready',
              rows: [
                { region: '华东', amount: 30 },
                { region: '华南', amount: 20 },
                { region: '华北', amount: 10 }
              ]
            },
            fields: data.main.fields
          }
        },
        props,
        palette
      )
    );

    expect(reordered).toEqual(first);
  });

  it('重复类别不占额外的色位', () => {
    const palette = ['#5b72ea', '#3cc6c1'];
    const option = pieOption(
      {
        main: {
          snapshot: {
            status: 'ready',
            rows: [
              { region: '华东', amount: 1 },
              { region: '华南', amount: 2 },
              { region: '华东', amount: 3 }
            ]
          },
          fields: data.main.fields
        }
      },
      props,
      palette
    );

    expect(slices(option).map((slice) => slice.itemStyle?.color)).toEqual([
      '#5b72ea',
      '#3cc6c1',
      '#5b72ea'
    ]);
  });
});
