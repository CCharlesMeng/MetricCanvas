import { describe, expect, it } from 'vitest';
import type { Row } from '@metriccanvas/page';
import { mergeSpans, tableRowTier } from '../src/components/table/presentation';
import type { AlignedTableRow } from '../src/components/table/rows';

const rows = (values: Row[]): AlignedTableRow[] =>
  values.map((main) => ({ main, bySlot: { main } }));

describe('行类别档位', () => {
  it('识别闭集内的小计与合计', () => {
    const [subtotal, total] = rows([{ kind: 'subtotal' }, { kind: 'total' }]);
    expect(tableRowTier(subtotal!, 'kind')).toBe('subtotal');
    expect(tableRowTier(total!, 'kind')).toBe('total');
  });

  it('未声明行类别字段、空值与闭集外取值一律按明细处理', () => {
    const [none, unknown] = rows([{ kind: null }, { kind: 'grandTotal' }]);
    expect(tableRowTier(none!, undefined)).toBe('detail');
    expect(tableRowTier(none!, 'kind')).toBe('detail');
    expect(tableRowTier(unknown!, 'kind')).toBe('detail');
    expect(tableRowTier(unknown!, 'missing-field')).toBe('detail');
  });
});

describe('相邻同值合并', () => {
  it('组内首行取组大小，其余取 0', () => {
    expect(
      mergeSpans(
        rows([{ type: 'A' }, { type: 'A' }, { type: 'A合计' }, { type: 'B' }]),
        'type'
      )
    ).toEqual([2, 0, 1, 1]);
  });

  it('只合并相邻：同值被打断后重新起一组', () => {
    expect(
      mergeSpans(rows([{ type: 'A' }, { type: 'B' }, { type: 'A' }]), 'type')
    ).toEqual([1, 1, 1]);
  });

  it('空值不参与合并：两行都没有取值推不出它们同组', () => {
    expect(
      mergeSpans(rows([{ type: null }, { type: null }, { type: 'A' }]), 'type')
    ).toEqual([1, 1, 1]);
  });

  it('未声明合并字段时每行各自成列', () => {
    expect(mergeSpans(rows([{ type: 'A' }, { type: 'A' }]), undefined)).toEqual([1, 1]);
  });

  it('空行集与单行', () => {
    expect(mergeSpans([], 'type')).toEqual([]);
    expect(mergeSpans(rows([{ type: 'A' }]), 'type')).toEqual([1]);
  });

  it('rowSpan 之和等于行数：不会漏渲染也不会多渲染单元格', () => {
    const spans = mergeSpans(
      rows([{ type: 'A' }, { type: 'A' }, { type: 'A' }, { type: 'B' }, { type: 'B' }]),
      'type'
    );
    expect(spans.reduce((sum, span) => sum + span, 0)).toBe(5);
  });
});
