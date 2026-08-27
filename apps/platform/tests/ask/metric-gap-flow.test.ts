import { describe, expect, it } from 'vitest';
import { validate } from '@metriccanvas/page';
import type { LifecycleContext } from '@metriccanvas/page-lifecycle';
import { streamAgentRun, type AgentRunOutcome } from '../../src/lib/server/agent/stream';
import { createMemoryAnalysisSessionStore } from '../../src/lib/server/session/memory';
import {
  adHocGapKey,
  createSessionMetricGapLedger,
  scopeGapKey
} from '../../src/lib/server/session/metric-gap';
import type { MetricGapOccurrence } from '../../src/lib/server/session/step-event';
import { createAskOrchestrationRunner } from '../../src/lib/server/ask/orchestrator';
import type { AskDataRequestUnitState } from '../../src/lib/server/ask/ports';
import {
  buildAskPorts,
  collect,
  completedOf,
  interactionOf,
  stepEvents,
  stepTypes,
  userTurn
} from './support/ask-harness';

/**
 * 指标缺口条目与临时指标标注的编排自证(#67,ADR-0036):
 * - 检索不到指标仍尽力回答,不出现阻塞状态,不要求先走指标建设流程;
 * - 缺口出现在用户确认后才登记(临时指标以取数核对确认为时点,面外与
 *   部分缺失以 confirm_gap_entry 交互为时点),放弃即不登记;
 * - 缺口条目结构化、只含问题原文,随会话事件流落库,不另建采集通道;
 * - 部分可答分开呈现:能答的照答,缺的单独列出,不混入同一数字或组件。
 */

const IDENTITY: LifecycleContext = { actorId: 'analyst-1', clientId: 'workbench', roles: [] };

const FORMULA_QUESTION = '上个月各区域的计费占比是多少?';

function formulaUnit(expression: string): AskDataRequestUnitState {
  return {
    businessDomain: '运营分析',
    metrics: [
      {
        kind: 'formula',
        expression,
        label: '计费占比',
        unit: '%',
        description: '计费量占总消耗的比例'
      }
    ],
    groupBy: ['区域'],
    filters: [],
    time: { granularity: 'month', start: '2026-07', end: '2026-07', providedBy: 'user' }
  };
}

/** 跑一轮临时指标流:阻塞 → 取数核对确认续跑,返回续跑轮的事件与观察到的登记。 */
async function runAdHocFlow(input: {
  expression: string;
  question: string;
  runId: string;
}): Promise<{
  firstEvents: Awaited<ReturnType<typeof collect>>;
  resumeEvents: Awaited<ReturnType<typeof collect>>;
  sinkCalls: MetricGapOccurrence[];
}> {
  const sinkCalls: MetricGapOccurrence[] = [];
  const first = buildAskPorts({
    script: {
      route: [{ businessDomains: ['运营分析'] }],
      unit: [{ outcome: 'unit', unit: formulaUnit(input.expression) }]
    }
  });
  const firstRunner = createAskOrchestrationRunner(
    { ...first.ports, gapSink: (occurrence) => void sinkCalls.push(occurrence) },
    { runId: input.runId }
  );
  const firstEvents = await collect(firstRunner.run({ messages: userTurn(input.question) }));
  const { messages } = interactionOf(firstEvents);

  const resume = buildAskPorts({ script: { intent: [{ intent: 'composition' }] } });
  const resumeRunner = createAskOrchestrationRunner(
    { ...resume.ports, gapSink: (occurrence) => void sinkCalls.push(occurrence) },
    { runId: `${input.runId}-resume` }
  );
  const resumeEvents = await collect(resumeRunner.run({ messages }));
  return { firstEvents, resumeEvents, sinkCalls };
}

function gapEventsOf(events: Awaited<ReturnType<typeof collect>>): MetricGapOccurrence[] {
  return stepEvents(events).flatMap((event) =>
    event.type === 'metric_gap_recorded' ? [event.gap] : []
  );
}

