import { describe, expect, it } from 'vitest';
import { componentCatalogEntry, type ComponentCatalogEntry } from '@metriccanvas/page';
import { SECTION_COLUMN_COUNT, packSectionSpans } from '../src';

type ComponentType = ComponentCatalogEntry['type'];

/** 按组件类型取目录 defaultSpan 作为比例基线,与装配读的是同一份真源。 */
function spansOf(types: readonly ComponentType[]): number[] {
  return packSectionSpans(types.map((type) => componentCatalogEntry(type).defaultSpan));
}

describe('分区宽度装箱:每个视觉行占满整行', () => {
  it('单个组件独占分区时铺满整行', () => {
    expect(spansOf(['metricCard'])).toEqual([12]);
    expect(spansOf(['lineChart'])).toEqual([12]);
    expect(spansOf(['barChart'])).toEqual([12]);
    expect(spansOf(['pieChart'])).toEqual([12]);
    expect(spansOf(['table'])).toEqual([12]);
  });

  /**
   * 比例来自人工搭的看板:目录 defaultSpan 之间的比例被保留,换算到刚好
   * 占满整行。这些配方在 pages/ 下的既有看板里逐条可见。
   */
  it.each([
    { name: '两张指标卡', types: ['metricCard', 'metricCard'], spans: [6, 6] },
    {
      name: '三张指标卡',
      types: ['metricCard', 'metricCard', 'metricCard'],
      spans: [4, 4, 4]
    },
    {
      name: '四张指标卡',
      types: ['metricCard', 'metricCard', 'metricCard', 'metricCard'],
      spans: [3, 3, 3, 3]
    },
    { name: '两张排行卡', types: ['rankingCard', 'rankingCard'], spans: [6, 6] },
    { name: '指标卡配柱状图', types: ['metricCard', 'barChart'], spans: [4, 8] },
    { name: '折线图配饼图', types: ['lineChart', 'pieChart'], spans: [8, 4] },
    {
      name: '两张指标卡配柱状图',
      types: ['metricCard', 'metricCard', 'barChart'],
      spans: [3, 3, 6]
    }
  ] satisfies Array<{ name: string; types: ComponentType[]; spans: number[] }>)(
    '按 defaultSpan 的比例分满整行:$name',
    ({ types, spans }) => {
      expect(spansOf(types)).toEqual(spans);
    }
  );

  it('装不下的组件换行,新行同样占满整行', () => {
    // 两张折线图的比例基线各 8,一行装不下,各自独占一行。
    expect(spansOf(['lineChart', 'lineChart'])).toEqual([12, 12]);
    // 四张指标卡刚好占满一行,第五张换行后独占整行。
    expect(
      spansOf([
        'metricCard',
        'metricCard',
        'metricCard',
        'metricCard',
        'metricCard'
      ])
    ).toEqual([3, 3, 3, 3, 12]);
  });

  it('任意组件序列的每个视觉行之和都恰好等于列数', () => {
    const catalogTypes: ComponentType[] = [
      'metricCard',
      'lineChart',
      'barChart',
      'pieChart',
      'table',
      'rankingCard',
      'rankingDetailCard'
    ];
    // 穷举长度 1~4 的组件序列(一页至多 6 个取数单元,4 已覆盖全部分行分支)。
    let sequences: ComponentType[][] = catalogTypes.map((type) => [type]);
    const all: ComponentType[][] = [...sequences];
    for (let length = 2; length <= 4; length += 1) {
      sequences = sequences.flatMap((sequence) =>
        catalogTypes.map((type) => [...sequence, type])
      );
      all.push(...sequences);
    }

    for (const sequence of all) {
      const ratios = sequence.map((type) => componentCatalogEntry(type).defaultSpan);
      const spans = packSectionSpans(ratios);
      expect(spans).toHaveLength(sequence.length);

      // 按比例基线复算分行,逐行核对 span 之和。
      let rowStart = 0;
      let filled = 0;
      for (let index = 0; index < ratios.length; index += 1) {
        if (index > rowStart && filled + ratios[index]! > SECTION_COLUMN_COUNT) {
          expect(sum(spans.slice(rowStart, index))).toBe(SECTION_COLUMN_COUNT);
          rowStart = index;
          filled = 0;
        }
        filled += ratios[index]!;
      }
      expect(sum(spans.slice(rowStart))).toBe(SECTION_COLUMN_COUNT);
      expect(spans.every((span) => span >= 1 && span <= SECTION_COLUMN_COUNT)).toBe(true);
    }
  });

  it('声明了受控权重列轨的分区按轨数装满', () => {
    expect(packSectionSpans([4, 4, 3], 3)).toEqual([1, 1, 1]);
    expect(packSectionSpans([4], 3)).toEqual([3]);
  });
});

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
