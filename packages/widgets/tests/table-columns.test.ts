import type { TableColumnNode } from '@metriccanvas/page';
import { describe, expect, it } from 'vitest';
import { buildTableColumnLayout } from '../src/table-columns';

describe('buildTableColumnLayout', () => {
  it('兼容存量 flat columns,生成单行表头与同序叶子', () => {
    const columns: TableColumnNode[] = [
      { field: 'region', title: '区域', fixed: 'left' },
      { field: 'gmv', title: '成交额', align: 'right' }
    ];

    const layout = buildTableColumnLayout(columns);

    expect(layout.leaves.map((column) => column.field)).toEqual(['region', 'gmv']);
    expect(
      layout.headerRows.map((row) =>
        row.map(({ kind, title, colspan, rowspan }) => ({ kind, title, colspan, rowspan }))
      )
    ).toEqual([
      [
        { kind: 'field', title: '区域', colspan: 1, rowspan: 1 },
        { kind: 'field', title: '成交额', colspan: 1, rowspan: 1 }
      ]
    ]);
  });

  it('递归列组生成 colspan,较浅叶子用 rowspan 补齐', () => {
    const columns: TableColumnNode[] = [
      { field: 'region', title: '区域' },
      {
        kind: 'group',
        id: 'tokens',
        title: 'Tokens',
        children: [
          { field: 'today', title: '当日' },
          {
            kind: 'group',
            id: 'change',
            title: '变化',
            children: [
              { field: 'day-change', title: '较昨日' },
              { field: 'month-change', title: '月环比' }
            ]
          }
        ]
      }
    ];

    const layout = buildTableColumnLayout(columns);

    expect(layout.leaves.map((column) => column.field)).toEqual([
      'region',
      'today',
      'day-change',
      'month-change'
    ]);
    expect(
      layout.headerRows.map((row) =>
        row.map(({ kind, title, colspan, rowspan }) => ({ kind, title, colspan, rowspan }))
      )
    ).toEqual([
      [
        { kind: 'field', title: '区域', colspan: 1, rowspan: 3 },
        { kind: 'group', title: 'Tokens', colspan: 3, rowspan: 1 }
      ],
      [
        { kind: 'field', title: '当日', colspan: 1, rowspan: 2 },
        { kind: 'group', title: '变化', colspan: 2, rowspan: 1 }
      ],
      [
        { kind: 'field', title: '较昨日', colspan: 1, rowspan: 1 },
        { kind: 'field', title: '月环比', colspan: 1, rowspan: 1 }
      ]
    ]);
  });

  it('忽略空列组,不生成 colspan=0 的表头', () => {
    const layout = buildTableColumnLayout([
      { kind: 'group', id: 'empty', title: '空组', children: [] },
      { field: 'name' }
    ]);

    expect(layout.leaves.map((column) => column.field)).toEqual(['name']);
    expect(layout.headerRows).toHaveLength(1);
    expect(layout.headerRows[0]).toHaveLength(1);
  });

  it('列标题缺省时继承数据源字段标签', () => {
    const layout = buildTableColumnLayout(
      [{ field: 'tokens_consumed' }],
      {
        tokens_consumed: {
          type: 'number',
          role: 'metric',
          label: 'Tokens消耗量',
          format: 'compact-yi-1'
        }
      }
    );

    expect(layout.headerRows[0][0].title).toBe('Tokens消耗量');
  });
});
