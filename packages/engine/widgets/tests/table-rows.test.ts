import { describe, expect, it } from 'vitest';
import type { NamedDataSlots } from '../src/shared/component-data';
import {
  resolveField,
  semanticHtmlFieldPresentation
} from '../src/shared/component-data';
import { alignTableRows, alignedFieldValue } from '../src/components/table/rows';

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

describe('表格 semanticHtml/detail 单元格', () => {
  const semanticData: NamedDataSlots = {
    main: {
      fields: {
        reason: { type: 'semanticHtml', role: 'detail' },
        amount: { type: 'money', role: 'measure', currency: 'CNY' }
      },
      snapshot: {
        status: 'ready',
        rows: [{ reason: '下降<data>-12345.67</data>', amount: -12345.67 }]
      }
    }
  };

  it('只为 semanticHtml/detail 生成安全组件入参并透传 format 与 signed', () => {
    const resolved = resolveField(
      { data: 'main', field: 'reason', format: 'cny-adaptive' },
      semanticData
    );

    expect(
      semanticHtmlFieldPresentation(
        resolved,
        semanticData.main?.snapshot.rows[0]?.reason,
        'signed'
      )
    ).toEqual({
      source: '下降<data>-12345.67</data>',
      format: 'cny-adaptive',
      visual: 'signed'
    });
    expect(
      semanticHtmlFieldPresentation(
        resolveField('amount', semanticData),
        semanticData.main?.snapshot.rows[0]?.amount,
        'signed'
      )
    ).toBeUndefined();
  });

  it('省略 format 与 visual 时保留未指定状态', () => {
    expect(
      semanticHtmlFieldPresentation(
        resolveField('reason', semanticData),
        semanticData.main?.snapshot.rows[0]?.reason
      )
    ).toEqual({
      source: '下降<data>-12345.67</data>',
      format: undefined,
      visual: undefined
    });
  });
});
