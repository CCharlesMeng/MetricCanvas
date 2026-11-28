import type { Page } from '@metriccanvas/page';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  debugWarn: vi.fn(),
  readOverride: undefined as (() => AsyncGenerator<never>) | undefined,
}));

vi.mock('@metriccanvas/data-execution/runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@metriccanvas/data-execution/runtime')>();
  return {
    ...actual,
    debugWarn: (...args: unknown[]) => mocks.debugWarn(...args),
    createSourceProgram: (
      page: Parameters<typeof actual.createSourceProgram>[0],
      config: Parameters<typeof actual.createSourceProgram>[1],
    ) => {
      const program = actual.createSourceProgram(page, config);
      if (!mocks.readOverride) return program;
      const read = mocks.readOverride;
      return { ...program, read };
    },
  };
});

import { createFilterState } from '../src/filter-state';
import { orchestrate, type PageDataSnapshots } from '../src/orchestrator';
import type { DataGateway, RuntimeDataGateway } from '../src/ports';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function queryPage(withCandidateFilter = false): Page {
  return {
    schemaVersion: '6.5',
    id: 'orchestrator-error-preservation',
    filters: withCandidateFilter
      ? [
          {
            id: 'region-filter',
            type: 'dimension',
            dimension: 'region',
            label: '区域',
            selection: { mode: 'single' },
          },
        ]
      : [],
    dataSources: {
      sales: {
        fields: {
          region: {
            queryField: '地区',
            type: 'string',
            role: 'dimension',
            nullable: false,
          },
          revenue: {
            queryField: '收入',
            type: 'number',
            role: 'measure',
            nullable: false,
          },
        },
        source: {
          type: 'query',
          query: {
            language: 'dqe',
            body: {
              dsl_list: [
                {
                  output_dims: ['地区'],
                  output_metrics: ['收入'],
                  filter: { dims: [], metrics: [] },
                  order: {},
                },
              ],
            },
            ...(withCandidateFilter
              ? {
                  filterBindings: {
                    'region-filter': { target: 'dimension', queryField: '地区' },
                  },
                }
              : {}),
          },
        },
      },
    },
    sections: [
      {
        id: 'main',
        components: [
          {
            id: 'sales-table',
            type: 'table',
            layout: { span: 12 },
            data: { main: 'sales' },
            props: {
              columns: [
                { field: 'region', title: '地区' },
                { field: 'revenue', title: '收入' },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe('orchestrator 错误分类与诊断保留', () => {
  afterEach(() => {
    mocks.readOverride = undefined;
    mocks.debugWarn.mockReset();
  });

  it.each([
    ['DQE_AUTH_REQUIRED', '需要登录后才能执行查询(401)'],
    ['DQE_TRANSPORT_ERROR', 'DQE 请求不可达: ECONNRESET'],
    ['DQE_QUERY_REJECTED', '查询条件被上游拒绝'],
    ['DQE_ROW_CONTRACT_ERROR', '响应缺少必须映射字段'],
  ] as const)(
    '当 program.read 抛出 %s 时保留结构化错误码与诊断消息，不吞没为 UNKNOWN',
    async (code, message) => {
      // biome-ignore lint/correctness/useYield: intentionally throws before yielding to hit orchestrator catch
      mocks.readOverride = async function* failingRead() {
        throw Object.assign(new Error(message), { code });
      };

      const gateway: DataGateway = {
        async fetchData() {
          return { rows: [] };
        },
      };
      const pushes: PageDataSnapshots[] = [];
      const unsubscribe = orchestrate(queryPage(), gateway).subscribe((value) =>
        pushes.push(value),
      );
      await flush();

      expect(pushes.at(-1)?.get('sales')).toEqual({
        status: 'error',
        error: { code, message },
      });
      unsubscribe();
    },
  );

  it('当 program.read 抛出未分类原始 Error 或空消息错误时兜底 UNKNOWN 与默认诊断', async () => {
    for (const [cause, expectedMessage] of [
      [new Error('底层流异常'), '底层流异常'],
      [new Error(''), '页面取数未完成'],
    ] as const) {
      // biome-ignore lint/correctness/useYield: intentionally throws before yielding to hit orchestrator catch
      mocks.readOverride = async function* failingRead() {
        throw cause;
      };

      const gateway: DataGateway = {
        async fetchData() {
          return { rows: [] };
        },
      };
      const pushes: PageDataSnapshots[] = [];
      const unsubscribe = orchestrate(queryPage(), gateway).subscribe((value) =>
        pushes.push(value),
      );
      await flush();

      expect(pushes.at(-1)?.get('sales')).toEqual({
        status: 'error',
        error: { code: 'UNKNOWN', message: expectedMessage },
      });
      unsubscribe();
    }
  });

  it('筛选候选校验失败时保留原始 DQE 错误码与诊断消息', async () => {
    const gateway: RuntimeDataGateway = {
      async fetchData() {
        return { rows: [] };
      },
      async fetchDimensionValues() {
        throw Object.assign(new Error('候选端口鉴权已过期(401)'), {
          code: 'DQE_AUTH_REQUIRED',
        });
      },
    };
    const filters = createFilterState();
    const pushes: PageDataSnapshots[] = [];
    const unsubscribe = orchestrate(queryPage(true), gateway, filters).subscribe((value) =>
      pushes.push(value),
    );
    filters.write('region-filter', {
      type: 'dimension',
      dimension: 'region',
      values: ['华东'],
    });
    await flush();

    expect(pushes.at(-1)?.get('sales')).toEqual({
      status: 'error',
      error: {
        code: 'DQE_AUTH_REQUIRED',
        message: '候选端口鉴权已过期(401)',
      },
    });
    unsubscribe();
  });
});
