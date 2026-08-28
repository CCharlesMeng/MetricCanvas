import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validate } from '@metriccanvas/page';
import type { ExecuteDataRequestUnitQuery } from '@metriccanvas/mcp';
import {
  createDqeSimServer,
  DQE_EXECUTE_PATH
} from '../../../../tools/dqe-sim/src/server';
import { createServerDataGateway } from '../../src/lib/server/data-gateway.server';
import { createRunAwareUnitQueryExecutor } from '../../src/lib/server/agent/run-mcp';
import {
  createAskOrchestrationRunner,
  transientPageIdFor
} from '../../src/lib/server/ask/orchestrator';
import { FAILURE_STAGES } from '../../src/lib/server/session/step-event';
import type {
  AskDataRequestUnitState,
  AskIntentDecision,
  AskUnitTime
} from '../../src/lib/server/ask/ports';
import {
  buildAskPorts,
  collect,
  completedOf,
  interactionOf,
  stepEvents,
  userTurn,
  type AskTestPorts
} from './support/ask-harness';

/**
 * 黄金问题集端到端(#69):评测样本驱动的确定性 CI 验收。
 *
 * 与 end-to-end.test.ts 的分工:那边验证推送通道与落库;这里验证从黄金
 * 问题集样本出发的完整取数链路——scripted 模型按样本期望值回放结构化
 * 决策(模型正确性由真实模型评测按需衡量,不进 CI),检索、消歧、验真、
 * **真实 DQE 仿真执行**(进程内 HTTP,走生产数据网关)与装配全部使用
 * 生产实现。覆盖 issue #69 的四条验收:
 * - 一句问题走到真实取数并渲染成功(文档过 validate);
 * - 换一个同面内组合仍能取到数,证明不是回放;
 * - 面外问题明确降级并给出四段分类,不伪造数据;
 * - 近义歧义阻塞消歧,确认后按用户选中的口径执行。
 */

interface GoldenSample {
  id: string;
  category: 'direct' | 'clarify' | 'no_metric' | 'cross_domain';
  question: string;
  expected: {
    status: string;
    domain?: string;
    metrics?: string[];
    groupBy?: string[];
    filters?: Array<{ dimension: string; values: string[] }>;
    granularity?: string;
    timeScope?: string;
    clarifyCandidateDomains?: string[];
  };
}

const golden = (
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../scripts/fixtures/golden-questions.json', import.meta.url)),
      'utf8'
    )
  ) as { samples: GoldenSample[] }
).samples;

const byCategory = (category: GoldenSample['category']) =>
  golden.filter((sample) => sample.category === category);

/* ---------- 真实 DQE 仿真(进程内 HTTP)与生产数据网关 ---------- */

let closeSim: () => Promise<void>;
let dqeEndpoint: string;

beforeAll(async () => {
  const server = createDqeSimServer({ logger: false });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  dqeEndpoint = `http://127.0.0.1:${port}${DQE_EXECUTE_PATH}`;
  closeSim = () =>
    new Promise<void>((resolve, reject) =>
      server.close((cause) => (cause ? reject(cause) : resolve()))
    );
});

afterAll(async () => {
  await closeSim();
});

/** 真实执行端口:生产适配器(run-mcp.ts)→ 生产数据网关 → 进程内 DQE 仿真。 */
function simExecutor(): { execute: ExecuteDataRequestUnitQuery; executions: () => number } {
  let executions = 0;
  const gateway = createServerDataGateway({
    environment: { DQE_ENDPOINT: dqeEndpoint },
    actor: { actorId: 'golden-eval', clientId: 'workbench', roles: [] },
    diagnosticsSink: () => {}
  });
  const execute = createRunAwareUnitQueryExecutor({
    gateway
  });
  return {
    executions: () => executions,
    async execute(query) {
      executions += 1;
      return execute(query, undefined);
    }
  };
}

/* ---------- 样本期望值 → scripted 决策(评测时钟 2026-08-13) ---------- */

