import { describe, expect, it } from 'vitest';
import { validate } from '@metriccanvas/page';
import { AgentRunnerError } from '../../src/lib/server/agent/runner';
import {
  ASK_DATA_SOURCE_ID,
  createAskOrchestrationRunner,
  transientPageIdFor
} from '../../src/lib/server/ask/orchestrator';
import type { AskDataRequestUnitState } from '../../src/lib/server/ask/ports';
import {
  buildAskPorts,
  collect,
  completedOf,
  interactionOf,
  stepEvents,
  stepTypes,
  syntheticExecutor,
  userTurn
} from './support/ask-harness';

/**
 * 问数编排验收自证(#66):脚本化模型 + 注入端口驱动完整链路,不启动
 * SvelteKit、浏览器与真实模型。语义面与验真、装配均为生产实现。
 */

const TREND_UNIT: AskDataRequestUnitState = {
  businessDomain: '运营分析',
  metrics: [{ kind: 'metric', name: 'Tokens消耗量' }],
  groupBy: ['统计周期'],
  filters: [],
  time: { granularity: 'month', start: '2026-01', end: '2026-06', providedBy: 'user' },
  title: 'Tokens 消耗趋势'
};

describe('问数编排:成功路径', () => {
  it('一句话问题走完固定阶段,产出通过页面校验的临时页面文档', async () => {
    const { ports, scripted } = buildAskPorts({
      script: {
        route: [{ businessDomains: ['运营分析'] }],
        unit: [{ outcome: 'unit', unit: TREND_UNIT }],
        intent: [{ intent: 'trend' }]
      }
    });
    const runner = createAskOrchestrationRunner(ports, { runId: 'run-trend' });
    const question = '最近6个月Tokens消耗量的月度趋势如何?';
    const events = await collect(runner.run({ messages: userTurn(question) }));

    expect(stepTypes(events)).toEqual([
      'domain_routed',
      'candidates_retrieved',
      'scope_card_presented',
      'execution_started',
      'rows_ready',
      'document_ready'
    ]);

    const steps = stepEvents(events);
    expect(steps[0]).toEqual({
      type: 'domain_routed',
      question,
      routedDomains: ['运营分析'],
      overriddenByUser: false
    });
    expect(steps[1]).toMatchObject({
      type: 'candidates_retrieved',
      selectedMetric: 'Tokens消耗量',
      adHocDefinition: null
    });
    expect(steps[2]).toMatchObject({
      type: 'scope_card_presented',
      businessDomain: '运营分析',
      metricName: 'Tokens消耗量',
      timeRange: '2026-01 ~ 2026-06',
      granularity: 'month',
      blockedOnConfirmation: false
    });
    expect(steps[4]).toMatchObject({
      type: 'rows_ready',
      summary: { rowCount: 3, totalCount: 3, outputFields: ['统计周期', 'Tokens消耗量'] }
    });
    expect(steps[5]).toMatchObject({
      type: 'document_ready',
      intent: 'trend',
      components: [{ componentType: 'lineChart', pinnedByUser: false }],
      transientPageId: transientPageIdFor('run-trend')
    });

    const { document } = completedOf(events);
    expect(document).not.toBeNull();
    expect(validate(document!)).toEqual([]);
    expect(document!.id).toBe(transientPageIdFor('run-trend'));
    expect(/^ask-transient-[0-9a-f]{8}$/u.test(String(document!.id))).toBe(true);

    // 上下文裁剪:域路由只看到域清单;口径成形只看到命中域的语义面投影。
    expect(scripted.calls.route[0]?.domains.map((domain) => domain.name)).toEqual([
      '客户活动',
      '运营分析',
      '客户经营'
    ]);
    expect(scripted.calls.unit[0]?.surfaces.map((surface) => surface.businessDomain)).toEqual([
      '运营分析'
    ]);
  });

  it('用户指定的域优先于模型判断:跳过路由调用并标记改写', async () => {
    const { ports, scripted } = buildAskPorts({
      script: {
        // 不提供 route 脚本:一旦调用即抛错,证明路由阶段被跳过。
        unit: [
          {
            outcome: 'unit',
            unit: {
              businessDomain: '客户经营',
              metrics: [{ kind: 'metric', name: '客户数' }],
              groupBy: ['客户级别'],
              filters: [],
              time: { granularity: 'month', start: '2026-07', end: '2026-07', providedBy: 'user' }
            }
          }
        ],
        intent: [{ intent: 'comparison' }]
      }
    });
    const runner = createAskOrchestrationRunner(ports, {
      runId: 'run-override',
      userDomains: ['客户经营']
    });
    const events = await collect(
      runner.run({ messages: userTurn('上个月各级别客户数是多少?') })
    );

    expect(scripted.calls.route).toHaveLength(0);
    expect(stepEvents(events)[0]).toMatchObject({
      type: 'domain_routed',
      routedDomains: ['客户经营'],
      overriddenByUser: true
    });
    // 域收窄后「客户数」只剩单一候选,不再歧义,直接执行到文档就绪。
    expect(stepTypes(events)).toContain('document_ready');
  });
});