describe('临时指标:尽力回答 + 取数核对确认即登记', () => {
  it('确认前不登记;确认续跑后登记完整结构化出现并照常出数', async () => {
    const { firstEvents, resumeEvents, sinkCalls } = await runAdHocFlow({
      expression: '计费Tokens量 / Tokens消耗量',
      question: FORMULA_QUESTION,
      runId: 'gap-adhoc'
    });

    // 用户确认前:不产生缺口事件,登记观察口也未被调用。
    expect(gapEventsOf(firstEvents)).toEqual([]);

    // 确认后:登记一次出现,结构化字段齐备且只含问题原文(不含对话)。
    // 「计费占比」没有命中任何指标条目,检索词与最接近候选如实为空。
    const recorded = gapEventsOf(resumeEvents);
    expect(recorded).toEqual([
      {
        idempotencyKey: adHocGapKey('运营分析', '计费Tokens量 / Tokens消耗量'),
        question: FORMULA_QUESTION,
        searchTerms: [],
        closestCandidates: [],
        adHocDefinition: {
          formula: '计费Tokens量 / Tokens消耗量',
          description: '计费量占总消耗的比例'
        },
        expectedDimensions: ['区域'],
        expectedGranularity: 'month',
        businessDomain: '运营分析'
      }
    ]);
    expect(sinkCalls).toEqual(recorded);

    // 尽力回答未被缺口阻塞:确认后照常执行并产出通过校验的文档,
    // 且组件可见标题携带「临时指标」标记(与已定义指标可区分)。
    const { document } = completedOf(resumeEvents);
    expect(validate(document!)).toEqual([]);
    const titles = JSON.stringify(document);
    expect(titles).toContain('(临时指标)');
  });

  it('同一表达式形状的重复出现共享幂等键,台账累加次数不产生重复条目', async () => {
    const runs = [
      await runAdHocFlow({
        expression: '计费Tokens量 / Tokens消耗量',
        question: FORMULA_QUESTION,
        runId: 'gap-dedupe-1'
      }),
      // 空白与问法不同,但口径形状相同 → 同一缺口。
      await runAdHocFlow({
        expression: '计费Tokens量/Tokens消耗量',
        question: '各区域计费占比呢?',
        runId: 'gap-dedupe-2'
      })
    ];
    const occurrences = runs.flatMap((run) => gapEventsOf(run.resumeEvents));
    expect(occurrences).toHaveLength(2);
    expect(occurrences[0]!.idempotencyKey).toBe(occurrences[1]!.idempotencyKey);

    // 出现随会话事件流落库后按幂等键聚合:一个条目,次数 2。
    const store = createMemoryAnalysisSessionStore();
    for (const [index, gap] of occurrences.entries()) {
      await store.appendEvent(
        { sessionId: `session-${index}`, event: { type: 'metric_gap_recorded', gap } },
        IDENTITY
      );
    }
    const ledger = createSessionMetricGapLedger({
      sessions: store,
      metricExists: async () => false
    });
    const { entries } = await ledger.listEntries(IDENTITY);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ occurrenceCount: 2, status: 'open' });
    expect(entries[0]!.questions).toEqual(['各区域计费占比呢?', FORMULA_QUESTION]);
  });
});

