import { describe, expect, it } from 'vitest';
import { validate } from '@metriccanvas/page';

describe('指标卡页面', () => {
  it('拒绝同时引用多个指标,避免统一运行时静默只呈现第一个', () => {
    const document = {
      formatVersion: '1.0',
      id: 'sales-summary',
      title: '销售总览',
      layout: { type: 'grid', columns: 12 },
      widgets: [
        {
          id: 'w-sales',
          type: 'metricCard',
          position: { x: 0, y: 0, w: 3, h: 2 },
          query: { metrics: ['gmv', 'order-count'] }
        }
      ]
    };

    expect(validate(document)).toContainEqual({
      type: 'SCHEMA_ERROR',
      path: '/widgets/0/query/metrics',
      message: '指标卡只支持单指标,收到 2 个'
    });
  });
});
