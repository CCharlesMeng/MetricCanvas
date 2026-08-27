import { describe, expect, it } from 'vitest';
import { semanticSurfaceOf } from '@metriccanvas/mcp';
import type { ModelProvider } from '../../src/lib/server/agent/types';
import {
  AskModelOutputError,
  createModelBackedAskModel
} from '../../src/lib/server/ask/model-port';
import { createLexicalAskModel } from '../../src/lib/server/ask/lexical-model';
import { exampleSnapshot } from './support/ask-harness';

/**
 * 模型端口的两个实现:
 * - createModelBackedAskModel:ModelProvider(deepseek/scripted)→ 结构化决策,
 *   工具参数优先、正文 JSON 兜底、非法输出按单次失败抛出;
 * - createLexicalAskModel:无外部模型时的确定性回退,解析不出指标时如实
 *   out_of_scope,不编造。
 */

function providerReturning(response: {
  content?: string;
  toolCalls?: Array<{ id: string; name: string; input: unknown }>;
}): ModelProvider {
  return {
    async complete() {
      return { content: response.content ?? '', toolCalls: response.toolCalls ?? [] };
    }
  };
}

const surfaces = semanticSurfaceOf(exampleSnapshot());
const operationsSurface = surfaces.find((surface) => surface.businessDomain === '运营分析')!;
const inventory = surfaces.map((surface) => ({
  name: surface.businessDomain,
  description: surface.description
}));

describe('createModelBackedAskModel:结构化决策解析', () => {
  it('工具参数优先:路由决策取自 route_business_domains 调用', async () => {
    const model = createModelBackedAskModel(
      providerReturning({
        toolCalls: [
          {
            id: 'call-1',
            name: 'route_business_domains',
            input: { businessDomains: ['运营分析'] }
          }
        ]
      })
    );
    await expect(model.routeDomains({ question: 'Tokens 用量', domains: inventory })).resolves.toEqual(
      { businessDomains: ['运营分析'] }
    );
  });

  it('正文 JSON 兜底:模型没走工具时从 content 解析', async () => {
    const model = createModelBackedAskModel(
      providerReturning({
        content: '```json\n{"intent":"trend"}\n```'
      })
    );
    await expect(
      model.decideIntent({
        question: '趋势',
        unit: {
          businessDomain: '运营分析',
          metrics: [{ kind: 'metric', name: 'Tokens消耗量' }],
          groupBy: ['统计周期'],
          filters: [],
          time: null
        },
        previousIntent: null
      })
    ).resolves.toEqual({ intent: 'trend' });
  });

  it('首轮不接受 patch:模型必须给出完整取数单元', async () => {
    const model = createModelBackedAskModel(
      providerReturning({
        toolCalls: [
          {
            id: 'call-1',
            name: 'submit_data_request_unit',
            input: { outcome: 'patch', patch: { groupBy: ['区域'] } }
          }
        ]
      })
    );
    await expect(
      model.formUnit({
        question: '各区域用量',
        surfaces: [operationsSurface],
        candidates: [],
        selectedMetrics: [],
        previousUnits: [],
      targetDataSourceId: null
      })
    ).rejects.toBeInstanceOf(AskModelOutputError);
  });

  it('意图不在闭集内按非法输出抛出(交由编排层重试纪律处理)', async () => {
    const model = createModelBackedAskModel(
      providerReturning({
        toolCalls: [
          { id: 'call-1', name: 'submit_analysis_intent', input: { intent: 'fancy-3d' } }
        ]
      })
    );
    await expect(
      model.decideIntent({
        question: '趋势',
        unit: {
          businessDomain: '运营分析',
          metrics: [],
          groupBy: [],
          filters: [],
          time: null
        },
        previousIntent: null
      })
    ).rejects.toBeInstanceOf(AskModelOutputError);
  });

  it('敏感维度在注入提示词前已被裁剪:提示词不含敏感取值域', async () => {
    let seenPrompt = '';
    const provider: ModelProvider = {
      async complete({ messages }) {
        seenPrompt = messages[0]?.content ?? '';
        return {
          content: '',
          toolCalls: [
            {
              id: 'call-1',
              name: 'submit_data_request_unit',
              input: { outcome: 'out_of_scope', reason: '测试' }
            }
          ]
        };
      }
    };
    const model = createModelBackedAskModel(provider);
    const sensitiveSurface = {
      ...operationsSurface,
      dimensions: [
        ...operationsSurface.dimensions,
        {
          name: '客户名单',
          aliases: [],
          description: '客户主体名称。取值域:(敏感,已隐去)',
          type: 'string' as const,
          nullable: false,
          sensitive: true
        }
      ]
    };
    await model.formUnit({
      question: '客户名单',
      surfaces: [sensitiveSurface],
      candidates: [],
      selectedMetrics: [],
      previousUnits: [],
      targetDataSourceId: null
    });
    expect(seenPrompt).toContain('客户名单');
    expect(seenPrompt).toContain('敏感字段,取值域不可见');
  });
});

