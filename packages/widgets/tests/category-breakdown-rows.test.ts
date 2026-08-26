import { describe, expect, it } from 'vitest';
import type { CategoryBreakdownProps } from '@metriccanvas/page';
import type { MainDataSlots } from '../src/shared/component-data';
import { categoryBreakdownView } from '../src/components/category-breakdown/rows';

const fields = {
  tier: { type: 'string', role: 'dimension', label: '项目分层' },
  count: { type: 'number', role: 'measure', label: '机会点数' },
  amount: { type: 'number', role: 'measure', label: '预签金额', defaultFormat: 'compact-yi-1' }
} as const;

function slots(rows: MainDataSlots['main']['snapshot']['rows']): MainDataSlots {
  return { main: { snapshot: { status: 'ready', rows }, fields: { ...fields } } };
}

const rows = [
  { tier: '卓越', count: 46, amount: 4_000_000_000 },
  { tier: '战略', count: 38, amount: 2_000_000_000 },
  { tier: '核心', count: 12, amount: 900_000_000 }
];

const props: CategoryBreakdownProps = {
  categoryField: 'tier',
  columns: [
    { label: '机会点', field: 'count' },
    { label: '预签金额', field: 'amount' }
  ]
};

describe('categoryBreakdownView', () => {
  it('按类别逐行、按度量逐列,取值走字段契约的展示格式', () => {
    const view = categoryBreakdownView(slots(rows), props);

    expect(view.columns).toEqual(['机会点', '预签金额']);
    expect(view.rows).toEqual([
      { category: '卓越', values: ['46', '40.0亿'] },
      { category: '战略', values: ['38', '20.0亿'] },
      { category: '核心', values: ['12', '9.0亿'] }
    ]);
  });

  it('类别列列头不写时取字段自己的 label', () => {
    expect(categoryBreakdownView(slots(rows), props).categoryLabel).toBe('项目分层');
  });

  it('类别列列头写了文本就用那段文本', () => {
    expect(
      categoryBreakdownView(slots(rows), { ...props, categoryLabel: '分层' }).categoryLabel
    ).toBe('分层');
  });

  it('categoryLabel: false 即这一列不要列头,度量列头照旧', () => {
    const view = categoryBreakdownView(slots(rows), { ...props, categoryLabel: false });

    expect(view).not.toHaveProperty('categoryLabel');
    expect(view.columns).toEqual(['机会点', '预签金额']);
  });

  it('未开启色点时不取色,色板在也不取', () => {
    const view = categoryBreakdownView(slots(rows), props, ['#5b72ea']);
    for (const row of view.rows) expect(row).not.toHaveProperty('swatch');
  });

  it('开启色点但色板缺席时不取色(报表形态没有类别色板)', () => {
    const view = categoryBreakdownView(slots(rows), { ...props, swatches: true });
    for (const row of view.rows) expect(row).not.toHaveProperty('swatch');
  });

  it('开启色点时按类别域取色', () => {
    const view = categoryBreakdownView(slots(rows), { ...props, swatches: true }, [
      '#5b72ea',
      '#3cc6c1',
      '#fec72a',
      '#4ba0f7'
    ]);

    expect(view.rows.map((row) => [row.category, row.swatch])).toEqual([
      ['卓越', '#5b72ea'],
      ['战略', '#3cc6c1'],
      ['核心', '#fec72a']
    ]);
  });

  it('重复类别不占额外的色位', () => {
    const view = categoryBreakdownView(
      slots([
        { tier: '卓越', count: 1, amount: 1 },
        { tier: '战略', count: 2, amount: 2 },
        { tier: '卓越', count: 3, amount: 3 }
      ]),
      { ...props, swatches: true },
      ['#5b72ea', '#3cc6c1']
    );

    expect(view.rows.map((row) => row.swatch)).toEqual(['#5b72ea', '#3cc6c1', '#5b72ea']);
  });

  it('空行集只剩列头', () => {
    const view = categoryBreakdownView(slots([]), props);
    expect(view.rows).toEqual([]);
    expect(view.columns).toEqual(['机会点', '预签金额']);
  });
});
