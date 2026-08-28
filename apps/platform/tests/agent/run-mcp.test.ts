import { describe, expect, it } from 'vitest';
import {
  EXECUTE_DATA_REQUEST_UNIT_TOOL,
  type DataContextSnapshot,
  type McpClient
} from '@metriccanvas/mcp';
import type { EffectiveQuery } from '@metriccanvas/page';
import { createMemoryPageLifecycle } from '@metriccanvas/page-lifecycle';
import type { TemplateLibrary } from '@metriccanvas/template-library';
import {
  createRunAwareUnitQueryExecutor,
  createRunScopedAgentRunner,
  createRunScopedMcpConnector,
  type RunScopedMcpDependencies
} from '../../src/lib/server/agent/run-mcp';

/** 与 packages/mcp 契约测试同款的最小数据上下文:一个可执行的取数单元语义面。 */
const snapshot: DataContextSnapshot = {
  formatVersion: '1.1',
  id: 'run-mcp-context',
  version: 'context-v1',
  generatedAt: '2026-08-12T00:00:00.000Z',
  source: 'test',
  executionEnvironments: [{
    id: 'dqe-test',
    name: '测试 DQE',
    language: 'dqe',
    endpointRef: 'test',
    schemas: [{
      id: 'operations-analytics',
      name: '运营分析',
      description: 'Tokens 服务的用量运营分析',
      metrics: [{
        name: 'Tokens消耗量',
        type: 'number',
        description: '统计期内消耗的 Token 总量',
        unit: 'Token',
        additivity: '可加',
        timeAggregation: '求和',
        isRatio: false,
        dimensions: ['区域'],
        nullable: false,
        sensitive: false
      }],
      objects: [{
        id: 'ops-summary',
        name: '运营汇总',
        kind: 'dataset',
        description: '按区域查询运营汇总',
        fields: [
          {
            name: '区域',
            type: 'string',
            description: '业务归属区域。取值域:华东、华南、华北。',
            roleHints: ['dimension'],
            nullable: false,
            sensitive: false
          }
        ]
      }],
      relationships: [],
      verifiedQueries: []
    }],
    constraints: {
      readOnly: true,
      maxRows: 1000,
      maxColumns: 20,
      maxQueriesPerBatch: 5,
      timeoutMs: 30000
    },
    security: { scope: 'test' }
  }]
};

const executableUnit = {
  dataSourceId: 'ops-tokens',
  fields: {
    region: { queryField: '区域', type: 'string', role: 'dimension', label: '区域' },
    tokens: {
      queryField: 'Tokens消耗量',
      type: 'number',
      role: 'measure',
      label: 'Tokens消耗量',
      unit: 'Token'
    }
  },
  query: {
    language: 'dqe',
    body: {
      dsl_list: [{
        output_dims: ['区域'],
        output_metrics: ['Tokens消耗量'],
        filter: { dims: [], metrics: [] },
        order: {}
      }]
    }
  }
};

function connectorDependencies(overrides: Partial<RunScopedMcpDependencies> = {}): {
  dependencies: RunScopedMcpDependencies;
  searchContexts: Array<{ query: string; actorId: string }>;
  executeSignals: Array<AbortSignal | undefined>;
} {
  const searchContexts: Array<{ query: string; actorId: string }> = [];
  const executeSignals: Array<AbortSignal | undefined> = [];
  const templates: Pick<TemplateLibrary, 'search'> = {
    async search(query, context) {
      searchContexts.push({ query: query.query, actorId: context.actorId });
      return { matches: [] };
    }
  };
  const dependencies: RunScopedMcpDependencies = {
    dataContext: {
      current: async () => snapshot,
      search: async () => ({ dataContextVersion: snapshot.version, matches: [] })
    },
    lifecycle: createMemoryPageLifecycle({
      dataContext: { current: async () => ({ version: snapshot.version }) },
      urls: { confirmation: (requestId, token) => `http://platform.local/${requestId}?token=${token}` }
    }),
    templates,
    previewUrl: ({ pageId, revisionId }) => `http://runtime.local/pages/${pageId}?revision=${revisionId}`,
    executeDataRequestUnitQuery: async (query, signal) => {
      executeSignals.push(signal);
      return { rows: [{ region: '华东', tokens: 1200 }], totalCount: 1 };
    },
    ...overrides
  };
  return { dependencies, searchContexts, executeSignals };
}

async function callSearchTemplates(client: McpClient, query: string): Promise<void> {
  const result = await client.callTool({
    name: 'search_templates',
    arguments: { query, limit: 5 }
  });
  expect(result.isError).not.toBe(true);
}

