import { describe, expect, it } from 'vitest';
import { validate } from '@metriccanvas/page';

describe('指标卡页面', () => {
  it('拒绝指标卡行引用数据槽契约外的字段', () => {
    const document = {
      schemaVersion: '5.0',
      id: 'sales-summary',
      dataSources: {
        sales: {
          fields: {
            gmv: {
              queryField: 'gmv',
              type: 'number',
              role: 'measure'
            }
          },
          source: {
            type: 'query',
            query: {
              language: 'dqe',
              body: {
                dsl_list: [
                  {
                    output_dims: [],
                    output_metrics: ['gmv']
                  }
                ]
              }
            }
          }
        }
      },
      sections: [
        {
          id: 'overview',
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

  it('值级链接必须绑定至少一个 navigate 动作', () => {
    const document: any = {
      schemaVersion: '5.4',
      id: 'metric-row-link-contract',
      dataSources: {
        summary: {
          fields: {
            count: { type: 'number', role: 'measure', label: '机会点数' }
          },
          source: { type: 'inline', rows: [{ count: 12 }] }
        }
      },
      sections: [{
        id: 'overview',
        components: [{
          id: 'opportunity',
          type: 'metricCard',
          layout: { span: 12 },
          data: { main: 'summary' },
          props: { rows: [{ label: '机会点数', valueField: 'count', link: true }] }
        }]
      }]
    };

    expect(validate(document)).toContainEqual({
      type: 'SCHEMA_ERROR',
      path: '/sections/0/components/0/props/rows/0/link',
      message: '指标值链接必须至少声明一个 navigate 动作'
    });

    document.sections[0].components[0].props.actions = [
      { on: 'click', navigate: { page: 'ioc-opportunity-analysis' } }
    ];
    expect(validate(document)).toEqual([]);
  });
});