describe('问数编排:候选消歧(两域近义「客户数」)', () => {
  const AMBIGUOUS_QUESTION = '上个月客户数是多少?';

  function ambiguousPorts() {
    return buildAskPorts({
      script: {
        route: [{ businessDomains: ['运营分析', '客户经营'] }],
        unit: [
          {
            outcome: 'unit',
            unit: {
              businessDomain: '客户经营',
              // 模型擅自选了口径:编排必须剔除歧义指标,交由用户确认。
              metrics: [{ kind: 'metric', name: '客户数' }],
              groupBy: [],
              filters: [],
              time: { granularity: 'month', start: '2026-07', end: '2026-07', providedBy: 'user' }
            }
          }
        ]
      }
    });
  }

  it('检索返回排序候选与口径差异说明,消歧阻塞转人工确认而不是替用户选', async () => {
    const harness = ambiguousPorts();
    const runner = createAskOrchestrationRunner(harness.ports, { runId: 'run-ambiguous' });
    const events = await collect(runner.run({ messages: userTurn(AMBIGUOUS_QUESTION) }));

    expect(stepTypes(events)).toEqual([
      'domain_routed',
      'candidates_retrieved',
      'scope_card_presented'
    ]);
    const steps = stepEvents(events);
    expect(steps[1]).toMatchObject({ type: 'candidates_retrieved', selectedMetric: null });
    const candidates = steps[1]!.type === 'candidates_retrieved' ? steps[1]!.candidates : [];
    expect(candidates.map((candidate) => candidate.businessDomain).sort()).toEqual([
      '客户经营',
      '运营分析'
    ]);
    for (const candidate of candidates) {
      expect(candidate.definitionDifference).toBeTruthy();
    }
    expect(steps[2]).toMatchObject({
      type: 'scope_card_presented',
      metricName: null,
      blockedOnConfirmation: true
    });

    const { interaction } = interactionOf(events);
    expect(interaction.kind).toBe('confirm_scope_card');
    expect(interaction.payload.reasons).toContain('ambiguous_metric');
    expect(harness.executions()).toBe(0);
  });

  it('携带结构化选择的确认续跑:按用户选中的口径执行', async () => {
    const first = ambiguousPorts();
    const firstRunner = createAskOrchestrationRunner(first.ports, { runId: 'run-ambiguous' });
    const firstEvents = await collect(firstRunner.run({ messages: userTurn(AMBIGUOUS_QUESTION) }));
    const { interaction, messages } = interactionOf(firstEvents);

    const resume = buildAskPorts({ script: { intent: [{ intent: 'single_value' }] } });
    const resumeRunner = createAskOrchestrationRunner(resume.ports, {
      runId: 'run-ambiguous-resume',
      scopeConfirmations: [
        {
          interactionId: interaction.id,
          selectedMetric: { businessDomain: '客户经营', metricName: '客户数' }
        }
      ]
    });
    const events = await collect(resumeRunner.run({ messages }));

    expect(stepTypes(events)).toEqual([
      'scope_card_presented',
      'execution_started',
      'rows_ready',
      'document_ready'
    ]);
    expect(stepEvents(events)[0]).toMatchObject({
      businessDomain: '客户经营',
      metricName: '客户数',
      blockedOnConfirmation: false
    });
    const { document } = completedOf(events);
    expect(validate(document!)).toEqual([]);
    expect(resume.executions()).toBe(1);
    // 模型全程未参与消歧选择:续跑没有路由与口径成形调用。
    expect(resume.scripted.calls.route).toHaveLength(0);
    expect(resume.scripted.calls.unit).toHaveLength(0);
  });

  it('消歧未决时的空白确认不放行:原卡重新阻塞', async () => {
    const first = ambiguousPorts();
    const firstRunner = createAskOrchestrationRunner(first.ports, { runId: 'run-ambiguous' });
    const firstEvents = await collect(firstRunner.run({ messages: userTurn(AMBIGUOUS_QUESTION) }));
    const { messages } = interactionOf(firstEvents);

    const resume = buildAskPorts({ script: {} });
    const resumeRunner = createAskOrchestrationRunner(resume.ports, {
      runId: 'run-ambiguous-blank'
    });
    const events = await collect(resumeRunner.run({ messages }));

    expect(stepTypes(events)).toEqual(['scope_card_presented']);
    expect(stepEvents(events)[0]).toMatchObject({ blockedOnConfirmation: true });
    expect(interactionOf(events).interaction.kind).toBe('confirm_scope_card');
    expect(resume.executions()).toBe(0);
  });
});

