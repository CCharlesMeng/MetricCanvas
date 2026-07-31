import { describe, expect, it } from 'vitest';
import {
  initialTableSort,
  shouldApplyTableHeaderFilter,
  type TableSortRule
} from '../src/table-view';

describe('initialTableSort', () => {
  it('复制本地表格排序状态，不污染调用方输入', () => {
    const orderBy: TableSortRule[] = [
      { field: 'hidden_metric', direction: 'desc' },
      { field: 'visible_dimension', direction: 'asc' }
    ];

    const sort = initialTableSort(orderBy);

    expect(sort).toEqual(orderBy);
    expect(sort).not.toBe(orderBy);
  });
});

describe('table header date range draft', () => {
  it('只有完整范围或清空可写入查询通道', () => {
    expect(
      shouldApplyTableHeaderFilter({
        mode: 'dateRange',
        from: '2026-07-01',
        to: ''
      })
    ).toBe(false);
    expect(
      shouldApplyTableHeaderFilter({
        mode: 'dateRange',
        from: '2026-07-01',
        to: '2026-07-20'
      })
    ).toBe(true);
    expect(shouldApplyTableHeaderFilter(null)).toBe(true);
  });

});
