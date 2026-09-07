import { describe, expect, it } from 'vitest';
import type { Component, DataSnapshot, QueryError } from '@metriccanvas/page';
import {
  hostRenderSnapshot,
  queryErrorView,
  renderableDataSnapshot
} from '../src/widget-host-state';

describe('renderableDataSnapshot', () => {
  it('不把查询错误投影为就绪快照', () => {
    expect(
      renderableDataSnapshot({
        status: 'error',
        error: { code: 'DQE_TRANSPORT_ERROR', message: 'DQE HTTP 请求失败:404' }
      })
    ).toBeUndefined();
  });

  it('把空快照投影为空行就绪快照并保留总数', () => {
    expect(renderableDataSnapshot({ status: 'empty', totalCount: 0 })).toEqual({
      status: 'ready',
      rows: [],
      totalCount: 0
    });
  });

  it('保留就绪快照，加载态不进入组件内容', () => {
    const ready = { status: 'ready' as const, rows: [{ amount: 12 }], totalCount: 1 };

    expect(renderableDataSnapshot(ready)).toBe(ready);
    expect(renderableDataSnapshot({ status: 'loading' })).toBeUndefined();
  });
});

describe('hostRenderSnapshot:多数据槽 → 单一宿主态', () => {
  const component = (type: string, data: Record<string, string>): Component =>
    ({ id: 'widget', type, layout: { span: 6 }, data, props: {} }) as unknown as Component;
  const slots = (entries: Record<string, DataSnapshot>) =>
    new Map(Object.entries(entries));

  const error: DataSnapshot = {
    status: 'error',
    error: { code: 'DQE_TIMEOUT', message: '查询超时' }
  };

  it('任一槽错误即整体错误，错误优先于加载中', () => {
    expect(
      hostRenderSnapshot(
        component('metricCard', { main: 'a', compare: 'b' }),
        slots({ main: { status: 'loading' }, compare: error })
      )
    ).toBe(error);
  });

  it('任一槽加载中即整体加载中', () => {
    expect(
      hostRenderSnapshot(
        component('metricCard', { main: 'a', compare: 'b' }),
        slots({ main: { status: 'ready', rows: [{}] }, compare: { status: 'loading' } })
      )
    ).toEqual({ status: 'loading' });
  });

  it('缺席的数据槽按加载中处理', () => {
    expect(
      hostRenderSnapshot(component('metricCard', { main: 'a' }), slots({}))
    ).toEqual({ status: 'loading' });
  });

  it('非表格组件的 main 空结果投影为空态', () => {
    expect(
      hostRenderSnapshot(
        component('barChart', { main: 'a' }),
        slots({ main: { status: 'empty' } })
      )
    ).toEqual({ status: 'empty' });
  });

  it('表格空结果仍要渲染表头，因此不投影为空态', () => {
    expect(
      hostRenderSnapshot(
        component('table', { main: 'a' }),
        slots({ main: { status: 'empty' } })
      )
    ).toEqual({ status: 'ready', rows: [] });
  });
});

describe('queryErrorView:错误分类 → 呈现语义(表驱动,issue #51)', () => {
  const RETRY = '查询暂时不可用，请稍后重试';
  const REAUTH = '登录状态已失效，请重新登录后重试';
  const FAIL = '查询失败';

  const cases: Array<[QueryError['code'], string]> = [
    ['DQE_CANCELLED', RETRY],
    ['DQE_TIMEOUT', RETRY],
    ['DQE_TRANSPORT_ERROR', RETRY],
    ['DQE_AUTH_REQUIRED', REAUTH],
    ['DQE_FORBIDDEN', FAIL],
    ['DQE_QUERY_REJECTED', FAIL],
    ['DQE_ENVELOPE_ERROR', FAIL],
    ['DQE_ITEM_ERROR', FAIL],
    ['DQE_CONFIG_ERROR', FAIL],
    ['DQE_FILTER_BINDING_ERROR', FAIL],
    ['DQE_FIELD_MAPPING_ERROR', FAIL],
    ['DQE_ROW_CONTRACT_ERROR', FAIL],
    ['UNKNOWN', FAIL]
  ];

  for (const [code, headline] of cases) {
    it(`${code} → ${headline}`, () => {
      expect(queryErrorView({ code, message: '脱值消息' })).toEqual({
        headline,
        code,
        message: '脱值消息'
      });
    });
  }
});
