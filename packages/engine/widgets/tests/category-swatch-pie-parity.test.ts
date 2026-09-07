import { describe, expect, it } from 'vitest';
import type { CategoryBreakdownProps, PieChartProps, Row } from '@metriccanvas/page';
import type { MainDataSlots } from '../src/shared/component-data';
import { pieOption } from '../src/components/pie-chart/options';
import { categoryBreakdownView } from '../src/components/category-breakdown/rows';

/**
 * 分类明细的色点与并排环形图的扇区必须同色同序(ADR-0053)。这条契约不进页面
 * 文档,因此**测试是它唯一的保障**;没有它,颜色错位会以「看起来没问题」的
 * 形式长期存在——图和表各自都自洽,只有对着看才发现颜色串了。
 *
 * 校验器只允许两者绑**同一个数据源上的同一个字段**(`categorySwatchErrors`),
 * 所以两边看到的是同一份行、同一个行序;这里的断言因此写在「同一个类别在两处
 * 取到同一个颜色」上,并且换一次行序再验一遍。
 */

const palette = ['#5b72ea', '#3cc6c1', '#fec72a', '#4ba0f7'];

const fields = {
  tier: { type: 'string', role: 'dimension', label: '项目分层' },
  count: { type: 'number', role: 'measure', label: '机会点数' },
  amount: { type: 'number', role: 'measure', label: '预签金额' }
} as const;

function slots(rows: Row[]): MainDataSlots {
  return { main: { snapshot: { status: 'ready', rows }, fields: { ...fields } } };
}

const pieProps: PieChartProps = {
  categoryField: 'tier',
  valueField: 'amount',
  ring: '58%'
};

const breakdownProps: CategoryBreakdownProps = {
  categoryField: 'tier',
  swatches: true,
  columns: [
    { label: '机会点', field: 'count' },
    { label: '预签金额', field: 'amount' }
  ]
};

interface PieSlice {
  name: string;
  itemStyle?: { color?: string };
}

/** 类别 → 颜色。两边都按类别归并,位置因此不进断言。 */
function pieColors(rows: Row[]): Map<string, string | undefined> {
  const series = (pieOption(slots(rows), pieProps, palette) as {
    series: Array<{ data: PieSlice[] }>;
  }).series[0]!;
  return new Map(series.data.map((slice) => [slice.name, slice.itemStyle?.color]));
}

function swatchColors(rows: Row[]): Map<string, string | undefined> {
  return new Map(
    categoryBreakdownView(slots(rows), breakdownProps, palette).rows.map((row) => [
      row.category,
      row.swatch
    ])
  );
}

const rows: Row[] = [
  { tier: '卓越', count: 46, amount: 40 },
  { tier: '战略', count: 38, amount: 20 },
  { tier: '核心', count: 12, amount: 9 }
];

describe('分类明细色点 × 饼图扇区 · 同色同序', () => {
  it('每个类别在两处取到同一个颜色', () => {
    expect(swatchColors(rows)).toEqual(pieColors(rows));
  });

  it('同一份数据换一次行序,两边仍然逐个类别配同一个色', () => {
    const reordered: Row[] = [rows[2]!, rows[0]!, rows[1]!];

    // 换行序前后各自成对;成对关系是被钉住的那一条,不是某个类别的绝对色值
    // ——类别域按首次出现顺序定(见 shared/chart-palette.ts),行序变了域跟着
    // 变,但两个消费方读的是同一份行,所以它们永远一起变、不会互相错开。
    expect(swatchColors(rows)).toEqual(pieColors(rows));
    expect(swatchColors(reordered)).toEqual(pieColors(reordered));
  });

  it('同一个类别出现两次时两处都取同一个色,不按位置各取一个', () => {
    const repeated: Row[] = [
      { tier: '卓越', count: 46, amount: 40 },
      { tier: '战略', count: 38, amount: 20 },
      { tier: '卓越', count: 7, amount: 3 }
    ];

    // 按位置取色的实现在这里就会露出来:两个「卓越」会拿到 0 号与 2 号两种色。
    const swatches = categoryBreakdownView(slots(repeated), breakdownProps, palette).rows;
    expect(swatches.map((row) => row.swatch)).toEqual([
      '#5b72ea',
      '#3cc6c1',
      '#5b72ea'
    ]);
    expect(swatchColors(repeated)).toEqual(pieColors(repeated));
  });

  it('色板缺席时两处一并不着色,不会一边有色一边没有', () => {
    const uncolored = new Map(
      categoryBreakdownView(slots(rows), breakdownProps).rows.map((row) => [
        row.category,
        row.swatch
      ])
    );
    const uncoloredPie = new Map(
      (pieOption(slots(rows), pieProps) as {
        series: Array<{ data: PieSlice[] }>;
      }).series[0]!.data.map((slice) => [slice.name, slice.itemStyle?.color])
    );

    expect(uncolored).toEqual(uncoloredPie);
    for (const color of uncolored.values()) expect(color).toBeUndefined();
  });
});