describe('按 run 隔离的 MCP 接线:身份随运行传递', () => {
  it('并发运行各自携带自己的身份,互不覆盖', async () => {
    const { dependencies, searchContexts } = connectorDependencies();
    const connect = createRunScopedMcpConnector(dependencies);

    const runA = await connect({
      identity: { actorId: 'developer-1', clientId: 'workbench', roles: [] }
    });
    const runB = await connect({
      identity: { actorId: 'developer-2', clientId: 'workbench', roles: [] }
    });
    try {
      // 交错调用:旧实现(模块级可变引用)在 B 建立后 A 的后续调用会拿到 B 的身份。
      await callSearchTemplates(runA.client, 'a-1');
      await callSearchTemplates(runB.client, 'b-1');
      await callSearchTemplates(runA.client, 'a-2');
      await Promise.all([
        callSearchTemplates(runA.client, 'a-3'),
        callSearchTemplates(runB.client, 'b-2')
      ]);
    } finally {
      await runA.close();
      await runB.close();
    }

    const byQuery = Object.fromEntries(
      searchContexts.map((entry) => [entry.query, entry.actorId])
    );
    expect(byQuery).toEqual({
      'a-1': 'developer-1',
      'a-2': 'developer-1',
      'a-3': 'developer-1',
      'b-1': 'developer-2',
      'b-2': 'developer-2'
    });
  });

  it('运行取消信号原样传入创作期查询执行端口', async () => {
    const { dependencies, executeSignals } = connectorDependencies();
    const connect = createRunScopedMcpConnector(dependencies);
    const controller = new AbortController();
    const run = await connect({
      identity: { actorId: 'developer-1', clientId: 'workbench', roles: [] },
      signal: controller.signal
    });
    try {
      const result = await run.client.callTool({
        name: EXECUTE_DATA_REQUEST_UNIT_TOOL,
        arguments: executableUnit
      });
      expect(result.isError).not.toBe(true);
    } finally {
      await run.close();
    }

    expect(executeSignals).toHaveLength(1);
    expect(executeSignals[0]).toBe(controller.signal);
  });

  it('取数单元验真的单次运行执行上限按 run 计数,不跨运行累计', async () => {
    const { dependencies } = connectorDependencies();
    const connect = createRunScopedMcpConnector(dependencies);
    const identity = { actorId: 'developer-1', clientId: 'workbench', roles: [] } as const;

    for (let round = 0; round < 2; round++) {
      const run = await connect({ identity });
      try {
        // 单次运行内连续执行 6 次(上限)都成功;新运行重新计数。
        for (let index = 0; index < 6; index++) {
          const result = await run.client.callTool({
            name: EXECUTE_DATA_REQUEST_UNIT_TOOL,
            arguments: executableUnit
          });
          expect(result.isError).not.toBe(true);
        }
      } finally {
        await run.close();
      }
    }
  });
});

describe('运行感知的查询执行:取消经请求级 gateway 传递', () => {
  it('携带运行信号时仍复用已绑定身份的 gateway,并原样下传 signal', async () => {
    const gatewaySignals: Array<AbortSignal | undefined> = [];
    const execute = createRunAwareUnitQueryExecutor({
      gateway: {
        fetchData: async (_query, _diagnostics, signal) => {
          gatewaySignals.push(signal);
          return { rows: [] };
        }
      }
    });
    const controller = new AbortController();

    const effectiveQuery = {
      language: 'dqe',
      body: { dsl_list: [{ output_dims: [], output_metrics: ['Tokens消耗量'] }] },
      fieldMappings: {
        tokens: { queryField: 'Tokens消耗量', type: 'number', role: 'measure' }
      },
      filterValues: []
    } as unknown as EffectiveQuery;
    await expect(execute(effectiveQuery, controller.signal)).resolves.toEqual({ rows: [] });
    expect(gatewaySignals).toEqual([controller.signal]);
  });

  it('无运行信号时复用请求级数据网关,行映射回 DQE 原始输出字段名', async () => {
    let fallbackCalls = 0;
    const execute = createRunAwareUnitQueryExecutor({
      gateway: {
        // 数据网关返回按查询字段映射归一化的行(稳定页面字段 id 键)。
        fetchData: async () => {
          fallbackCalls += 1;
          return { rows: [{ 'field-1': '华东', 'field-2': 1200 }], totalCount: 1 };
        }
      }
    });

    const result = await execute(
      {
        language: 'dqe',
        body: { dsl_list: [{ output_dims: ['区域'], output_metrics: ['Tokens消耗量'] }] },
        fieldMappings: {
          'field-1': { queryField: '区域', type: 'string', role: 'dimension' },
          'field-2': { queryField: 'Tokens消耗量', type: 'number', role: 'measure' }
        },
        filterValues: []
      } as unknown as EffectiveQuery,
      undefined
    );

    // 创作期端口契约(ADR-0020):样例行以 DQE 输出字段名为键,
    // 成为内嵌初始行后由页面文档解析时再归一化。
    expect(result).toEqual({
      rows: [{ 区域: '华东', Tokens消耗量: 1200 }],
      totalCount: 1
    });
    expect(fallbackCalls).toBe(1);
  });
});

describe('按 run 的连接生命周期', () => {
  it('运行结束与异常停机都关闭当次连接', async () => {
    let closed = 0;
    const client: McpClient = {
      async listTools() {
        return [];
      },
      async callTool() {
        return { structuredContent: { ok: true } };
      }
    };
    const runner = createRunScopedAgentRunner({
      connect: async () => ({ client, close: async () => void (closed += 1) }),
      createRunner: () => ({
        async *run() {
          return;
        }
      })
    });
    for await (const event of runner.run({ messages: [] })) void event;
    expect(closed).toBe(1);

    const failing = createRunScopedAgentRunner({
      connect: async () => ({ client, close: async () => void (closed += 1) }),
      createRunner: () => ({
        async *run() {
          throw new Error('停机');
        }
      })
    });
    await expect(async () => {
      for await (const event of failing.run({ messages: [] })) void event;
    }).rejects.toThrowError('停机');
    expect(closed).toBe(2);
  });
});
