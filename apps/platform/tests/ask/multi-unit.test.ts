import { describe, expect, it } from 'vitest';
import { validate } from '@metriccanvas/page';
import { createAskOrchestrationRunner } from '../../src/lib/server/ask/orchestrator';
import {
  ASK_STATE_PREFIX,
  parseAskConversation
} from '../../src/lib/ask/conversation';
import type {
  AskDataRequestUnitState,
  AskUnitFormingDecision
} from '../../src/lib/server/ask/ports';
import type { AgentMessage } from '../../src/lib/server/agent/types';
import type { AskIntentDecision } from '../../src/lib/server/ask/ports';
import {
  buildAskPorts,
  collect,
  completedOf,
  stepEvents,
  userTurn,
  type AskTestPorts
} from './support/ask-harness';

/**
 * 多取数单元模型的编排自证:会话状态是单元集合,口径成形是定向单元
 * 操作集(新增/定向 patch/整单元重写/删除),未被触及的单元结构性不变
 * (ADR-0037)且不重新执行——查询定义与初始行从随请求传回的 draft 文档
 * 逐字节复用。覆盖:
 * - 真实会话暴露的五轮对话逐轮重放(#66 交付后的核心能力缺口);
 * - target(画布选中组件)定向:patch 落在组件所绑数据源对应的单元;
 * - 一轮多操作(拆分 = modify + add)与删除单元;
 * - 历史单 unit 会话状态的兼容读取与继续追问。
 */

const CHART_TYPES = ['lineChart', 'barChart', 'pieChart'];

const NEW_CUSTOMER_TREND: AskDataRequestUnitState = {
  businessDomain: '客户经营',
  metrics: [{ kind: 'metric', name: '新增客户数' }],
  groupBy: ['统计周期'],
  filters: [],
  time: { granularity: 'month', start: '2026-01', end: '2026-06', providedBy: 'user' },
  title: '2026年上半年新增客户数走势'
};

const CHURN_TREND: AskDataRequestUnitState = {
  businessDomain: '客户经营',
  metrics: [{ kind: 'metric', name: '流失客户数' }],
  groupBy: ['统计周期'],
  filters: [],
  time: { granularity: 'month', start: '2026-01', end: '2026-06', providedBy: 'user' },
  title: '2026年上半年流失客户数走势'
};

interface RoundResult {
  harness: AskTestPorts;
  events: Awaited<ReturnType<typeof collect>>;
  document: Record<string, unknown>;
  baseline: AgentMessage[];
}

async function runRound(input: {
  runId: string;
  question: string;
  baseline?: AgentMessage[];
  draft?: Record<string, unknown>;
  target?: { sectionId: string; componentId: string };
  unit?: AskUnitFormingDecision[];
  intent?: AskIntentDecision[];
  route?: Array<{ businessDomains: string[] }>;
  expectDocument?: boolean;
}): Promise<RoundResult> {
  const harness = buildAskPorts({
    script: {
      ...(input.route === undefined ? {} : { route: input.route }),
      unit: input.unit ?? [],
      intent: input.intent ?? []
    }
  });
  const runner = createAskOrchestrationRunner(harness.ports, {
    runId: input.runId,
    ...(input.draft === undefined ? {} : { draft: input.draft }),
    ...(input.target === undefined ? {} : { target: input.target })
  });
  const events = await collect(
    runner.run({ messages: userTurn(input.question, input.baseline ?? []) })
  );
  const { document, messages } = completedOf(events);
  if (input.expectDocument !== false) {
    expect(document).not.toBeNull();
    expect(validate(document!)).toEqual([]);
  }
  return { harness, events, document: document!, baseline: messages };
}

function componentsOf(document: Record<string, unknown>): Array<{
  id: string;
  type: string;
  data: { main: string };
  props: Record<string, unknown>;
}> {
  const sections = document.sections as Array<{ components: never[] }>;
  return sections.flatMap((section) => section.components);
}

function dataSourceOf(document: Record<string, unknown>, id: string): unknown {
  return (document.dataSources as Record<string, unknown>)[id];
}

