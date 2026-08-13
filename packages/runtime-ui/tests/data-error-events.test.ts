import { describe, expect, it } from 'vitest';
import { QUERY_ERROR_CODES, type DataSnapshot } from '@metriccanvas/page';
import { collectDataErrors } from '../src/data-error-events';

function snapshots(entries: Record<string, DataSnapshot>): Map<string, DataSnapshot> {
  return new Map(Object.entries(entries));
}

describe('嵌入事件面:数据快照错误 → data-error 事件(表驱动,issue #51)', () => {
  it('每个稳定分类原样进入事件,宿主不解析错误字符串', () => {
    for (const code of [...QUERY_ERROR_CODES, 'UNKNOWN'] as const) {
      const events = collectDataErrors(
        new Map(),
        snapshots({
          sales: { status: 'error', error: { code, message: `分类 ${code}` } }
        })
      );
      expect(events).toEqual([
        { type: 'data-error', dataSourceId: 'sales', code, message: `分类 ${code}` }
      ]);
    }
  });

  it('同一错误只上抛一次;错误内容变化再次上抛', () => {
    const emitted = new Map<string, string>();
    const failing = snapshots({
      sales: {
        status: 'error',
        error: { code: 'DQE_TIMEOUT', message: 'DQE 请求超过 30000ms 未返回' }
      }
    });

    expect(collectDataErrors(emitted, failing)).toHaveLength(1);
    expect(collectDataErrors(emitted, failing)).toHaveLength(0);

    const changed = snapshots({
      sales: {
        status: 'error',
        error: { code: 'DQE_AUTH_REQUIRED', message: '需要登录后才能执行查询(401)' }
      }
    });
    expect(collectDataErrors(emitted, changed)).toEqual([
      {
        type: 'data-error',
        dataSourceId: 'sales',
        code: 'DQE_AUTH_REQUIRED',
        message: '需要登录后才能执行查询(401)'
      }
    ]);
  });

  it('离开错误态后再次失败会重新上抛', () => {
    const emitted = new Map<string, string>();
    const failing = snapshots({
      sales: {
        status: 'error',
        error: { code: 'DQE_TRANSPORT_ERROR', message: 'DQE HTTP 请求失败:500' }
      }
    });

    expect(collectDataErrors(emitted, failing)).toHaveLength(1);
    expect(
      collectDataErrors(emitted, snapshots({ sales: { status: 'ready', rows: [] } }))
    ).toHaveLength(0);
    expect(collectDataErrors(emitted, failing)).toHaveLength(1);
  });

  it('加载、就绪与空态不产生事件;多数据源分别上抛', () => {
    const events = collectDataErrors(
      new Map(),
      snapshots({
        loading: { status: 'loading' },
        ready: { status: 'ready', rows: [{ value: 1 }] },
        empty: { status: 'empty' },
        broken: {
          status: 'error',
          error: { code: 'DQE_QUERY_REJECTED', message: 'DQE 拒绝执行查询项:FAILED' }
        },
        forbidden: {
          status: 'error',
          error: { code: 'DQE_FORBIDDEN', message: '没有执行该查询的权限(403)' }
        }
      })
    );
    expect(events.map((event) => [event.dataSourceId, event.code])).toEqual([
      ['broken', 'DQE_QUERY_REJECTED'],
      ['forbidden', 'DQE_FORBIDDEN']
    ]);
  });
});