describe('createLexicalAskModel:确定性回退', () => {
  const clock = () => new Date('2026-08-13T00:00:00Z');

  it('按字面命中路由业务域', async () => {
    const model = createLexicalAskModel({ clock });
    const decision = await model.routeDomains({
      question: '上个月各行业流失了多少客户?',
      domains: inventory
    });
    expect(decision.businessDomains).toContain('客户经营');
  });

  it('直答问题在语义面内成形:指标、分组、筛选与相对时间求值', async () => {
    const model = createLexicalAskModel({ clock });
    const decision = await model.formUnit({
      question: '上个月华东的Tokens消耗量是多少?',
      surfaces: [operationsSurface],
      candidates: [],
      selectedMetrics: [{ businessDomain: '运营分析', metricName: 'Tokens消耗量' }],
      previousUnits: [],
      targetDataSourceId: null
    });
    expect(decision).toMatchObject({
      outcome: 'unit',
      unit: {
        businessDomain: '运营分析',
        metrics: [{ kind: 'metric', name: 'Tokens消耗量' }],
        filters: [{ dimension: '区域', values: ['华东'] }],
        time: { granularity: 'month', start: '2026-07', end: '2026-07', providedBy: 'user' }
      }
    });
  });

  it('「YYYY年上半年」求值为 1-6 月;「增加一个」字面产出新增单元操作并沿用基线口径', async () => {
    const model = createLexicalAskModel({ clock });
    const decision = await model.formUnit({
      question: '页面中,增加一个流失客户数的走势',
      surfaces: surfaces.filter((surface) => surface.businessDomain === '客户经营'),
      candidates: [],
      selectedMetrics: [{ businessDomain: '客户经营', metricName: '流失客户数' }],
      previousUnits: [
        {
          dataSourceId: 'result',
          unit: {
            businessDomain: '客户经营',
            metrics: [{ kind: 'metric', name: '新增客户数' }],
            groupBy: ['统计周期'],
            filters: [],
            time: { granularity: 'month', start: '2026-01', end: '2026-06', providedBy: 'user' }
          }
        }
      ],
      targetDataSourceId: null
    });
    expect(decision).toMatchObject({
      outcome: 'operations',
      operations: [
        {
          op: 'add',
          unit: {
            businessDomain: '客户经营',
            metrics: [{ kind: 'metric', name: '流失客户数' }],
            groupBy: ['统计周期'],
            // 问题没给时间:沿用基线单元的时间口径(同轴对照)。
            time: { granularity: 'month', start: '2026-01', end: '2026-06' }
          }
        }
      ]
    });

    const halfYear = await model.formUnit({
      question: '2026年上半年每个月的新增客户数走势如何?',
      surfaces: surfaces.filter((surface) => surface.businessDomain === '客户经营'),
      candidates: [],
      selectedMetrics: [{ businessDomain: '客户经营', metricName: '新增客户数' }],
      previousUnits: [],
      targetDataSourceId: null
    });
    expect(halfYear).toMatchObject({
      outcome: 'unit',
      unit: {
        time: { granularity: 'month', start: '2026-01', end: '2026-06', providedBy: 'user' }
      }
    });
  });

  it('首轮命中多个指标即多个视角:一个指标一个单元,口径逐字共用', async () => {
    const model = createLexicalAskModel({ clock });
    const decision = await model.formUnit({
      question: '2026年上半年各区域的Tokens消耗量、计费Tokens量和Tokens请求量对比情况如何?',
      surfaces: [operationsSurface],
      candidates: [],
      selectedMetrics: [
        { businessDomain: '运营分析', metricName: 'Tokens消耗量' },
        { businessDomain: '运营分析', metricName: '计费Tokens量' },
        { businessDomain: '运营分析', metricName: 'Tokens请求量' }
      ],
      previousUnits: [],
      targetDataSourceId: null
    });
    if (decision.outcome !== 'operations') throw new Error('首轮多指标应拆成多个新增单元');
    expect(decision.operations.map((operation) => operation.op)).toEqual(['add', 'add', 'add']);
    const units = decision.operations.map((operation) =>
      operation.op === 'add' ? operation.unit : null
    );
    expect(units.map((unit) => unit!.metrics)).toEqual([
      [{ kind: 'metric', name: 'Tokens消耗量' }],
      [{ kind: 'metric', name: '计费Tokens量' }],
      [{ kind: 'metric', name: 'Tokens请求量' }]
    ]);
    // 组件之间要能按相同的维度与周期横向对照:分组、筛选与时间逐字相同。
    const scopes = units.map((unit) =>
      JSON.stringify({ groupBy: unit!.groupBy, filters: unit!.filters, time: unit!.time })
    );
    expect(new Set(scopes).size).toBe(1);
    expect(units[0]!.groupBy).toEqual(['区域']);
    expect(units[0]!.time).toMatchObject({ start: '2026-01', end: '2026-06' });
    // 标题彼此可区分,否则多个组件的可见标题都是同一句问题。
    expect(units.map((unit) => unit!.title)).toEqual([
      'Tokens消耗量',
      '计费Tokens量',
      'Tokens请求量'
    ]);
  });

  it('解析不出指标时如实 out_of_scope,不编造', async () => {
    const model = createLexicalAskModel({ clock });
    const decision = await model.formUnit({
      question: '上季度员工离职率是多少?',
      surfaces: [operationsSurface],
      candidates: [],
      selectedMetrics: [],
      previousUnits: [],
      targetDataSourceId: null
    });
    expect(decision.outcome).toBe('out_of_scope');
  });
});