function outputMetricsOf(document: Record<string, unknown>, id: string): unknown[] {
  const dataSource = dataSourceOf(document, id) as {
    source: { query: { body: { dsl_list: Array<{ output_metrics: unknown[] }> } } };
  };
  return dataSource.source.query.body.dsl_list[0]!.output_metrics;
}

function documentReadyOf(events: Awaited<ReturnType<typeof collect>>) {
  const event = stepEvents(events).find((entry) => entry.type === 'document_ready');
  if (event?.type !== 'document_ready') throw new Error('缺少 document_ready 步骤');
  return event;
}

describe('五轮真实场景重放:单取数单元 → 多取数单元', () => {
  it('逐轮产出期望的单元集合与组件;未触及单元的数据源逐字节不变', async () => {
    /* ---- 第 1 轮:新增客户数走势 → 单折线图 ---- */
    const round1 = await runRound({
      runId: 'replay-1',
      question: '2026年上半年每个月的新增客户数走势如何?',
      route: [{ businessDomains: ['客户经营'] }],
      unit: [{ outcome: 'unit', unit: NEW_CUSTOMER_TREND }],
      intent: [{ intent: 'trend' }]
    });
    expect(Object.keys(round1.document.dataSources as object)).toEqual(['result']);
    expect(componentsOf(round1.document).map((component) => component.type)).toEqual([
      'lineChart'
    ]);
    expect(round1.harness.executions()).toBe(1);

    /* ---- 第 2 轮:「增加一个流失客户的走势」→ 新增单元,原组件不变 ---- */
    const round2 = await runRound({
      runId: 'replay-2',
      question: '页面中,增加一个流失客户的走势',
      baseline: round1.baseline,
      draft: round1.document,
      unit: [{ outcome: 'operations', operations: [{ op: 'add', unit: CHURN_TREND }] }],
      intent: [{ intent: 'trend' }]
    });
    expect(Object.keys(round2.document.dataSources as object)).toEqual([
      'result',
      'result-2'
    ]);
    const round2Components = componentsOf(round2.document);
    expect(round2Components).toHaveLength(2);
    // 原折线组件不变(组件级逐字节比对),新增走势组件承载流失客户数。
    expect(JSON.stringify(round2Components[0])).toBe(
      JSON.stringify(componentsOf(round1.document)[0])
    );
    expect(round2Components[1]!.data.main).toBe('result-2');
    expect(round2Components[1]!.type).toBe('lineChart');
    // 未触及单元不重新执行:本轮只执行新增单元,原数据源逐字节复用 draft。
    expect(round2.harness.executions()).toBe(1);
    expect(JSON.stringify(dataSourceOf(round2.document, 'result'))).toBe(
      JSON.stringify(dataSourceOf(round1.document, 'result'))
    );
    // 每单元事件:执行事件只出现一次且带新增单元的数据源名。
    const round2Executions = stepEvents(round2.events).filter(
      (event) => event.type === 'execution_started'
    );
    expect(round2Executions).toHaveLength(1);
    expect(round2Executions[0]).toMatchObject({ dataSourceId: 'result-2' });

    /* ---- 第 3 轮:「改成两个表格」→ 两个单元各自呈现为表格 ---- */
    const round3 = await runRound({
      runId: 'replay-3',
      question: '改成两个表格',
      baseline: round2.baseline,
      draft: round2.document,
      // 模型把纯展示追问误判为面外:确定性保护按空操作集继续。
      unit: [{ outcome: 'out_of_scope', reason: '展示方式不属于取数职责' }]
    });
    expect(componentsOf(round3.document).map((component) => component.type)).toEqual([
      'table',
      'table'
    ]);
    // 两个单元都未被触及:零执行,数据源整体逐字节不变。
    expect(round3.harness.executions()).toBe(0);
    expect(JSON.stringify(round3.document.dataSources)).toBe(
      JSON.stringify(round2.document.dataSources)
    );
    expect(documentReadyOf(round3.events).components).toMatchObject([
      { componentType: 'table', pinnedByUser: true, dataSourceId: 'result' },
      { componentType: 'table', pinnedByUser: true, dataSourceId: 'result-2' }
    ]);

    /* ---- 第 4 轮:「换成两个图表,分别展示增加和流失」→ 各自图表类组件 ---- */
    const round4 = await runRound({
      runId: 'replay-4',
      question: '换成两个图表,分别展示增加和流失',
      baseline: round3.baseline,
      draft: round3.document,
      // 单元集合已按指标拆分:本轮没有口径变化,泛词「图表」解除表格点名。
      unit: [{ outcome: 'operations', operations: [] }]
    });
    const round4Components = componentsOf(round4.document);
    expect(round4Components).toHaveLength(2);
    for (const component of round4Components) {
      expect(CHART_TYPES).toContain(component.type);
    }
    // 各绑一个指标。
    expect(outputMetricsOf(round4.document, 'result')).toEqual(['新增客户数']);
    expect(outputMetricsOf(round4.document, 'result-2')).toEqual(['流失客户数']);
    expect(round4.harness.executions()).toBe(0);
    expect(JSON.stringify(round4.document.dataSources)).toBe(
      JSON.stringify(round2.document.dataSources)
    );

    /* ---- 第 5 轮:「增加一个折线图,展示流失客户数」→ 新增折线图单元 ---- */
    const round5 = await runRound({
      runId: 'replay-5',
      question: '增加一个折线图,展示流失客户数',
      baseline: round4.baseline,
      draft: round4.document,
      unit: [
        {
          outcome: 'operations',
          operations: [{ op: 'add', unit: { ...CHURN_TREND, title: '流失客户数折线' } }]
        }
      ],
      intent: [{ intent: 'trend' }]
    });
    expect(Object.keys(round5.document.dataSources as object)).toEqual([
      'result',
      'result-2',
      'result-3'
    ]);
    const round5Components = componentsOf(round5.document);
    expect(round5Components).toHaveLength(3);
    const addedComponent = round5Components.find(
      (component) => component.data.main === 'result-3'
    );
    expect(addedComponent?.type).toBe('lineChart');
    expect(documentReadyOf(round5.events).components).toMatchObject([
      { dataSourceId: 'result' },
      { dataSourceId: 'result-2' },
      { componentType: 'lineChart', pinnedByUser: true, dataSourceId: 'result-3' }
    ]);
    // 显式点名只作用于新增单元,未触及单元的数据源仍逐字节不变。
    expect(round5.harness.executions()).toBe(1);
    expect(JSON.stringify(dataSourceOf(round5.document, 'result'))).toBe(
      JSON.stringify(dataSourceOf(round2.document, 'result'))
    );
    expect(JSON.stringify(dataSourceOf(round5.document, 'result-2'))).toBe(
      JSON.stringify(dataSourceOf(round2.document, 'result-2'))
    );
  });
});

