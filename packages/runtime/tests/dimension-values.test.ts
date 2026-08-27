import { describe, expect, it } from 'vitest';
import type { DimensionValuesResult, RuntimeDataGateway } from '../src/ports';
import {
  createDimensionValuesLoader,
  dimensionValuesSnapshot,
  type DimensionValuesSnapshots
} from '../src/dimension-values';

interface Deferred {
  resolve(result: DimensionValuesResult): void;
  reject(cause: unknown): void;
}

/** 可手动控制结算时机的候选值网关桩,记录每次调用的取消信号。 */
function deferredGateway() {
  const calls: Array<{ dimension: string; signal?: AbortSignal; deferred: Deferred }> =
    [];
  const gateway: RuntimeDataGateway = {
    async fetchData() {
      throw new Error('候选值测试不应执行主查询');
    },
    fetchDimensionValues(dimension, options) {
      return new Promise<DimensionValuesResult>((resolve, reject) => {
        calls.push({
          dimension,
          ...(options?.signal ? { signal: options.signal } : {}),
          deferred: { resolve, reject }
        });
      });
    }
  };
  return { gateway, calls };
}

function track(loader: ReturnType<typeof createDimensionValuesLoader>) {
  let current: DimensionValuesSnapshots = new Map();
  loader.subscribe((next) => {
    current = next;
  });
  return (dimension: string) => dimensionValuesSnapshot(current, dimension);
}

async function settled(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('筛选候选值加载器', () => {
  it('未请求的维度为 idle,请求后经 loading 进入 ready,候选为空进入 empty', async () => {
    const { gateway, calls } = deferredGateway();
    const loader = createDimensionValuesLoader(gateway);
    const snapshotOf = track(loader);

    expect(snapshotOf('区域')).toEqual({ status: 'idle' });

    loader.load('区域');
    loader.load('模型');
    expect(snapshotOf('区域')).toEqual({ status: 'loading' });

    calls[0]!.deferred.resolve({
      kind: 'values',
      candidates: [
        { value: 'east', label: '华东' },
        { value: 'south', label: '华南' }
      ]
    });
    calls[1]!.deferred.resolve({ kind: 'values', candidates: [] });
    await settled();

    expect(snapshotOf('区域')).toEqual({
      status: 'ready',
      candidates: [
        { value: 'east', label: '华东' },
        { value: 'south', label: '华南' }
      ]
    });
    expect(snapshotOf('模型')).toEqual({ status: 'empty' });
  });

  it('数据网关未声明候选值能力时维度直接不可用,不发起请求', () => {
    const loader = createDimensionValuesLoader({
      async fetchData() {
        return { rows: [] };
      }
    });
    const snapshotOf = track(loader);

    loader.load('区域');

    expect(snapshotOf('区域')).toEqual({ status: 'unavailable' });
  });

  it('端口回答不可用时如实进入 unavailable,不伪装成 empty', async () => {
    const { gateway, calls } = deferredGateway();
    const loader = createDimensionValuesLoader(gateway);
    const snapshotOf = track(loader);

    loader.load('未知维度');
    calls[0]!.deferred.resolve({ kind: 'unavailable' });
    await settled();

    expect(snapshotOf('未知维度')).toEqual({ status: 'unavailable' });
  });

  it('失败保留结构化查询错误分类,未携带分类兜底 UNKNOWN', async () => {
    const { gateway, calls } = deferredGateway();
    const loader = createDimensionValuesLoader(gateway);
    const snapshotOf = track(loader);

    loader.load('区域');
    loader.load('模型');
    calls[0]!.deferred.reject(
      Object.assign(new Error('需要登录后才能执行查询(401)'), {
        code: 'DQE_AUTH_REQUIRED'
      })
    );
    calls[1]!.deferred.reject(new Error('自定义网关的普通异常'));
    await settled();

    expect(snapshotOf('区域')).toEqual({
      status: 'error',
      error: { code: 'DQE_AUTH_REQUIRED', message: '需要登录后才能执行查询(401)' }
    });
    expect(snapshotOf('模型')).toEqual({
      status: 'error',
      error: { code: 'UNKNOWN', message: '自定义网关的普通异常' }
    });
  });

  it('同一维度按会话幂等:重复 load 不重复请求', () => {
    const { gateway, calls } = deferredGateway();
    const loader = createDimensionValuesLoader(gateway);

    loader.load('区域');
    loader.load('区域');

    expect(calls).toHaveLength(1);
  });

  it('dispose 取消在途请求,过期结果不覆盖已发布状态', async () => {
    const { gateway, calls } = deferredGateway();
    const loader = createDimensionValuesLoader(gateway);
    const snapshotOf = track(loader);

    loader.load('区域');
    expect(calls[0]!.signal?.aborted).toBe(false);

    loader.dispose();
    expect(calls[0]!.signal?.aborted).toBe(true);

    // 上游无视取消、迟到返回:结果必须被丢弃,状态停在取消时刻。
    calls[0]!.deferred.resolve({
      kind: 'values',
      candidates: [{ value: 'late', label: '迟到值' }]
    });
    await settled();
    expect(snapshotOf('区域')).toEqual({ status: 'loading' });

    // dispose 后不再接受新的加载。
    loader.load('模型');
    expect(calls).toHaveLength(1);
    expect(snapshotOf('模型')).toEqual({ status: 'idle' });
  });

  it('订阅方回调异常被隔离,其他订阅方继续接收状态', async () => {
    const { gateway, calls } = deferredGateway();
    const loader = createDimensionValuesLoader(gateway);
    loader.subscribe(() => {
      throw new Error('订阅方异常');
    });
    const snapshotOf = track(loader);

    loader.load('区域');
    calls[0]!.deferred.resolve({
      kind: 'values',
      candidates: [{ value: 'east', label: '华东' }]
    });
    await settled();

    expect(snapshotOf('区域')).toEqual({
      status: 'ready',
      candidates: [{ value: 'east', label: '华东' }]
    });
  });
});