describe('面外问题:降级回复照常收束,登记需用户确认', () => {
  const OOS_QUESTION = '上季度员工离职率是多少?';

  function outOfScopePorts() {
    return buildAskPorts({
      script: {
        route: [{ businessDomains: ['运营分析'] }],
        unit: [{ outcome: 'out_of_scope', reason: '语义面内没有员工离职率相关指标' }]
      }
    });
  }

  it('确认续跑才登记面外缺口;幂等键取业务域 + 归一化问题', async () => {
    const first = outOfScopePorts();
    const firstRunner = createAskOrchestrationRunner(first.ports, { runId: 'gap-oos' });
    const firstEvents = await collect(firstRunner.run({ messages: userTurn(OOS_QUESTION) }));

    expect(gapEventsOf(firstEvents)).toEqual([]);
    const { interaction, messages } = interactionOf(firstEvents);
    expect(interaction.kind).toBe('confirm_gap_entry');

    const resume = buildAskPorts({ script: {} });
    const resumeRunner = createAskOrchestrationRunner(resume.ports, { runId: 'gap-oos-2' });
    const events = await collect(resumeRunner.run({ messages }));
    expect(stepTypes(events)).toEqual(['metric_gap_recorded']);
    expect(gapEventsOf(events)).toEqual([
      {
        idempotencyKey: scopeGapKey('运营分析', OOS_QUESTION),
        question: OOS_QUESTION,
        searchTerms: [],
        closestCandidates: [],
        adHocDefinition: null,
        expectedDimensions: [],
        expectedGranularity: null,
        businessDomain: '运营分析'
      }
    ]);
    expect(completedOf(events).document).toBeNull();
  });

  it('不确认、直接换个问题即放弃:不登记,待确认状态被清除', async () => {
    const first = outOfScopePorts();
    const firstRunner = createAskOrchestrationRunner(first.ports, { runId: 'gap-abandon' });
    const firstEvents = await collect(firstRunner.run({ messages: userTurn(OOS_QUESTION) }));
    const { messages } = interactionOf(firstEvents);

    // 新问题直接走正常流:全程没有缺口事件。
    const next = buildAskPorts({
      script: {
        route: [{ businessDomains: ['运营分析'] }],
        unit: [
          {
            outcome: 'unit',
            unit: {
              businessDomain: '运营分析',
              metrics: [{ kind: 'metric', name: 'Tokens消耗量' }],
              groupBy: ['统计周期'],
              filters: [],
              time: { granularity: 'month', start: '2026-01', end: '2026-06', providedBy: 'user' }
            }
          }
        ],
        intent: [{ intent: 'trend' }]
      }
    });
    const nextRunner = createAskOrchestrationRunner(next.ports, { runId: 'gap-abandon-2' });
    const nextEvents = await collect(
      nextRunner.run({ messages: userTurn('最近6个月Tokens消耗量趋势?', messages) })
    );
    expect(gapEventsOf(nextEvents)).toEqual([]);
    const baseline = completedOf(nextEvents).messages;

    // 之后的空白续跑也不会补登记:pendingGapEntry 已随新问题清除。
    const blank = buildAskPorts({ script: {} });
    const blankRunner = createAskOrchestrationRunner(blank.ports, { runId: 'gap-abandon-3' });
    const blankEvents = await collect(blankRunner.run({ messages: baseline }));
    expect(gapEventsOf(blankEvents)).toEqual([]);
  });
});

