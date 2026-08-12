import { describe, expect, it } from 'vitest';
import { createMemoryPageLifecycle } from '@metriccanvas/page-lifecycle';
import { createMemoryTemplateLibrary } from '@metriccanvas/template-library';
import type { EffectiveQuery, JsonObject, Row } from '@metriccanvas/page';
import {
  connectInProcessMetricCanvasMcp,
  createDataContextSearch,
  createDataRequestUnitVerification,
  createMetricCanvasMcpServer,
  EXECUTE_DATA_REQUEST_UNIT_TOOL,
  MAX_UNIT_EXECUTIONS_PER_RUN,
  UNIT_SAMPLE_ROW_LIMIT,
  type DataContextSnapshot,
  type DataRequestUnitInput,
  type ExecuteDataRequestUnitQuery,
  type UnitQueryExecutionResult
} from '../src';

/**
 * 数据上下文快照:字段声明沿用 Schema 元数据 1.0 的受控句式——
 * 维度取值域写在 description,时间粒度写在 granularity(与 DQE 仿真
 * 语义面的同面投影一致)。
 */
const snapshot: DataContextSnapshot = {
  formatVersion: '1.0',
  id: 'unit-verification-context',
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
      objects: [{
        id: 'ops-summary',
        name: '运营汇总',
        kind: 'dataset',
        description: '按区域、模型和统计周期查询运营汇总',
        fields: [
          {
            name: '区域',
            type: 'string',
            description: '业务归属区域。取值域:华东、华南、华北。',
            aliases: ['大区'],
            roleHints: ['dimension'],
            nullable: false,
            sensitive: false
          },
          {
            name: '统计周期',
            type: 'date',
            description: '按查询时间粒度展开的统计周期。支持的时间粒度:month、day。',
            aliases: ['统计时间'],
            roleHints: ['dimension', 'time'],
            granularity: 'month,day',
            nullable: false,
            sensitive: false
          },
          {
            name: 'Tokens消耗量',
            type: 'number',
            description: '统计期内消耗的 Token 总量。可加性:可加;时间聚合方式:求和。',
            aliases: ['消耗量'],
            roleHints: ['measure'],
            unit: 'Token',
            nullable: false,
            sensitive: false
          },
          {
            name: '客户数',
            type: 'number',
            description: '统计期内发起过调用的去重客户数。可加性:不可加;时间聚合方式:均值。',
            aliases: ['活跃客户数'],
            roleHints: ['measure'],
            unit: '家',
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

const dataContext = { current: async () => snapshot };

function baseItem(): JsonObject {
  return {
    output_dims: ['区域'],
    output_metrics: ['Tokens消耗量'],
    filter: {
      time: {
        period: 'month',
        is_aggregate: true,
        start: '2026-07',
        end: '2026-07'
      },
      dims: [],
      metrics: []
    },
    order: {}
  };
}

function unit(overrides: {
  item?: JsonObject;
  question?: string;
  fields?: DataRequestUnitInput['fields'];
} = {}): DataRequestUnitInput {
  return {
    dataSourceId: 'ops-tokens',
    ...(overrides.question === undefined ? {} : { question: overrides.question }),
    fields: overrides.fields ?? {
      region: {
        queryField: '区域',
        type: 'string',
        role: 'dimension',
        label: '区域'
      },
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
      body: { dsl_list: [overrides.item ?? baseItem()] }
    }
  };
}

function fakePort(
  behavior: (query: EffectiveQuery) => Promise<UnitQueryExecutionResult> = async () => ({
    rows: [{ region: '华东', tokens: 1200 }] satisfies Row[],
    totalCount: 1
  })
): { calls: EffectiveQuery[]; port: ExecuteDataRequestUnitQuery } {
  const calls: EffectiveQuery[] = [];
  return {
    calls,
    port: (query) => {
      calls.push(query);
      return behavior(query);
    }
  };
}

/** 与 @metriccanvas/data-gateway 的 DqeGatewayError 同形状(携带字符串 code)。 */
class FakeDqeGatewayError extends Error {
  constructor(readonly code: string) {
    super(`运行期查询错误:${code}`);
    this.name = 'DqeGatewayError';
  }
}

describe('清单校验失败不执行', () => {
  it.each([
    {
      name: '指标名不在数据上下文内',
      item: { ...baseItem(), output_metrics: ['营业收入'] },
      violationCode: 'METRIC_NOT_IN_DATA_CONTEXT',
      subject: '营业收入',
      candidatesInclude: 'Tokens消耗量'
    },
    {
      name: '指标使用别名时给出正名候选',
      item: { ...baseItem(), output_metrics: ['消耗量'] },
      violationCode: 'METRIC_NOT_IN_DATA_CONTEXT',
      subject: '消耗量',
      candidatesInclude: 'Tokens消耗量'
    },
    {
      name: '维度名不在数据上下文内',
      item: { ...baseItem(), output_dims: ['城市'] },
      violationCode: 'DIMENSION_NOT_IN_DATA_CONTEXT',
      subject: '城市',
      candidatesInclude: '区域'
    },
    {
      name: '筛选维度取值不在取值域内',
      item: {
        ...baseItem(),
        filter: {
          time: { period: 'month', start: '2026-07', end: '2026-07' },
          dims: [{ dim_name: '区域', dim_value_list: ['东北'] }],
          metrics: []
        }
      },
      violationCode: 'DIMENSION_VALUE_NOT_IN_DATA_CONTEXT',
      subject: '区域=东北',
      candidatesInclude: '华东'
    },
    {
      name: '时间粒度不在数据上下文声明内',
      item: {
        ...baseItem(),
        filter: {
          time: { period: 'quarter', start: '2026-01', end: '2026-07' },
          dims: [],
          metrics: []
        }
      },
      violationCode: 'TIME_GRANULARITY_NOT_IN_DATA_CONTEXT',
      subject: 'quarter',
      candidatesInclude: 'month'
    },
    {
      name: '时间维度被写进维度筛选',
      item: {
        ...baseItem(),
        filter: {
          time: { period: 'month', start: '2026-07', end: '2026-07' },
          dims: [{ dim_name: '统计周期', dim_value_list: ['2026-07'] }],
          metrics: []
        }
      },
      violationCode: 'DIMENSION_NOT_IN_DATA_CONTEXT',
      subject: '统计周期',
      candidatesInclude: undefined
    },
    {
      name: '自由生成 formula 缺少问题原文留痕',
      item: {
        ...baseItem(),
        output_metrics: [{ formula: 'Tokens消耗量 / 客户数', alias: '户均消耗' }]
      },
      violationCode: 'FORMULA_QUESTION_MISSING',
      subject: 'Tokens消耗量 / 客户数',
      candidatesInclude: undefined
    },
    {
      name: 'output_metrics 为空',
      item: { ...baseItem(), output_metrics: [] },
      violationCode: 'UNIT_QUERY_SHAPE_INVALID',
      subject: 'output_metrics',
      candidatesInclude: undefined
    }
  ])('$name', async ({ item, violationCode, subject, candidatesInclude }) => {
    const { calls, port } = fakePort();
    const verify = createDataRequestUnitVerification({
      dataContext,
      executeDataRequestUnitQuery: port
    });

    const result = await verify(unit({ item }));

    expect(calls).toHaveLength(0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.stage).toBe('generation');
    expect(result.failure.code).toBe('UNIT_MANIFEST_REJECTED');
    expect(result.executionsUsed).toBe(0);
    const violation = result.failure.violations?.find(
      (entry) => entry.code === violationCode && entry.subject === subject
    );
    expect(violation).toBeDefined();
    if (candidatesInclude !== undefined) {
      expect(violation?.candidates).toContain(candidatesInclude);
    }
  });
});

describe('执行成功回传输出字段与样例行', () => {
  it('回传结果字段契约声明的输出字段、样例行与总条数', async () => {
    const rows: Row[] = [
      { region: '华东', tokens: 1200 },
      { region: '华南', tokens: 800 }
    ];
    const { calls, port } = fakePort(async () => ({ rows, totalCount: 2 }));
    const verify = createDataRequestUnitVerification({
      dataContext,
      executeDataRequestUnitQuery: port
    });

    const result = await verify(unit());

    expect(result).toMatchObject({
      ok: true,
      dataSourceId: 'ops-tokens',
      outputFields: [
        {
          fieldId: 'region',
          queryField: '区域',
          type: 'string',
          role: 'dimension',
          label: '区域'
        },
        {
          fieldId: 'tokens',
          queryField: 'Tokens消耗量',
          type: 'number',
          role: 'measure',
          label: 'Tokens消耗量',
          unit: 'Token'
        }
      ],
      sampleRows: rows,
      returnedRowCount: 2,
      totalCount: 2,
      formulaTraces: [],
      executionsUsed: 1,
      executionsRemaining: MAX_UNIT_EXECUTIONS_PER_RUN - 1
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      language: 'dqe',
      body: { dsl_list: [{ output_metrics: ['Tokens消耗量'] }] },
      filterValues: []
    });
    expect(calls[0]!.fieldMappings).toEqual(unit().fields);
  });

  it('样例行按上限截断,返回行数如实回报', async () => {
    const rows: Row[] = Array.from({ length: UNIT_SAMPLE_ROW_LIMIT + 5 }, (_, index) => ({
      region: '华东',
      tokens: index
    }));
    const { port } = fakePort(async () => ({ rows, totalCount: rows.length }));
    const verify = createDataRequestUnitVerification({
      dataContext,
      executeDataRequestUnitQuery: port
    });

    const result = await verify(unit());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sampleRows).toHaveLength(UNIT_SAMPLE_ROW_LIMIT);
    expect(result.returnedRowCount).toBe(rows.length);
  });

  it('自由生成的 formula 携带问题原文时留痕:表达式与引用到的指标名', async () => {
    const { port } = fakePort();
    const verify = createDataRequestUnitVerification({
      dataContext,
      executeDataRequestUnitQuery: port
    });

    const result = await verify(
      unit({
        question: '每家客户平均消耗多少 Tokens?',
        item: {
          ...baseItem(),
          output_metrics: [{ formula: 'Tokens消耗量 / 客户数', alias: '户均消耗' }]
        }
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.formulaTraces).toEqual([
      {
        question: '每家客户平均消耗多少 Tokens?',
        expression: 'Tokens消耗量 / 客户数',
        referencedMetrics: ['Tokens消耗量', '客户数']
      }
    ]);
  });
});

describe('运行期查询错误映射到四段分类', () => {
  it.each([
    { code: 'DQE_CONFIG_ERROR', stage: 'generation' },
    { code: 'DQE_FILTER_BINDING_ERROR', stage: 'generation' },
    { code: 'DQE_TRANSPORT_ERROR', stage: 'execution' },
    { code: 'DQE_ENVELOPE_ERROR', stage: 'execution' },
    { code: 'DQE_ITEM_ERROR', stage: 'execution' },
    { code: 'DQE_FIELD_MAPPING_ERROR', stage: 'presentation' },
    { code: 'DQE_ROW_CONTRACT_ERROR', stage: 'presentation' }
  ] as const)('$code 归类为 $stage', async ({ code, stage }) => {
    const { port } = fakePort(async () => {
      throw new FakeDqeGatewayError(code);
    });
    const verify = createDataRequestUnitVerification({
      dataContext,
      executeDataRequestUnitQuery: port
    });

    const result = await verify(unit());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure).toMatchObject({
      stage,
      code,
      message: `运行期查询错误:${code}`
    });
    expect(result.executionsUsed).toBe(1);
  });
});

describe('单次运行执行次数上限', () => {
  it(`第 ${MAX_UNIT_EXECUTIONS_PER_RUN + 1} 次执行被拦截并返回明确失败`, async () => {
    const { calls, port } = fakePort();
    const verify = createDataRequestUnitVerification({
      dataContext,
      executeDataRequestUnitQuery: port
    });

    for (let round = 1; round <= MAX_UNIT_EXECUTIONS_PER_RUN; round += 1) {
      const result = await verify(unit());
      expect(result.ok).toBe(true);
      expect(result.executionsUsed).toBe(round);
    }

    const blocked = await verify(unit());
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.failure.stage).toBe('execution');
    expect(blocked.failure.code).toBe('UNIT_EXECUTION_LIMIT_REACHED');
    expect(blocked.executionsUsed).toBe(MAX_UNIT_EXECUTIONS_PER_RUN);
    expect(blocked.executionsRemaining).toBe(0);
    expect(calls).toHaveLength(MAX_UNIT_EXECUTIONS_PER_RUN);
  });

  it('清单校验失败不消耗执行次数,执行失败消耗执行次数', async () => {
    let shouldFail = false;
    const { calls, port } = fakePort(async () => {
      if (shouldFail) throw new FakeDqeGatewayError('DQE_TRANSPORT_ERROR');
      return { rows: [], totalCount: 0 };
    });
    const verify = createDataRequestUnitVerification({
      dataContext,
      executeDataRequestUnitQuery: port
    });

    const rejected = await verify(
      unit({ item: { ...baseItem(), output_metrics: ['营业收入'] } })
    );
    expect(rejected.ok).toBe(false);
    expect(rejected.executionsUsed).toBe(0);

    shouldFail = true;
    const failed = await verify(unit());
    expect(failed.ok).toBe(false);
    expect(failed.executionsUsed).toBe(1);
    expect(calls).toHaveLength(1);
  });
});

describe('MCP 工具边界', () => {
  function server(port: ExecuteDataRequestUnitQuery) {
    const lifecycle = createMemoryPageLifecycle({
      dataContext: { current: async () => ({ version: snapshot.version }) }
    });
    return createMetricCanvasMcpServer({
      dataContext: createDataContextSearch({ current: async () => snapshot }),
      lifecycle,
      templates: createMemoryTemplateLibrary({ pageLifecycle: lifecycle }),
      executeDataRequestUnitQuery: port,
      context: () => ({ actorId: 'tester', clientId: 'test' }),
      previewUrl: ({ pageId, revisionId }) => `/pages/${pageId}?revision=${revisionId}`
    });
  }

  it('注册工具,描述只使用当前领域词汇', async () => {
    const connection = await connectInProcessMetricCanvasMcp(server(fakePort().port));
    const tools = await connection.client.listTools();
    const tool = tools.find((entry) => entry.name === EXECUTE_DATA_REQUEST_UNIT_TOOL);
    expect(tool).toBeDefined();
    for (const term of ['取数单元', '清单校验', '数据上下文', '查询定义', '结果字段契约', '样例行']) {
      expect(tool?.description).toContain(term);
    }
    for (const retired of ['dqe client', 'DSL 校验', '页面查询 DSL', 'mock']) {
      expect(tool?.description ?? '').not.toContain(retired);
    }
    await connection.close();
  });

  it('取数单元经工具执行成功,回传输出字段与样例行', async () => {
    const connection = await connectInProcessMetricCanvasMcp(server(fakePort().port));
    const result = await connection.client.callTool({
      name: EXECUTE_DATA_REQUEST_UNIT_TOOL,
      arguments: unit() as unknown as Record<string, unknown>
    });
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({
      ok: true,
      sampleRows: [{ region: '华东', tokens: 1200 }],
      executionsUsed: 1
    });
    await connection.close();
  });

  it('清单校验被拒绝时工具返回失败结果', async () => {
    const { calls, port } = fakePort();
    const connection = await connectInProcessMetricCanvasMcp(server(port));
    const result = await connection.client.callTool({
      name: EXECUTE_DATA_REQUEST_UNIT_TOOL,
      arguments: unit({
        item: { ...baseItem(), output_metrics: ['营业收入'] }
      }) as unknown as Record<string, unknown>
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      ok: false,
      failure: { stage: 'generation', code: 'UNIT_MANIFEST_REJECTED' }
    });
    expect(calls).toHaveLength(0);
    await connection.close();
  });
});