describe('问数编排:追问是定向增量修改', () => {
  it('一轮同时改口径(粒度)、筛选与展示;未提及的显式设置保持不变', async () => {
    const first = buildAskPorts({
      script: {
        route: [{ businessDomains: ['运营分析'] }],
        unit: [{ outcome: 'unit', unit: TREND_UNIT }],
        intent: [{ intent: 'trend' }]
      }
    });
    const firstRunner = createAskOrchestrationRunner(first.ports, { runId: 'turn-1' });
    const firstEvents = await collect(
      firstRunner.run({ messages: userTurn('最近6个月Tokens消耗量的月度趋势如何?') })
    );
    const baseline = completedOf(firstEvents).messages;

    const followUp = buildAskPorts({
      script: {
        unit: [
          {
            outcome: 'patch',
            patch: {
              filters: [{ dimension: '区域', values: ['华东'] }],
              time: { granularity: 'day', start: '2026-06-01', end: '2026-06-30', providedBy: 'user' }
            }
          }
        ],
        intent: [{ intent: 'detail' }]
      }
    });
    const followUpRunner = createAskOrchestrationRunner(followUp.ports, {
      runId: 'turn-2',
      // #65 接线点 2:钉住的组件形态由编排消费,后续轮次不被自动改写。
      pinnedComponents: [{ dataSourceId: ASK_DATA_SOURCE_ID, componentType: 'table' }]
    });
    const events = await collect(
      followUpRunner.run({
        messages: userTurn('只看华东,改成按天,用表格展示', baseline)
      })
    );

    // 追问不重路由(脚本未提供 route 决策即证明),域沿用上一轮。
    expect(followUp.scripted.calls.route).toHaveLength(0);
    expect(stepEvents(events)[0]).toMatchObject({
      type: 'domain_routed',
      routedDomains: ['运营分析']
    });

    // 增量修改基线:模型看到的 previousUnit 是上一轮生效单元。
    expect(followUp.scripted.calls.unit[0]?.previousUnit).toMatchObject({
      businessDomain: '运营分析',
      groupBy: ['统计周期']
    });

    const execution = stepEvents(events).find((event) => event.type === 'execution_started');
    expect(execution).toBeDefined();
    const effectiveQuery = (execution as { effectiveQuery: unknown }).effectiveQuery as {
      body: { dsl_list: [Record<string, unknown>] };
    };
    const item = effectiveQuery.body.dsl_list[0];
    // 本轮改了筛选与时间口径……
    expect(item.filter).toMatchObject({
      time: { period: 'day', start: '2026-06-01', end: '2026-06-30' },
      dims: [{ dim_name: '区域', dim_value_list: ['华东'] }]
    });
    // ……而未提及的指标与分组维度保持不变(patch 语义结构性保证)。
    expect(item.output_metrics).toEqual(['Tokens消耗量']);
    expect(item.output_dims).toEqual(['统计周期']);

    const documentReady = stepEvents(events).find((event) => event.type === 'document_ready');
    expect(documentReady).toMatchObject({
      intent: 'detail',
      components: [{ componentType: 'table', pinnedByUser: true }]
    });
    const { document } = completedOf(events);
    expect(validate(document!)).toEqual([]);
  });

  it('话语点名组件形态走确定性通道:「改成柱状图」立即生效、优先于钉住、跨轮保持', async () => {
    const first = buildAskPorts({
      script: {
        route: [{ businessDomains: ['运营分析'] }],
        unit: [{ outcome: 'unit', unit: TREND_UNIT }],
        intent: [{ intent: 'trend' }]
      }
    });
    const firstRunner = createAskOrchestrationRunner(first.ports, { runId: 'req-1' });
    const firstEvents = await collect(
      firstRunner.run({ messages: userTurn('最近6个月Tokens消耗量的月度趋势如何?') })
    );
    const baseline = completedOf(firstEvents).messages;

    // 第二轮:话语点名「柱状图」——组件词汇的唯一来源是 componentCatalog
    // 的中文名,确定性识别,不依赖模型意图判定;且优先于 UI 钉住(table)。
    const second = buildAskPorts({
      script: {
        unit: [{ outcome: 'patch', patch: {} }],
        intent: [{ intent: 'trend' }]
      }
    });
    const secondRunner = createAskOrchestrationRunner(second.ports, {
      runId: 'req-2',
      pinnedComponents: [{ dataSourceId: ASK_DATA_SOURCE_ID, componentType: 'table' }]
    });
    const secondEvents = await collect(
      secondRunner.run({ messages: userTurn('改成柱状图', baseline) })
    );
    expect(
      stepEvents(secondEvents).find((event) => event.type === 'document_ready')
    ).toMatchObject({
      components: [{ componentType: 'barChart', pinnedByUser: true }]
    });
    const secondBaseline = completedOf(secondEvents).messages;

    // 第三轮:未提及展示——点名跨轮保持(未提及的显式设置不变)。
    const third = buildAskPorts({
      script: {
        unit: [
          {
            outcome: 'patch',
            patch: { filters: [{ dimension: '区域', values: ['华东'] }] }
          }
        ],
        intent: [{ intent: 'trend' }]
      }
    });
    const thirdRunner = createAskOrchestrationRunner(third.ports, { runId: 'req-3' });
    const thirdEvents = await collect(
      thirdRunner.run({ messages: userTurn('只看华东', secondBaseline) })
    );
    expect(
      stepEvents(thirdEvents).find((event) => event.type === 'document_ready')
    ).toMatchObject({
      components: [{ componentType: 'barChart', pinnedByUser: true }]
    });
  });
});