describe('target 定向:请求 target 映射为组件所绑数据源对应的单元', () => {
  async function twoUnits(): Promise<RoundResult> {
    return runRound({
      runId: 'target-base',
      question: '2026年上半年新增与流失客户数走势',
      route: [{ businessDomains: ['客户经营'] }],
      unit: [
        {
          outcome: 'operations',
          operations: [
            { op: 'add', unit: NEW_CUSTOMER_TREND },
            { op: 'add', unit: CHURN_TREND }
          ]
        }
      ],
      intent: [{ intent: 'trend' }, { intent: 'trend' }]
    });
  }

  it('带 target 的追问:定向 patch 落在 target 对应单元,另一单元逐字节不变', async () => {
    const base = await twoUnits();
    const targetComponent = componentsOf(base.document).find(
      (component) => component.data.main === 'result-2'
    )!;

    const followUp = await runRound({
      runId: 'target-patch',
      question: '这个只看金融行业',
      baseline: base.baseline,
      draft: base.document,
      target: { sectionId: 'main', componentId: targetComponent.id },
      // 单单元简写 patch:编排把它定向到 target 对应单元。
      unit: [
        { outcome: 'patch', patch: { filters: [{ dimension: '行业', values: ['金融'] }] } }
      ],
      intent: [{ intent: 'trend' }]
    });

    // 模型口径成形收到了 target 对应的数据源名。
    expect(followUp.harness.scripted.calls.unit[0]?.targetDataSourceId).toBe('result-2');
    // patch 落在 result-2:筛选生效;result 未被触及,逐字节不变。
    const patched = dataSourceOf(followUp.document, 'result-2') as {
      source: {
        query: { body: { dsl_list: Array<{ filter: { dims: unknown[] } }> } };
      };
    };
    expect(patched.source.query.body.dsl_list[0]!.filter.dims).toEqual([
      { dim_name: '行业', dim_value_list: ['金融'] }
    ]);
    expect(JSON.stringify(dataSourceOf(followUp.document, 'result'))).toBe(
      JSON.stringify(dataSourceOf(base.document, 'result'))
    );
    expect(followUp.harness.executions()).toBe(1);
  });

  it('带 target 的显式组件点名只作用于该单元', async () => {
    const base = await twoUnits();
    const targetComponent = componentsOf(base.document).find(
      (component) => component.data.main === 'result'
    )!;
    const followUp = await runRound({
      runId: 'target-component',
      question: '这个改成柱状图',
      baseline: base.baseline,
      draft: base.document,
      target: { sectionId: 'main', componentId: targetComponent.id },
      unit: [{ outcome: 'operations', operations: [] }]
    });
    expect(documentReadyOf(followUp.events).components).toMatchObject([
      { componentType: 'barChart', pinnedByUser: true, dataSourceId: 'result' },
      { componentType: 'lineChart', pinnedByUser: false, dataSourceId: 'result-2' }
    ]);
    expect(followUp.harness.executions()).toBe(0);
  });
});

