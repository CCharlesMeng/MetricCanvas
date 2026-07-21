import { describe, expect, it } from 'vitest';
import { validate } from '@metriccanvas/page';

describe('指标卡页面', () => {
  it('拒绝指标卡行引用数据槽契约外的字段', () => {
    const document = {
      schemaVersion: '1.0',
      id: 'sales-summary',
      dataSources: {
        sales: {
          fields: {
            gmv: { type: 'number', role: 'metric' }
          },
          source: {
            type: 'query',
            query: { metrics: ['gmv'] }
          }
        }
      },
      sections: [
        {
          id: 'overview',
          layout: { type: 'grid', columns: 12 },
          components: [
            {
              id: 'w-sales',
              type: 'metricCard',
              layout: { span: 3 },
              data: { main: 'sales' },
              props: {
                rows: [{ label: '订单数', valueField: 'order-count' }]
              }
            }
          ]
        }
      ]
    };

    expect(validate(document)).toContainEqual({
      type: 'SCHEMA_ERROR',
      path: '/sections/0/components/0/props/rows/0/valueField',
      message: '字段 order-count 不在数据槽 main 的数据源 sales 中'
    });
  });
});