describe('问数编排:降级路径(四段分类,不编造数据)', () => {
  it('面外问题按发现段降级:step_failed(discovery)且不执行查询', async () => {
    const harness = buildAskPorts({
      script: {
        route: [{ businessDomains: ['运营分析'] }],
        unit: [{ outcome: 'out_of_scope', reason: '语义面内没有员工离职率相关指标' }]
      }
    });
    const runner = createAskOrchestrationRunner(harness.ports, { runId: 'run-oos' });
    const events = await collect(runner.run({ messages: userTurn('上季度员工离职率是多少?') }));

    expect(stepTypes(events)).toEqual(['domain_routed', 'candidates_retrieved', 'step_failed']);
    expect(stepEvents(events)[2]).toMatchObject({
      type: 'step_failed',
      stage: 'discovery',
      code: 'OUT_OF_SEMANTIC_SURFACE'
    });
    expect(harness.executions()).toBe(0);
    // 不编造数据:没有文档产出;运行停在缺口登记确认(#67 非阻塞出口),
    // 登记与否由用户决定,直接换个问题即放弃。
    const { interaction } = interactionOf(events);
    expect(interaction.kind).toBe('confirm_gap_entry');
    expect(events.some((event) => event.type === 'completed')).toBe(false);
  });

  it('真实执行失败按执行段降级,且执行段失败自动重试一次', async () => {
    let calls = 0;
    const failing = {
      executions: () => calls,
      execute: async () => {
        calls += 1;
        throw Object.assign(new Error('DQE 服务不可达'), { code: 'DQE_TRANSPORT_ERROR' });
      }
    };
    const harness = buildAskPorts({
      script: {
        route: [{ businessDomains: ['运营分析'] }],
        unit: [{ outcome: 'unit', unit: TREND_UNIT }]
      },
      executor: failing
    });
    const runner = createAskOrchestrationRunner(harness.ports, { runId: 'run-exec-fail' });
    const events = await collect(runner.run({ messages: userTurn('Tokens消耗量趋势') }));

    expect(calls).toBe(2);
    const failed = stepEvents(events).find((event) => event.type === 'step_failed');
    expect(failed).toMatchObject({
      stage: 'execution',
      code: 'DQE_TRANSPORT_ERROR'
    });
    expect(completedOf(events).document).toBeNull();
  });

  it('清单校验被拒时给模型一次带违规反馈的修复机会,修复后成功执行', async () => {
    const harness = buildAskPorts({
      script: {
        route: [{ businessDomains: ['运营分析'] }],
        unit: [
          {
            outcome: 'unit',
            unit: {
              businessDomain: '运营分析',
              metrics: [{ kind: 'metric', name: 'Token消耗' }],
              groupBy: ['统计周期'],
              filters: [],
              time: { granularity: 'month', start: '2026-01', end: '2026-06', providedBy: 'user' }
            }
          },
          { outcome: 'unit', unit: TREND_UNIT }
        ],
        intent: [{ intent: 'trend' }]
      }
    });
    const runner = createAskOrchestrationRunner(harness.ports, { runId: 'run-repair' });
    const events = await collect(runner.run({ messages: userTurn('Token消耗走势如何?') }));

    // 清单校验被拒不消耗执行次数;修复后真实执行恰好一次。
    expect(harness.executions()).toBe(1);
    expect(harness.scripted.calls.unit).toHaveLength(2);
    expect(harness.scripted.calls.unit[1]?.violationFeedback?.join(' ')).toContain('Token消耗');
    expect(stepTypes(events)).toContain('document_ready');
    expect(validate(completedOf(events).document!)).toEqual([]);
  });
});

