import type { OrderByRule } from '@metriccanvas/page';
import { describe, expect, it } from 'vitest';
import {
  initialTableSort,
  shouldApplyTableHeaderFilter,
  tableHeaderFilterConditions
} from '../src/table-view';

describe('initialTableSort', () => {
  it('完整保留 query.orderBy,不按可交互列裁剪声明默认排序', () => {
    const orderBy: OrderByRule[] = [
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

  it('防御性忽略单端草稿,不生成 between 条件', () => {
    expect(
      tableHeaderFilterConditions({
        created_at: {
          mode: 'dateRange',
          from: '2026-07-01',
          to: ''
        },
        region: { mode: 'select', values: ['华东'] }
      })
    ).toEqual([
      {
        dimension: 'region',
        operator: 'in',
        value: ['华东']
      }
    ]);
  });
});
