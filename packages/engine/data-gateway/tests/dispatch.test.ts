import { describe, expect, it } from 'vitest';
import type { EffectiveQuery } from '@metriccanvas/page';
import type {
  DimensionValuesResult,
  QueryDiagnosticContext,
  RuntimeDataGateway
} from '@metriccanvas/runtime';
import { DqeGatewayError, createDataGateway } from '../src';

function dqeEffectiveQuery(): EffectiveQuery {
  return {
    language: 'dqe',
    body: { dsl_list: [{ output_dims: ['区域'], output_metrics: ['销售额'] }] },
    fieldMappings: {
      region: { queryField: '区域', type: 'string', role: 'dimension' },
      revenue: { queryField: '销售额', type: 'number', role: 'measure' }
    },
    filterValues: []
  };
}

interface AdapterSpy {
  gateway: RuntimeDataGateway;
  fetchDataCalls: Array<{
    query: EffectiveQuery;
    diagnosticContext?: QueryDiagnosticContext;
    signal?: AbortSignal;
  }>;
  dimensionCalls: Array<{ dimension: string; signal?: AbortSignal }>;
}

function adapterSpy(dimensionValues?: DimensionValuesResult): AdapterSpy {
  const spy: AdapterSpy = {
    fetchDataCalls: [],
    dimensionCalls: [],
    gateway: {
      async fetchData(query, diagnosticContext, signal) {
        spy.fetchDataCalls.push({
          query,
          ...(diagnosticContext ? { diagnosticContext } : {}),
          ...(signal ? { signal } : {})
        });
        return { rows: [{ region: '华东', revenue: 42 }], totalCount: 1 };
      },
      // 候选值能力可选:未提供结果的适配器不声明该端口。
      ...(dimensionValues
        ? {
            async fetchDimensionValues(
              dimension: string,
              options?: { signal?: AbortSignal }
            ) {
              spy.dimensionCalls.push({
                dimension,
                ...(options?.signal ? { signal: options.signal } : {})
              });
              return dimensionValues;
            }
          }
        : {})
    }
  };
  return spy;
}

describe('数据网关按 language 分发注册点', () => {
  it('dqe 生效查询路由到 dqe 适配器,查询、诊断上下文与取消信号原样透传', async () => {
    const dqe = adapterSpy();
    const gateway = createDataGateway({ dqe: dqe.gateway });
    const query = dqeEffectiveQuery();
    const diagnostics: QueryDiagnosticContext = {
      pageId: 'page-1',
      dataSourceIds: ['sales']
    };
    const controller = new AbortController();

    const result = await gateway.fetchData(query, diagnostics, controller.signal);

    expect(result).toEqual({
      rows: [{ region: '华东', revenue: 42 }],
      totalCount: 1
    });
    expect(dqe.fetchDataCalls).toHaveLength(1);
    expect(dqe.fetchDataCalls[0]!.query).toBe(query);
    expect(dqe.fetchDataCalls[0]!.diagnosticContext).toBe(diagnostics);
    expect(dqe.fetchDataCalls[0]!.signal).toBe(controller.signal);
  });

  it('闭集之外的 language 失败关闭为查询声明错误,不触达任何适配器', async () => {
    const dqe = adapterSpy();
    const gateway = createDataGateway({ dqe: dqe.gateway });
    const outside = {
      ...dqeEffectiveQuery(),
      language: 'graphql'
    } as unknown as EffectiveQuery;

    const rejection = await gateway.fetchData(outside).then(
      () => undefined,
      (cause: unknown) => cause
    );

    expect(rejection).toBeInstanceOf(DqeGatewayError);
    expect((rejection as DqeGatewayError).code).toBe('DQE_CONFIG_ERROR');
    // 错误消息与 detail 不回显集外 language 原文(不可信内容不进错误对象)。
    expect((rejection as DqeGatewayError).message).not.toContain('graphql');
    expect(JSON.stringify((rejection as DqeGatewayError).detail)).not.toContain(
      'graphql'
    );
    expect(dqe.fetchDataCalls).toHaveLength(0);
  });

  it('维度候选值按声明能力的适配器合并去重,取消信号原样透传', async () => {
    const dqe = adapterSpy({
      kind: 'values',
      candidates: [
        { value: 'east', label: '华东' },
        { value: 'south', label: '华南' },
        { value: 'east', label: '重复华东' }
      ]
    });
    const gateway = createDataGateway({ dqe: dqe.gateway });
    const controller = new AbortController();

    await expect(
      gateway.fetchDimensionValues('区域', { signal: controller.signal })
    ).resolves.toEqual({
      kind: 'values',
      candidates: [
        { value: 'east', label: '华东' },
        { value: 'south', label: '华南' }
      ]
    });
    expect(dqe.dimensionCalls).toEqual([
      { dimension: '区域', signal: controller.signal }
    ]);
  });

  it('没有适配器声明候选值能力时返回不可用,不触达任何适配器', async () => {
    const dqe = adapterSpy();
    const gateway = createDataGateway({ dqe: dqe.gateway });

    await expect(gateway.fetchDimensionValues('区域')).resolves.toEqual({
      kind: 'unavailable'
    });
    expect(dqe.dimensionCalls).toEqual([]);
  });

  it('声明能力的适配器回答不可用时如实返回不可用,不伪装成空结果', async () => {
    const dqe = adapterSpy({ kind: 'unavailable' });
    const gateway = createDataGateway({ dqe: dqe.gateway });

    await expect(gateway.fetchDimensionValues('未知维度')).resolves.toEqual({
      kind: 'unavailable'
    });
    expect(dqe.dimensionCalls).toEqual([{ dimension: '未知维度' }]);
  });

  it('候选值查询失败按结构化查询错误分类原样拒绝', async () => {
    const gateway = createDataGateway({
      dqe: {
        async fetchData() {
          return { rows: [] };
        },
        async fetchDimensionValues() {
          throw new DqeGatewayError('DQE_TIMEOUT', 'DQE 请求超过 30000ms 未返回');
        }
      }
    });

    const rejection = await gateway.fetchDimensionValues('区域').then(
      () => undefined,
      (cause: unknown) => cause
    );
    expect(rejection).toBeInstanceOf(DqeGatewayError);
    expect((rejection as DqeGatewayError).code).toBe('DQE_TIMEOUT');
  });
});