describe('问数编排:临时口径(自由 formula)', () => {
  it('formula 口径阻塞确认;普通确认(无需选择)后执行并留痕', async () => {
    const formulaUnit: AskDataRequestUnitState = {
      businessDomain: '运营分析',
      metrics: [
        {
          kind: 'formula',
          expression: '计费Tokens量 / Tokens消耗量',
          label: '计费占比',
          unit: '%',
          description: '计费量占总消耗的比例'
        }
      ],
      groupBy: ['区域'],
      filters: [],
      time: { granularity: 'month', start: '2026-07', end: '2026-07', providedBy: 'user' }
    };
    const first = buildAskPorts({
      script: {
        route: [{ businessDomains: ['运营分析'] }],
        unit: [{ outcome: 'unit', unit: formulaUnit }]
      }
    });
    const firstRunner = createAskOrchestrationRunner(first.ports, { runId: 'run-formula' });
    const firstEvents = await collect(
      firstRunner.run({ messages: userTurn('上个月各区域的计费占比是多少?') })
    );

    const steps = stepEvents(firstEvents);
    expect(steps.find((event) => event.type === 'candidates_retrieved')).toMatchObject({
      adHocDefinition: { formula: '计费Tokens量 / Tokens消耗量' }
    });
    expect(steps.find((event) => event.type === 'scope_card_presented')).toMatchObject({
      blockedOnConfirmation: true,
      adHocDefinition: { formula: '计费Tokens量 / Tokens消耗量' }
    });
    const { interaction, messages } = interactionOf(firstEvents);
    expect(interaction.payload.reasons).toEqual(['ad_hoc_definition']);
    expect(first.executions()).toBe(0);

    // 非歧义阻塞:普通确认续跑即可执行(不需要结构化选择);口径卡确认
    // 即用户确认,临时口径缺口在此刻登记(#67)。
    const resume = buildAskPorts({ script: { intent: [{ intent: 'composition' }] } });
    const resumeRunner = createAskOrchestrationRunner(resume.ports, { runId: 'run-formula-2' });
    const events = await collect(resumeRunner.run({ messages }));
    expect(stepTypes(events)).toEqual([
      'scope_card_presented',
      'metric_gap_recorded',
      'execution_started',
      'rows_ready',
      'document_ready'
    ]);
    expect(resume.executions()).toBe(1);
    expect(validate(completedOf(events).document!)).toEqual([]);
  });
});

describe('问数编排:中断真正取消进行中的执行', () => {
  it('执行中收到取消信号:运行以 CANCELLED 停机,不再产出后续步骤', async () => {
    const controller = new AbortController();
    const hanging = syntheticExecutor({
      onExecute: async () => {
        // 模拟 #32/#64 设施:取消信号中止进行中的 HTTP 执行。
        controller.abort(new DOMException('用户取消', 'AbortError'));
        throw new DOMException('请求已中止', 'AbortError');
      }
    });
    const harness = buildAskPorts({
      script: {
        route: [{ businessDomains: ['运营分析'] }],
        unit: [{ outcome: 'unit', unit: TREND_UNIT }]
      },
      executor: hanging
    });
    const runner = createAskOrchestrationRunner(harness.ports, { runId: 'run-cancel' });

    const seen: string[] = [];
    let caught: unknown;
    try {
      for await (const event of runner.run({
        messages: userTurn('Tokens消耗量趋势'),
        signal: controller.signal
      })) {
        if (event.type === 'step') seen.push(event.event.type);
      }
    } catch (cause) {
      caught = cause;
    }

    expect(caught).toBeInstanceOf(AgentRunnerError);
    expect((caught as AgentRunnerError).code).toBe('CANCELLED');
    expect(seen).toEqual([
      'domain_routed',
      'candidates_retrieved',
      'scope_card_presented',
      'execution_started'
    ]);
  });
});