describe('部分可答:能答的照答,缺的单独列出(ADR-0036)', () => {
  const PARTIAL_QUESTION = '最近6个月Tokens消耗量和NPS的月度趋势?';

  function partialPorts() {
    return buildAskPorts({
      script: {
        route: [{ businessDomains: ['运营分析'] }],
        unit: [
          {
            outcome: 'unit',
            unit: {
              businessDomain: '运营分析',
              metrics: [{ kind: 'metric', name: 'Tokens消耗量' }],
              groupBy: ['统计周期'],
              filters: [],
              time: { granularity: 'month', start: '2026-01', end: '2026-06', providedBy: 'user' },
              title: 'Tokens 消耗趋势'
            },
            gaps: [{ aspect: 'NPS 趋势', reason: '语义面内没有 NPS 指标' }]
          }
        ],
        intent: [{ intent: 'trend' }]
      }
    });
  }

  it('可答部分照常执行出文档,缺口不混入同一数字或组件,单独列出待确认', async () => {
    const harness = partialPorts();
    const runner = createAskOrchestrationRunner(harness.ports, { runId: 'gap-partial' });
    const events = await collect(runner.run({ messages: userTurn(PARTIAL_QUESTION) }));

    // 能答的部分真实执行且产出文档;缺口部分未进入取数单元与页面文档。
    expect(harness.executions()).toBe(1);
    expect(stepTypes(events)).toEqual([
      'domain_routed',
      'candidates_retrieved',
      'scope_card_presented',
      'execution_started',
      'rows_ready',
      'document_ready'
    ]);
    const interactionEvent = events.find((event) => event.type === 'interaction_required');
    if (!interactionEvent || interactionEvent.type !== 'interaction_required') {
      throw new Error('部分可答应停在缺口登记确认');
    }
    expect(interactionEvent.interaction.kind).toBe('confirm_gap_entry');
    // 能答的部分照常交付:交互事件携带已通过校验的页面文档。
    const document = interactionEvent.document as Record<string, unknown>;
    expect(document).toBeTruthy();
    expect(validate(document)).toEqual([]);
    // 缺口不混入同一数字或同一组件:数据源与组件里只有可答的指标;
    // meta.description 是问题原文本身,不属于数字或组件。
    const dataJson = JSON.stringify({
      dataSources: document.dataSources,
      sections: document.sections
    });
    expect(dataJson).toContain('Tokens消耗量');
    expect(dataJson).not.toContain('NPS');

    // 缺的部分在回复里单独列出,并说明确认后才登记。
    const replies = events.flatMap((event) =>
      event.type === 'assistant_message' ? [event.message.content] : []
    );
    expect(replies.some((reply) => reply.includes('NPS 趋势') && reply.includes('缺口'))).toBe(
      true
    );
    expect(gapEventsOf(events)).toEqual([]);

    // 确认续跑登记缺口出现:检索词为缺失口径描述,期望维度与粒度来自本问。
    const resume = buildAskPorts({ script: {} });
    const resumeRunner = createAskOrchestrationRunner(resume.ports, { runId: 'gap-partial-2' });
    const resumeEvents = await collect(resumeRunner.run({ messages: interactionEvent.messages }));
    expect(gapEventsOf(resumeEvents)).toEqual([
      {
        idempotencyKey: scopeGapKey('运营分析', 'NPS 趋势'),
        question: PARTIAL_QUESTION,
        searchTerms: ['NPS 趋势'],
        closestCandidates: [
          {
            metricName: 'Tokens消耗量',
            businessDomain: '运营分析',
            definitionDifference: expect.any(String)
          }
        ],
        adHocDefinition: null,
        expectedDimensions: ['统计周期'],
        expectedGranularity: 'month',
        businessDomain: '运营分析'
      }
    ]);
  });

  it('经推送通道:部分可答的 outcome 携带文档,缺口事件随会话事件流落库', async () => {
    const sessions = createMemoryAnalysisSessionStore();
    const persist = async (sessionId: string, event: Parameters<typeof sessions.appendEvent>[0]['event']) => {
      await sessions.appendEvent({ sessionId, event }, IDENTITY);
    };

    const harness = partialPorts();
    let outcome: AgentRunOutcome | null = null;
    for await (const frame of streamAgentRun({
      runner: createAskOrchestrationRunner(harness.ports, { runId: 'gap-stream' }),
      runId: 'gap-stream',
      messages: userTurn(PARTIAL_QUESTION),
      sessionId: 'session-gap',
      persistStepEvent: persist,
      onOutcome: (finalOutcome) => {
        outcome = finalOutcome;
      },
      auditSink: () => {}
    })) {
      void frame;
    }
    const firstOutcome = outcome as unknown as AgentRunOutcome;
    expect(firstOutcome.status).toBe('interaction_required');
    // 能答的部分照常交付到工作台:outcome 帧携带已校验文档。
    expect(firstOutcome.document).not.toBeNull();
    expect(validate(firstOutcome.document!)).toEqual([]);

    // 确认续跑:缺口事件经同一条步骤事件通道落库,不另建采集通道。
    outcome = null;
    const resume = buildAskPorts({ script: {} });
    for await (const frame of streamAgentRun({
      runner: createAskOrchestrationRunner(resume.ports, { runId: 'gap-stream-2' }),
      runId: 'gap-stream-2',
      messages: firstOutcome.messages,
      sessionId: 'session-gap',
      persistStepEvent: persist,
      onOutcome: (finalOutcome) => {
        outcome = finalOutcome;
      },
      auditSink: () => {}
    })) {
      void frame;
    }
    expect((outcome as unknown as AgentRunOutcome).status).toBe('completed');

    const stored = await sessions.getSession({ sessionId: 'session-gap' }, IDENTITY);
    if (!stored.ok) throw new Error(stored.error.message);
    const gapEvents = stored.session.events.filter(
      (entry) => entry.event.type === 'metric_gap_recorded'
    );
    expect(gapEvents).toHaveLength(1);

    // 台账直接从会话存储聚合出条目。
    const ledger = createSessionMetricGapLedger({
      sessions,
      metricExists: async () => false
    });
    const { entries } = await ledger.listEntries(IDENTITY);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      idempotencyKey: scopeGapKey('运营分析', 'NPS 趋势'),
      occurrenceCount: 1,
      status: 'open'
    });
  });
});