describe('一轮多操作与删除单元', () => {
  it('拆分 = 修改原单元去掉一个指标 + 新增承载另一指标的单元', async () => {
    const base = await runRound({
      runId: 'split-base',
      question: '2026年上半年新增和流失客户数走势',
      route: [{ businessDomains: ['客户经营'] }],
      unit: [
        {
          outcome: 'unit',
          unit: {
            ...NEW_CUSTOMER_TREND,
            metrics: [
              { kind: 'metric', name: '新增客户数' },
              { kind: 'metric', name: '流失客户数' }
            ]
          }
        }
      ],
      intent: [{ intent: 'trend' }]
    });
    expect(outputMetricsOf(base.document, 'result')).toEqual(['新增客户数', '流失客户数']);

    const split = await runRound({
      runId: 'split-round',
      question: '换成两个图表,分别展示新增和流失',
      baseline: base.baseline,
      draft: base.document,
      unit: [
        {
          outcome: 'operations',
          operations: [
            {
              op: 'modify',
              dataSourceId: 'result',
              patch: { metrics: [{ kind: 'metric', name: '新增客户数' }] }
            },
            { op: 'add', unit: CHURN_TREND }
          ]
        }
      ],
      intent: [{ intent: 'trend' }, { intent: 'trend' }]
    });
    expect(outputMetricsOf(split.document, 'result')).toEqual(['新增客户数']);
    expect(outputMetricsOf(split.document, 'result-2')).toEqual(['流失客户数']);
    // 两个单元都被触及:各自重新走清单校验→真实执行。
    expect(split.harness.executions()).toBe(2);
    const splitComponents = componentsOf(split.document);
    expect(splitComponents).toHaveLength(2);
    for (const component of splitComponents) {
      expect(CHART_TYPES).toContain(component.type);
    }
  });

  it('拆分携带点名:「拆分成两个表格」作用于被触及的全部单元,原单元的旧点名被覆盖', async () => {
    // base 轮:单单元 + 「柱状图」点名(requestedComponent=barChart 进状态)。
    const base = await runRound({
      runId: 'split-pin-base',
      question: '新增和流失客户数走势,用柱状图',
      route: [{ businessDomains: ['客户经营'] }],
      unit: [
        {
          outcome: 'unit',
          unit: {
            ...NEW_CUSTOMER_TREND,
            metrics: [
              { kind: 'metric', name: '新增客户数' },
              { kind: 'metric', name: '流失客户数' }
            ]
          }
        }
      ],
      intent: [{ intent: 'trend' }]
    });
    expect(componentsOf(base.document)[0]!.type).toBe('barChart');

    // 拆分轮(modify + add)携带「表格」点名:修复前点名只作用于新增单元,
    // 原单元保持旧点名 barChart——真实会话暴露的缺陷。
    const split = await runRound({
      runId: 'split-pin-round',
      question: '拆分成两个表格,并排展示',
      baseline: base.baseline,
      draft: base.document,
      unit: [
        {
          outcome: 'operations',
          operations: [
            {
              op: 'modify',
              dataSourceId: 'result',
              patch: { metrics: [{ kind: 'metric', name: '新增客户数' }] }
            },
            { op: 'add', unit: CHURN_TREND }
          ]
        }
      ],
      intent: [{ intent: 'trend' }, { intent: 'trend' }]
    });
    const components = componentsOf(split.document);
    expect(components).toHaveLength(2);
    expect(components.map((component) => component.type)).toEqual(['table', 'table']);
  });

  it('删除指定单元:文档只剩存留单元,存留单元不重新执行', async () => {
    const base = await runRound({
      runId: 'remove-base',
      question: '新增与流失客户数走势',
      route: [{ businessDomains: ['客户经营'] }],
      unit: [
        {
          outcome: 'operations',
          operations: [
            { op: 'add', unit: NEW_CUSTOMER_TREND },
            { op: 'add', unit: CHURN_TREND }
          ]
        }
      ],
      intent: [{ intent: 'trend' }, { intent: 'trend' }]
    });
    const removed = await runRound({
      runId: 'remove-round',
      question: '去掉流失客户数那个',
      baseline: base.baseline,
      draft: base.document,
      unit: [
        { outcome: 'operations', operations: [{ op: 'remove', dataSourceId: 'result-2' }] }
      ]
    });
    expect(Object.keys(removed.document.dataSources as object)).toEqual(['result']);
    expect(componentsOf(removed.document)).toHaveLength(1);
    expect(removed.harness.executions()).toBe(0);
    expect(JSON.stringify(dataSourceOf(removed.document, 'result'))).toBe(
      JSON.stringify(dataSourceOf(base.document, 'result'))
    );
  });
});

