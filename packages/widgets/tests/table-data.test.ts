import { describe, expect, it } from 'vitest';
import type { NamedDataSlots } from '../src/component-data';
import { alignTableRows, alignedFieldValue } from '../src/table-data';

const fields = {
  'representative-office': { type: 'string', role: 'dimension' }
} as const;

describe('表格多数据槽行对齐', () => {
  it('保持主数据槽顺序，并按 rowKey 读取其他数据槽字段', () => {
    const data: NamedDataSlots = {
      main: {
        fields: {
          ...fields,
          'inspection-na-missing': { type: 'number', role: 'measure' }
        },
        snapshot: {
          status: 'ready',
          rows: [
            { 'representative-office': '上海代表处', 'inspection-na-missing': 73 },
            { 'representative-office': '北京代表处', 'inspection-na-missing': 46 }
          ]
        }
      },
      top100: {
        fields: {
          ...fields,
          'inspection-top-missing-rate': { type: 'string', role: 'measure' }
        },
        snapshot: {
          status: 'ready',
          rows: [
            { 'representative-office': '北京代表处', 'inspection-top-missing-rate': '41.67%' },
            { 'representative-office': '上海代表处', 'inspection-top-missing-rate': '25.00%' }
          ]
        }
      }
    };

    const rows = alignTableRows(data, 'representative-office');

    expect(rows.map((row) => row.main['representative-office'])).toEqual([
      '上海代表处',
      '北京代表处'
    ]);
    expect(
      alignedFieldValue(
        { data: 'top100', field: 'inspection-top-missing-rate' },
        data,
        rows[0]!
      )
    ).toBe('25.00%');
  });

  it('其他数据槽缺少 rowKey 时返回空值，不伪造零值', () => {
    const data: NamedDataSlots = {
      main: {
        fields,
        snapshot: {
          status: 'ready',
          rows: [{ 'representative-office': '四川代表处' }]
        }
      },
      top100: {
        fields,
        snapshot: { status: 'ready', rows: [] }
      }
    };
    const row = alignTableRows(data, 'representative-office')[0]!;

    expect(
      alignedFieldValue(
        { data: 'top100', field: 'representative-office' },
        data,
        row
      )
    ).toBeUndefined();
  });
});