/** 期望时间口径(业务语言)的确定性求值;新增口径说法必须在这里显式登记。 */
function timeOf(sample: GoldenSample): AskUnitTime {
  const month = (offset: number): string => {
    const date = new Date(Date.UTC(2026, 7 + offset, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  };
  const ranges: Record<string, { start: string; end: string }> = {
    上个月: { start: month(-1), end: month(-1) },
    今年以来: { start: '2026-01', end: month(0) },
    最近6个月: { start: month(-5), end: month(0) }
  };
  const scope = sample.expected.timeScope;
  const range = scope === undefined ? undefined : ranges[scope];
  if (!range) {
    throw new Error(`样本 ${sample.id} 的期望时间口径「${scope}」没有登记求值规则`);
  }
  return {
    granularity: sample.expected.granularity ?? 'month',
    ...range,
    providedBy: 'user'
  };
}

function unitOf(sample: GoldenSample): AskDataRequestUnitState {
  return {
    businessDomain: sample.expected.domain!,
    metrics: (sample.expected.metrics ?? []).map((name) => ({ kind: 'metric', name })),
    groupBy: sample.expected.groupBy ?? [],
    filters: (sample.expected.filters ?? []).map((filter) => ({
      dimension: filter.dimension,
      values: [...filter.values]
    })),
    time: timeOf(sample),
    title: sample.question
  };
}

function intentOf(sample: GoldenSample): AskIntentDecision {
  const groupBy = sample.expected.groupBy ?? [];
  if (groupBy.includes('统计周期')) return { intent: 'trend' };
  if (groupBy.length === 0) return { intent: 'single_value' };
  return { intent: 'comparison' };
}

async function runQuestion(
  harness: AskTestPorts,
  input: {
    runId: string;
    question: string | null;
    baseline?: Parameters<typeof userTurn>[1];
    scopeConfirmations?: Array<{
      interactionId: string;
      selectedMetric?: { businessDomain: string; metricName: string };
    }>;
  }
) {
  const runner = createAskOrchestrationRunner(harness.ports, {
    runId: input.runId,
    ...(input.scopeConfirmations === undefined
      ? {}
      : { scopeConfirmations: input.scopeConfirmations })
  });
  const messages =
    input.question === null
      ? [...(input.baseline ?? [])]
      : userTurn(input.question, input.baseline ?? []);
  return collect(runner.run({ messages }));
}

/* ---------- 直答:一句问题走到真实取数并渲染成功 ---------- */

describe('黄金问题集·直答:真实取数与可渲染文档', () => {
  it.each(byCategory('direct').map((sample) => ({ id: sample.id, sample })))(
    '$id:完整阶段序列,仿真返回真实数据行,文档通过页面校验',
    async ({ sample }) => {
      const executor = simExecutor();
      const harness = buildAskPorts({
        script: {
          route: [{ businessDomains: [sample.expected.domain!] }],
          unit: [{ outcome: 'unit', unit: unitOf(sample) }],
          intent: [intentOf(sample)]
        },
        executor
      });
      const events = await runQuestion(harness, {
        runId: `golden-${sample.id}`,
        question: sample.question
      });

      const steps = stepEvents(events);
      expect(steps.map((step) => step.type)).toEqual([
        'domain_routed',
        'candidates_retrieved',
        'scope_card_presented',
        'execution_started',
        'rows_ready',
        'document_ready'
      ]);

      const routed = steps.find((step) => step.type === 'domain_routed');
      expect(routed?.type === 'domain_routed' && routed.routedDomains).toContain(
        sample.expected.domain
      );
      const scopeCard = steps.find((step) => step.type === 'scope_card_presented');
      if (scopeCard?.type === 'scope_card_presented') {
        expect(scopeCard.blockedOnConfirmation).toBe(false);
        expect(scopeCard.granularity).toBe(sample.expected.granularity);
      }

      // 真实取数:恰好一次执行,经生产数据网关从 DQE 仿真取回非空数据行。
      expect(executor.executions()).toBe(1);
      const rowsReady = steps.find((step) => step.type === 'rows_ready');
      if (rowsReady?.type !== 'rows_ready') throw new Error('缺少 rows_ready 步骤');
      expect(rowsReady.summary.rowCount).toBeGreaterThan(0);
      for (const metricName of sample.expected.metrics ?? []) {
        expect(rowsReady.summary.outputFields).toContain(metricName);
      }

      // 渲染成功的确定性代理:文档通过 validate,数据源内嵌真实初始行。
      const { document } = completedOf(events);
      expect(document).not.toBeNull();
      expect(validate(document!)).toEqual([]);
      expect(document!.id).toBe(transientPageIdFor(`golden-${sample.id}`));
      const dataSources = document!.dataSources as Record<
        string,
        { source: { type: string; initial?: { rows: Array<Record<string, unknown>> } } }
      >;
      expect(dataSources.result!.source.type).toBe('query');
      expect(dataSources.result!.source.initial!.rows.length).toBe(
        rowsReady.summary.rowCount
      );
    }
  );
});

/* ---------- 同面内换组合:证明不是回放 ---------- */

describe('黄金问题集·同面内换组合(不是回放)', () => {
  it('不同的指标×维度组合都能从仿真取到数,且数据行内容不同', async () => {
    const first = golden.find((sample) => sample.id === 'gq-direct-1')!;
    const second = golden.find((sample) => sample.id === 'gq-direct-5')!;
    const rowsOf = async (sample: GoldenSample) => {
      const harness = buildAskPorts({
        script: {
          route: [{ businessDomains: [sample.expected.domain!] }],
          unit: [{ outcome: 'unit', unit: unitOf(sample) }],
          intent: [intentOf(sample)]
        },
        executor: simExecutor()
      });
      const events = await runQuestion(harness, {
        runId: `golden-replay-${sample.id}`,
        question: sample.question
      });
      const { document } = completedOf(events);
      const dataSources = document!.dataSources as Record<
        string,
        { source: { initial?: { rows: Array<Record<string, unknown>> } } }
      >;
      return dataSources.result!.source.initial!.rows;
    };

    const firstRows = await rowsOf(first);
    const secondRows = await rowsOf(second);
    expect(firstRows.length).toBeGreaterThan(0);
    expect(secondRows.length).toBeGreaterThan(0);
    // 两个组合的输出字段与数据行不同:同一语义面按组合合成,不是录制回放。
    expect(Object.keys(firstRows[0]!)).not.toEqual(Object.keys(secondRows[0]!));
  });

  it('黄金问题集之外的全新组合同样取到数(语义面组合闭集,无预录样本)', async () => {
    // 该组合(客户留存率 × 客户级别 × 金融行业筛选)不在任何评测样本或
    // 仿真精确匹配 fixture 里;能取到数只能来自语义面的组合式合成。
    const unit: AskDataRequestUnitState = {
      businessDomain: '客户经营',
      metrics: [{ kind: 'metric', name: '客户留存率' }],
      groupBy: ['客户级别'],
      filters: [{ dimension: '行业', values: ['金融'] }],
      time: { granularity: 'month', start: '2026-05', end: '2026-07', providedBy: 'user' },
      title: '金融行业各客户级别的客户留存率'
    };
    const executor = simExecutor();
    const harness = buildAskPorts({
      script: {
        route: [{ businessDomains: ['客户经营'] }],
        unit: [{ outcome: 'unit', unit }],
        intent: [{ intent: 'comparison' }]
      },
      executor
    });
    const events = await runQuestion(harness, {
      runId: 'golden-fresh-combo',
      question: '金融行业各客户级别的客户留存率是多少?'
    });
    const rowsReady = stepEvents(events).find((step) => step.type === 'rows_ready');
    if (rowsReady?.type !== 'rows_ready') throw new Error('缺少 rows_ready 步骤');
    expect(rowsReady.summary.rowCount).toBeGreaterThan(0);
    expect(validate(completedOf(events).document!)).toEqual([]);
  });
});

/* ---------- 需澄清:消歧阻塞,确认后按选中口径执行 ---------- */

describe('黄金问题集·需澄清:近义指标阻塞消歧', () => {
  const clarifyTime: Record<string, AskUnitTime> = {
    'gq-clarify-1': { granularity: 'month', start: '2026-06', end: '2026-06', providedBy: 'user' },
    'gq-clarify-2': { granularity: 'month', start: '2026-01', end: '2026-06', providedBy: 'user' }
  };

  it.each(byCategory('clarify').map((sample) => ({ id: sample.id, sample })))(
    '$id:候选覆盖两域并阻塞;确认后按用户选中口径进入真实执行',
    async ({ sample }) => {
      const executor = simExecutor();
      const domains = sample.expected.clarifyCandidateDomains!;
      const harness = buildAskPorts({
        script: {
          route: [{ businessDomains: [...domains] }],
          // 正确的模型行为:歧义候选不写入 metrics(消歧只能由用户完成)。
          unit: [
            {
              outcome: 'unit',
              unit: {
                businessDomain: domains[0]!,
                metrics: [],
                groupBy: [],
                filters: [],
                time: clarifyTime[sample.id]!,
                title: sample.question
              }
            }
          ],
          intent: [{ intent: 'single_value' }]
        },
        executor
      });

      const blocked = await runQuestion(harness, {
        runId: `golden-${sample.id}`,
        question: sample.question
      });
      const { interaction, messages } = interactionOf(blocked);
      expect(interaction.kind).toBe('confirm_scope_card');
      const candidates = interaction.payload.candidates as Array<{
        businessDomain: string;
      }>;
      for (const domain of domains) {
        expect(candidates.map((candidate) => candidate.businessDomain)).toContain(domain);
      }
      // 消歧未决不执行:系统与模型都不替用户选(ADR-0037)。
      expect(executor.executions()).toBe(0);

      const resumed = await runQuestion(harness, {
        runId: `golden-${sample.id}-resume`,
        question: null,
        baseline: messages,
        scopeConfirmations: [
          {
            interactionId: interaction.id,
            selectedMetric: { businessDomain: '客户经营', metricName: '客户数' }
          }
        ]
      });
      const steps = stepEvents(resumed);
      const scopeCard = steps.find((step) => step.type === 'scope_card_presented');
      if (scopeCard?.type !== 'scope_card_presented') throw new Error('缺少取数核对');
      expect(scopeCard.businessDomain).toBe('客户经营');
      expect(scopeCard.metricName).toBe('客户数');
      expect(scopeCard.blockedOnConfirmation).toBe(false);
      expect(steps.some((step) => step.type === 'execution_started')).toBe(true);
      expect(executor.executions()).toBeGreaterThan(0);
      // 已知限制(记入 #69 验收报告):生效查询的 DQE 请求体没有业务域
      // 承载位,「客户数」这类跨域同名指标在取数单元不含任何域内维度/
      // 筛选时,仿真在协议层无法定位业务域,如实按执行段降级、不编造。
      // 域承载方式关联 ADR 基线未决事项「英文 metric_code 与 DQE 中文
      // 指标名的关系」,待真实数据源接入时一并裁决。
      const failed = steps.find((step) => step.type === 'step_failed');
      if (failed?.type !== 'step_failed') throw new Error('缺少 step_failed 步骤');
      expect(failed.stage).toBe('execution');
      expect(failed.code).toBe('DQE_QUERY_REJECTED');
      expect(completedOf(resumed).document).toBeNull();
    }
  );
});

/* ---------- 面外与跨域:明确降级,四段分类,不伪造数据 ---------- */

describe('黄金问题集·降级路径:四段分类,不伪造数据', () => {
  it('失败分类是发现/生成/执行/呈现四段的封闭集合', () => {
    expect(FAILURE_STAGES).toEqual(['discovery', 'generation', 'execution', 'presentation']);
  });

  it.each(
    [...byCategory('no_metric'), ...byCategory('cross_domain')].map((sample) => ({
      id: sample.id,
      sample
    }))
  )('$id:面外问题按发现段降级,零执行,零文档,转缺口登记确认', async ({ sample }) => {
    const executor = simExecutor();
    const harness = buildAskPorts({
      script: {
        route: [
          {
            businessDomains:
              sample.category === 'cross_domain' ? ['运营分析', '客户经营'] : ['客户经营']
          }
        ],
        unit: [
          {
            outcome: 'out_of_scope',
            reason:
              sample.category === 'cross_domain'
                ? '「模型」维度与「新增客户数」指标分属两个业务域,同一取数单元不能跨域组合'
                : '语义面内没有价格或金额类指标'
          }
        ]
      },
      executor
    });
    const events = await runQuestion(harness, {
      runId: `golden-${sample.id}`,
      question: sample.question
    });

    const failed = stepEvents(events).find((step) => step.type === 'step_failed');
    if (failed?.type !== 'step_failed') throw new Error('缺少 step_failed 步骤');
    expect(failed.stage).toBe('discovery');
    expect(FAILURE_STAGES).toContain(failed.stage);
    expect(failed.code).toBe('OUT_OF_SEMANTIC_SURFACE');

    // 不伪造数据:未触发任何真实执行,也没有文档;降级转缺口登记确认。
    expect(executor.executions()).toBe(0);
    const { interaction } = interactionOf(events);
    expect(interaction.kind).toBe('confirm_gap_entry');
    const assistantText = events
      .flatMap((event) => (event.type === 'assistant_message' ? [event.message.content] : []))
      .join('\n');
    expect(assistantText).toContain('不编造数据');
  });

  it('硬闸兜底:模型误产出跨域单元时,真实执行拒绝且不返回任何数据行', async () => {
    const sample = byCategory('cross_domain')[0]!;
    const executor = simExecutor();
    const harness = buildAskPorts({
      script: {
        route: [{ businessDomains: ['运营分析', '客户经营'] }],
        // 错误的模型行为:把运营分析的「模型」维度混进客户经营的取数单元。
        unit: [
          {
            outcome: 'unit',
            unit: {
              businessDomain: '客户经营',
              metrics: [{ kind: 'metric', name: '新增客户数' }],
              groupBy: ['模型'],
              filters: [],
              time: { granularity: 'month', start: '2026-07', end: '2026-07', providedBy: 'user' },
              title: sample.question
            }
          }
        ]
      },
      executor
    });
    const events = await runQuestion(harness, {
      runId: 'golden-cross-hard-gate',
      question: sample.question
    });

    const failed = stepEvents(events).find((step) => step.type === 'step_failed');
    if (failed?.type !== 'step_failed') throw new Error('缺少 step_failed 步骤');
    // 仿真按语义面拒绝跨域组合;执行段失败自动重试一次后如实降级。
    expect(failed.stage).toBe('execution');
    expect(failed.code).toBe('DQE_QUERY_REJECTED');
    expect(executor.executions()).toBe(2);
    expect(completedOf(events).document).toBeNull();
    const assistantText = events
      .flatMap((event) => (event.type === 'assistant_message' ? [event.message.content] : []))
      .join('\n');
    expect(assistantText).toContain('不以任何方式编造数据');
  });
});
