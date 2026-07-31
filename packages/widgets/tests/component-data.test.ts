import { describe, expect, it } from 'vitest';
import type { MetricDataSlots } from '../src/component-data';
import { fieldLabel, fieldValue, resolveField } from '../src/component-data';

const data: MetricDataSlots = {
  main: {
    snapshot: { status: 'ready', rows: [{ actual: 120 }] },
    fields: {
      actual: {
        type: 'number',
        role: 'measure',
        label: '实际值',
        defaultFormat: 'number-grouped'
      }
    }
  },
  compare: {
    snapshot: { status: 'ready', rows: [{ target: 100 }] },
    fields: {
      target: {
        type: 'number',
        role: 'measure',
        label: '目标值',
        defaultFormat: 'number'
      }
    }
  }
};

describe('component named data slots', () => {
  it('字符串绑定固定解析到 main 槽', () => {
    expect(resolveField('actual', data)).toMatchObject({
      data: 'main',
      field: 'actual'
    });
    expect(fieldValue('actual', data)).toBe(120);
    expect(fieldLabel('actual', data)).toBe('实际值');
  });

  it('显式字段绑定从指定命名槽读取值和字段契约', () => {
    const binding = { data: 'compare', field: 'target' };

    expect(fieldValue(binding, data)).toBe(100);
    expect(fieldLabel(binding, data)).toBe('目标值');
    expect(resolveField(binding, data).format).toBe('number');
  });

  it('组件字段绑定格式优先于字段默认展示建议', () => {
    const binding = {
      data: 'main',
      field: 'actual',
      format: 'compact-wan-1' as const
    };

    expect(resolveField(binding, data).format).toBe('compact-wan-1');
    expect(resolveField('actual', data).format).toBe('number-grouped');
  });

  it('标量字段绑定按稳定页面字段显式匹配长表行', () => {
    const longTable: MetricDataSlots = {
      main: {
        snapshot: {
          status: 'ready',
          rows: [
            { 'customer-level': '卓越NA', 'na-customer-count': 15 },
            { 'customer-level': '战略NA', 'na-customer-count': 12 }
          ]
        },
        fields: {
          'customer-level': { type: 'string', role: 'dimension' },
          'na-customer-count': { type: 'number', role: 'measure' }
        }
      }
    };

    expect(
      fieldValue(
        {
          data: 'main',
          field: 'na-customer-count',
          match: { field: 'customer-level', equals: '战略NA' }
        },
        longTable
      )
    ).toBe(12);
  });
});