describe('历史会话兼容:旧单 unit 状态消息', () => {
  /** #66 单单元时期的状态消息形状(顶层 unit/intent/requestedComponent)。 */
  function legacyStateMessage(): AgentMessage {
    return {
      role: 'system',
      content:
        ASK_STATE_PREFIX +
        JSON.stringify({
          version: 1,
          businessDomains: ['客户经营'],
          domainsOverriddenByUser: false,
          unit: NEW_CUSTOMER_TREND,
          intent: 'trend',
          requestedComponent: null,
          transientPageId: 'ask-transient-legacy',
          formulaTraces: [],
          pending: null
        })
    };
  }

  it('旧状态被迁移为单元素集合(数据源名沿用 result)并能继续追问', async () => {
    const followUp = await runRound({
      runId: 'legacy-follow-up',
      question: '只看金融行业',
      baseline: [legacyStateMessage()],
      unit: [
        { outcome: 'patch', patch: { filters: [{ dimension: '行业', values: ['金融'] }] } }
      ],
      intent: [{ intent: 'trend' }]
    });

    // 模型看到的基线是迁移后的单元素集合,数据源名沿用历史值 result。
    expect(followUp.harness.scripted.calls.unit[0]?.previousUnits).toMatchObject([
      { dataSourceId: 'result', unit: { businessDomain: '客户经营' } }
    ]);
    // 追问不重路由:域沿用旧状态(route 脚本为空即证明)。
    expect(followUp.harness.scripted.calls.route).toHaveLength(0);
    // patch 生效,文档数据源仍是 result。
    expect(Object.keys(followUp.document.dataSources as object)).toEqual(['result']);
    const patched = dataSourceOf(followUp.document, 'result') as {
      source: { query: { body: { dsl_list: Array<{ filter: { dims: unknown[] } }> } } };
    };
    expect(patched.source.query.body.dsl_list[0]!.filter.dims).toEqual([
      { dim_name: '行业', dim_value_list: ['金融'] }
    ]);

    // 完成后的状态已是新形状:单元素集合 + 单元级意图。
    const state = parseAskConversation(followUp.baseline).state;
    expect(state.units).toMatchObject([
      { dataSourceId: 'result', unit: { businessDomain: '客户经营' }, intent: 'trend' }
    ]);
    expect(state.nextUnitOrdinal).toBe(2);
  });
});
