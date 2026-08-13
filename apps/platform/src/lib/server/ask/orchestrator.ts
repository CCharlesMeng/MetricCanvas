import { componentCatalog } from '@metriccanvas/page';
import type {
  DomainSemanticSurface,
  ExecutedDataRequestUnit,
  AnalysisIntent as VisualizeIntent
} from '@metriccanvas/mcp';
import type { JSONValue } from '@metriccanvas/page-lifecycle';
import { anySignal, isAbortError } from '../agent/abort';
import { AgentRunnerError, type HaltCode } from '../agent/runner';
import type { AgentEvent, AgentInteraction, AgentMessage, AgentRunner } from '../agent/types';
import {
  ANALYSIS_INTENTS,
  type AnalysisIntent,
  type AnalysisStepEvent,
  type MetricCandidate
} from '../session/step-event';
import {
  withAskState,
  parseAskConversation,
  type AskConversationState,
  type AskPendingScopeCard,
  type ScopeBlockReason
} from '../../ask/conversation';
import { disambiguateCandidates } from './retrieval';
import { canonicalizeUnit, deriveExecutableUnit } from './unit-derivation';
import type {
  AskDataRequestUnitState,
  AskOrchestrationPorts,
  AskUnitFormingDecision,
  AskUnitPatch,
  RankedMetricCandidate
} from './ports';

/**
 * 问数编排(#66,ADR-0037):问题与会话上下文进,步骤事件的异步序列出,
 * 成功路径产出一份通过页面校验的临时页面文档。
 *
 * 阶段状态机(固定顺序,确定性代码驱动;标 ◆ 的阶段至多一次模型调用,可跳过):
 *
 *   域路由◆ → 指标与维度检索 → 候选消歧 → 口径成形◆ → 清单校验 → 真实执行
 *   → 意图判定◆与组件选择 → 呈现
 *
 * - 域路由:用户指定的域优先于模型判断(跳过调用);追问轮沿用既有域,
 *   仅当检索一无所获时重路由一次。
 * - 候选消歧:确定性检索排序 + 并列最高分即歧义;歧义阻塞转人工确认,
 *   系统与模型都不替用户选。
 * - 口径卡:歧义、临时口径(自由 formula)、时间口径由模型补全三类触发
 *   条件阻塞等待确认,其余直接执行(ADR-0037 的成本阈值触发条件待成本
 *   预估能力,当前不实现)。
 * - 预算与止损:每阶段模型调用失败重试一次;清单校验被拒给模型一次带
 *   违规反馈的修复机会;真实执行的运行内次数上限由验真端口承载(#64)。
 * - 降级:面外问题与执行失败按四段分类落 step_failed,绝不编造数据,
 *   运行以解释性回复正常收束(缺口条目的落库是 #67 的范围)。
 *
 * 实现为 AgentRunner:步骤事件经 {type:'step'} 进入 #32 推送通道,由通道
 * 统一编号、落库与下发;取消与超时信号贯穿模型调用、检索与真实执行。
 */

/** 口径卡确认(#65 接线点 1):interactionId 锚定待确认卡;歧义时必须携带选择。 */
export interface AskScopeConfirmation {
  interactionId: string;
  selectedMetric?: { businessDomain: string; metricName: string };
}

export interface AskRunnerOptions {
  runId: string;
  /** 用户改写的业务域(优先于模型判断,ADR-0037)。 */
  userDomains?: string[];
  scopeConfirmations?: AskScopeConfirmation[];
  /** 钉住的组件形态(#65 接线点 2):经 recommendComponents({ pinned }) 兑现。 */
  pinnedComponents?: Array<{ dataSourceId: string; componentType: string }>;
  timeoutMs?: number;
  /** 测试注入手动可控的超时信号。 */
  createTimeoutSignal?: (timeoutMs: number) => AbortSignal;
}

/** 问数的页面数据源名:一个问题对应一个取数单元与一个页面数据源(V0)。 */
export const ASK_DATA_SOURCE_ID = 'result';

/** 步骤事件里的意图词汇 → 组件推荐(auto-visualize)意图词汇的唯一映射。 */
const INTENT_TO_VISUALIZE: Record<AnalysisIntent, VisualizeIntent> = {
  comparison: 'comparison',
  trend: 'trend',
  composition: 'proportion',
  ranking: 'ranking',
  detail: 'detail',
  single_value: 'summary'
};

export function createAskOrchestrationRunner(
  ports: AskOrchestrationPorts,
  options: AskRunnerOptions
): AgentRunner {
  return {
    run: (input) => orchestrate(ports, options, input)
  };
}

/** 临时页面 id(ADR-0030):`ask-transient-` + runId 确定性派生的 8 位十六进制。 */
export function transientPageIdFor(runId: string): string {
  let hash = 0x811c9dc5;
  for (const char of runId) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `ask-transient-${hash.toString(16).padStart(8, '0')}`;
}

async function* orchestrate(
  ports: AskOrchestrationPorts,
  options: AskRunnerOptions,
  input: { messages: AgentMessage[]; signal?: AbortSignal }
): AsyncGenerator<AgentEvent> {
  const messages = structuredClone(input.messages);
  const cancelSignal = input.signal;
  const timeoutSignal =
    options.timeoutMs !== undefined
      ? (options.createTimeoutSignal ?? ((ms: number) => AbortSignal.timeout(ms)))(
          options.timeoutMs
        )
      : undefined;
  const signal = anySignal([cancelSignal, timeoutSignal]);

  const halt = (code: HaltCode, message: string, cause?: unknown): AgentRunnerError =>
    new AgentRunnerError(code, message, messages, cause === undefined ? undefined : { cause });
  const haltFromAbort = (cause?: unknown): AgentRunnerError =>
    timeoutSignal?.aborted
      ? halt('RUN_TIMEOUT', `问数编排超过 ${options.timeoutMs} 毫秒超时上限`, cause)
      : halt('CANCELLED', '问数编排已被取消', cause);
  const haltIfAborted = (): void => {
    if (signal?.aborted) throw haltFromAbort(signal.reason);
  };

  /** 每阶段的模型调用纪律:失败重试一次,中止原样上抛(决策 4)。 */
  const decide = async <T>(call: () => Promise<T>): Promise<T> => {
    haltIfAborted();
    try {
      return await call();
    } catch (cause) {
      if (isAbortError(cause)) throw haltFromAbort(cause);
      haltIfAborted();
      try {
        return await call();
      } catch (retryCause) {
        if (isAbortError(retryCause)) throw haltFromAbort(retryCause);
        throw halt('MODEL_FAILED', '模型结构化决策失败', retryCause);
      }
    }
  };

  const step = (event: AnalysisStepEvent): AgentEvent => ({ type: 'step', event });
  const assistant = (content: string): AgentEvent => ({
    type: 'assistant_message',
    message: { role: 'assistant', content, toolCalls: [] }
  });
  const completed = (
    state: AskConversationState,
    document: Record<string, unknown> | null
  ): AgentEvent => ({
    type: 'completed',
    messages: withAskState(messages, state),
    document
  });

  const conversation = parseAskConversation(messages);
  const state = structuredClone(conversation.state);
  const question = conversation.question;

  /* ---------- 续跑:口径卡确认(无新问题) ---------- */
  if (question === null) {
    const pending = state.pending;
    if (!pending) {
      yield assistant('当前没有待确认的口径卡,也没有新的问题;请输入业务问题。');
      yield completed({ ...state, pending: null }, null);
      return;
    }
    const confirmation = options.scopeConfirmations?.find(
      (entry) => entry.interactionId === pending.interactionId
    );
    let unit = pending.unit;
    if (pending.ambiguousTerms.length > 0) {
      const selection = confirmation?.selectedMetric;
      if (!selection) {
        // 消歧未决不接受空白确认:系统不替用户选(ADR-0037),原卡重新阻塞。
        yield step(scopeCardEvent(unit, true));
        yield interactionRequired(pending, messages, state);
        return;
      }
      const valid = pending.candidates.some(
        (candidate) =>
          candidate.businessDomain === selection.businessDomain &&
          candidate.metricName === selection.metricName
      );
      if (!valid) {
        yield step({
          type: 'step_failed',
          stage: 'discovery',
          code: 'SCOPE_SELECTION_INVALID',
          message: `确认的指标「${selection.businessDomain}·${selection.metricName}」不在候选卡内`
        });
        yield assistant('口径确认引用了候选之外的指标,已终止本次执行;请重新从候选中选择。');
        yield completed(state, null);
        return;
      }
      unit = {
        ...unit,
        businessDomain: selection.businessDomain,
        metrics: [...unit.metrics, { kind: 'metric', name: selection.metricName }]
      };
    }
    haltIfAborted();
    const surfaces = await ports.retrieval.domainSurfaces([unit.businessDomain]);
    unit = canonicalizeUnit(unit, surfaces);
    const resumedState: AskConversationState = {
      ...state,
      businessDomains: dedupe([unit.businessDomain, ...state.businessDomains]).slice(0, 2),
      pending: null
    };
    // 确认后的口径卡以非阻塞形态回显一次:本轮实际生效范围的锚点。
    yield step(scopeCardEvent(unit, false));
    yield* executeAndPresent({
      ports,
      options,
      unit,
      surfaces,
      state: resumedState,
      question: pending.question,
      isNewQuestion: false,
      decide,
      haltIfAborted,
      signal,
      step,
      assistant,
      completed
    });
    return;
  }

  /* ---------- 域路由(模型分类;用户指定优先;追问沿用既有域) ---------- */
  haltIfAborted();
  const inventory = await ports.retrieval.domainInventory();
  const inventoryNames = inventory.map((domain) => domain.name);
  let routedDomains: string[];
  let overriddenByUser = false;
  if (options.userDomains !== undefined && options.userDomains.length > 0) {
    routedDomains = options.userDomains.filter((name) => inventoryNames.includes(name)).slice(0, 2);
    overriddenByUser = true;
    if (routedDomains.length === 0) {
      yield step({
        type: 'step_failed',
        stage: 'discovery',
        code: 'DOMAIN_OVERRIDE_INVALID',
        message: `用户指定的业务域不在域清单内:${options.userDomains.join('、')}`
      });
      yield assistant('指定的业务域不存在;可选业务域:' + inventoryNames.join('、') + '。');
      yield completed(state, null);
      return;
    }
  } else if (state.businessDomains.length > 0 && state.unit !== null) {
    // 追问轮:未提及的显式设置保持不变,域沿用上一轮(检索落空时再重路由)。
    routedDomains = state.businessDomains;
    overriddenByUser = state.domainsOverriddenByUser;
  } else {
    const decision = await decide(() =>
      ports.model.routeDomains({ question, domains: inventory, ...(signal ? { signal } : {}) })
    );
    routedDomains = dedupe(
      decision.businessDomains.filter((name) => inventoryNames.includes(name))
    ).slice(0, 2);
    if (routedDomains.length === 0) {
      yield step({
        type: 'step_failed',
        stage: 'discovery',
        code: 'DOMAIN_ROUTING_EMPTY',
        message: '模型未能把问题归入任何业务域'
      });
      yield assistant(
        '无法判断问题属于哪个业务域,已按发现阶段降级。可选业务域:' +
          inventoryNames.join('、') +
          '。'
      );
      yield completed(state, null);
      return;
    }
  }

  /* ---------- 指标与维度检索(确定性) ---------- */
  haltIfAborted();
  let candidates = await ports.retrieval.searchMetricCandidates({
    question,
    businessDomains: routedDomains
  });
  if (
    candidates.length === 0 &&
    state.unit !== null &&
    (options.userDomains === undefined || options.userDomains.length === 0)
  ) {
    // 追问在既有域内检索落空时,确定性地在全部域清单内再检索一次:
    // 命中其他域即为跨域追问,按命中域改路由(不需要模型参与);
    // 全域都落空则是不含指标线索的定向修改(如只改筛选),沿用既有域。
    const crossDomainCandidates = await ports.retrieval.searchMetricCandidates({
      question,
      businessDomains: inventoryNames
    });
    if (crossDomainCandidates.length > 0) {
      routedDomains = dedupe(
        crossDomainCandidates.map((candidate) => candidate.businessDomain)
      ).slice(0, 2);
      overriddenByUser = false;
      candidates = crossDomainCandidates.filter((candidate) =>
        routedDomains.includes(candidate.businessDomain)
      );
    }
  }
  yield step({ type: 'domain_routed', question, routedDomains, overriddenByUser });

  /* ---------- 候选消歧(确定性排序;并列最高分即歧义) ---------- */
  const { selected, ambiguousTerms } = disambiguateCandidates(candidates);

  /* ---------- 口径成形(模型只产出结构化决策;增量修改按定向 patch) ---------- */
  const surfaces = await ports.retrieval.domainSurfaces(routedDomains);
  const formUnitOnce = (violationFeedback?: string[]) =>
    decide(() =>
      ports.model.formUnit({
        question,
        surfaces,
        candidates,
        selectedMetrics: selected.map((candidate) => ({
          businessDomain: candidate.businessDomain,
          metricName: candidate.metricName
        })),
        previousUnit: state.unit,
        ...(violationFeedback === undefined ? {} : { violationFeedback }),
        ...(signal ? { signal } : {})
      })
    );
  const decision = await formUnitOnce();
  if (decision.outcome === 'out_of_scope') {
    yield step(candidatesEvent(candidates, null, null));
    yield step({
      type: 'step_failed',
      stage: 'discovery',
      code: 'OUT_OF_SEMANTIC_SURFACE',
      message: decision.reason
    });
    yield assistant(
      `语义面内没有能回答该问题的数据能力:${decision.reason}。已按发现阶段降级,不编造数据。`
    );
    yield completed(state, null);
    return;
  }
  let unit = resolveUnit(state.unit, decision);
  if (unit === null) {
    throw halt('MODEL_FAILED', '首轮口径成形必须产出完整取数单元,模型只回传了增量 patch');
  }
  if (!routedDomains.includes(unit.businessDomain)) {
    unit = {
      ...unit,
      businessDomain: selected[0]?.businessDomain ?? routedDomains[0]!
    };
  }
  // 歧义命中词对应的指标从单元中剔除:消歧只能由用户完成。
  const ambiguousNames = new Set(
    candidates
      .filter((candidate) => ambiguousTerms.includes(candidate.matchedTerm))
      .map((candidate) => candidate.metricName)
  );
  if (ambiguousNames.size > 0) {
    unit = {
      ...unit,
      metrics: unit.metrics.filter(
        (metric) => metric.kind !== 'metric' || !ambiguousNames.has(metric.name)
      )
    };
  }
  unit = canonicalizeUnit(unit, surfaces);

  const adHoc = adHocDefinitionOf(unit);
  yield step(
    candidatesEvent(
      candidates,
      ambiguousTerms.length > 0 ? null : firstMetricName(unit),
      adHoc
    )
  );

  /* ---------- 口径卡:触发条件阻塞,其余直接执行(ADR-0037) ---------- */
  const reasons: ScopeBlockReason[] = [];
  if (ambiguousTerms.length > 0) reasons.push('ambiguous_metric');
  if (adHoc !== null) reasons.push('ad_hoc_definition');
  if (unit.time?.providedBy === 'model') reasons.push('model_completed_time');

  const nextState: AskConversationState = {
    ...state,
    businessDomains: routedDomains,
    domainsOverriddenByUser: overriddenByUser,
    pending: null
  };

  if (reasons.length > 0) {
    const pending: AskPendingScopeCard = {
      interactionId: `confirm-scope:${options.runId}`,
      reasons,
      unit,
      ambiguousTerms,
      candidates,
      question
    };
    yield step(scopeCardEvent(unit, true));
    yield interactionRequired(pending, messages, { ...nextState, pending });
    return;
  }

  yield step(scopeCardEvent(unit, false));
  yield* executeAndPresent({
    ports,
    options,
    unit,
    surfaces,
    state: nextState,
    question,
    isNewQuestion: true,
    formUnitOnce,
    decide,
    haltIfAborted,
    signal,
    step,
    assistant,
    completed
  });
}

/* ---------- 清单校验 → 真实执行 → 意图判定与组件选择 → 呈现 ---------- */

interface ExecutionContext {
  ports: AskOrchestrationPorts;
  options: AskRunnerOptions;
  unit: AskDataRequestUnitState;
  surfaces: DomainSemanticSurface[];
  state: AskConversationState;
  question: string;
  isNewQuestion: boolean;
  /** 清单校验被拒后的修复重试入口;续跑轮没有(单元已经用户确认)。 */
  formUnitOnce?: (violationFeedback?: string[]) => Promise<AskUnitFormingDecision>;
  decide: <T>(call: () => Promise<T>) => Promise<T>;
  haltIfAborted: () => void;
  signal: AbortSignal | undefined;
  step: (event: AnalysisStepEvent) => AgentEvent;
  assistant: (content: string) => AgentEvent;
  completed: (
    state: AskConversationState,
    document: Record<string, unknown> | null
  ) => AgentEvent;
}

async function* executeAndPresent(context: ExecutionContext): AsyncGenerator<AgentEvent> {
  const { ports, options, surfaces, state, question, step, assistant, completed } = context;
  let unit = context.unit;
  let derived = deriveExecutableUnit(unit, surfaces);

  // 事件语义:真实执行阶段开始(清单校验被拒时该阶段不产生真实查询)。
  context.haltIfAborted();
  yield step({
    type: 'execution_started',
    effectiveQuery: {
      language: 'dqe',
      body: derived.body,
      fieldMappings: derived.fields
    } as unknown as JSONValue
  });

  // 运行取消会经注入的执行端口中止进行中的真实查询(#32/#64 设施);
  // 验真把中止归一为执行失败返回,这里在解读失败前先裁决取消/超时。
  const verify = async () => {
    const result = await ports.verifyUnit({
      dataSourceId: ASK_DATA_SOURCE_ID,
      fields: derived.fields,
      query: { language: 'dqe', body: derived.body },
      question
    });
    context.haltIfAborted();
    return result;
  };
  let verification = await verify();

  // 清单校验被拒:给模型一次携带违规反馈的定向修复机会(名称与取值都有候选)。
  if (
    !verification.ok &&
    verification.failure.code === 'UNIT_MANIFEST_REJECTED' &&
    context.formUnitOnce !== undefined
  ) {
    const feedback = (verification.failure.violations ?? []).map(
      (violation) =>
        `${violation.message}${violation.candidates.length > 0 ? `;候选:${violation.candidates.join('、')}` : ''}`
    );
    const repaired = await context.formUnitOnce(feedback);
    if (repaired.outcome !== 'out_of_scope') {
      const resolved = resolveUnit(unit, repaired);
      if (resolved !== null) {
        unit = canonicalizeUnit({ ...resolved, businessDomain: unit.businessDomain }, surfaces);
        derived = deriveExecutableUnit(unit, surfaces);
        verification = await verify();
      }
    }
  }
  // 执行段失败(传输、执行环境)重试一次;生成/呈现段失败重试没有意义。
  if (!verification.ok && verification.failure.stage === 'execution') {
    context.haltIfAborted();
    verification = await verify();
  }
  if (!verification.ok) {
    yield step({
      type: 'step_failed',
      stage: verification.failure.stage,
      code: verification.failure.code,
      message: verification.failure.message
    });
    yield assistant(
      `本次取数未能完成(${verification.failure.code}:${verification.failure.message})。` +
        '不以任何方式编造数据;可修改口径后重试。'
    );
    yield completed(state, null);
    return;
  }

  yield step({
    type: 'rows_ready',
    summary: {
      rowCount: verification.returnedRowCount,
      totalCount: verification.totalCount ?? null,
      outputFields: verification.outputFields.map((field) => field.queryField)
    }
  });

  /* ---------- 意图判定(可跳过)与组件选择(确定性硬闸) ---------- */
  let intent: AnalysisIntent;
  if (!context.isNewQuestion && state.intent !== null) {
    intent = state.intent;
  } else {
    intent = await decideIntentWithFallback(context, unit);
  }

  const pinnedType = pinnedComponentFor(options.pinnedComponents, ASK_DATA_SOURCE_ID);
  const executedUnit: ExecutedDataRequestUnit = {
    dataSourceId: ASK_DATA_SOURCE_ID,
    title: unit.title ?? question,
    fields: derived.fields,
    query: { language: 'dqe', body: derived.body },
    initial: {
      capturedAt: (ports.clock ?? (() => new Date()))().toISOString(),
      rows: verification.sampleRows,
      totalCount: verification.totalCount ?? verification.returnedRowCount
    },
    intent: INTENT_TO_VISUALIZE[intent],
    ...(pinnedType === undefined ? {} : { pinnedComponent: pinnedType })
  };

  const transientPageId = transientPageIdFor(options.runId);
  const assembly = ports.assemblePage({
    pageId: transientPageId,
    description: question,
    units: [executedUnit],
    sectionTitle: '问数结果',
    container: 'panel'
  });
  if (!assembly.ok) {
    const pinnedIssue = assembly.issues.find((issue) => issue.code === 'PINNED_COMPONENT_REJECTED');
    const firstIssue = assembly.issues[0]!;
    yield step({
      type: 'step_failed',
      stage: 'presentation',
      code: firstIssue.code,
      message: assembly.issues
        .map((issue) =>
          issue.errors !== undefined && issue.errors.length > 0
            ? `${issue.message}:${issue.errors.map((error) => error.message).join('、')}`
            : issue.message
        )
        .join(';')
    });
    yield assistant(
      pinnedIssue !== undefined
        ? `钉住的组件未通过组件能力硬闸,系统不会自动改写钉住选择:${pinnedIssue.message}。可取消钉住或改问。`
        : `结果无法装配为页面文档:${firstIssue.message}`
    );
    yield completed({ ...state, unit, formulaTraces: verification.formulaTraces }, null);
    return;
  }

  const components = assembly.document.sections.flatMap((section) =>
    section.components.map((component) => ({
      componentType: component.type,
      pinnedByUser: pinnedType !== undefined && component.type === pinnedType
    }))
  );
  yield step({ type: 'document_ready', intent, components, transientPageId });

  const finalState: AskConversationState = {
    ...state,
    unit,
    intent,
    transientPageId,
    formulaTraces: verification.formulaTraces,
    pending: null
  };
  yield assistant(summaryText(unit, verification.returnedRowCount, components.map((c) => c.componentType)));
  yield completed(finalState, assembly.document as unknown as Record<string, unknown>);
}

async function decideIntentWithFallback(
  context: ExecutionContext,
  unit: AskDataRequestUnitState
): Promise<AnalysisIntent> {
  try {
    const decision = await context.decide(() =>
      context.ports.model.decideIntent({
        question: context.question,
        unit,
        previousIntent: context.state.intent,
        ...(context.signal ? { signal: context.signal } : {})
      })
    );
    if ((ANALYSIS_INTENTS as readonly string[]).includes(decision.intent)) {
      return decision.intent;
    }
  } catch (cause) {
    if (cause instanceof AgentRunnerError && cause.code !== 'MODEL_FAILED') throw cause;
    // 意图只影响硬闸放行范围内的排序,不决定正确性:判定失败按结果形状
    // 取确定性缺省,不让呈现偏好中断已取到数的回答。
  }
  return defaultIntent(unit);
}

function defaultIntent(unit: AskDataRequestUnitState): AnalysisIntent {
  if (unit.groupBy.length === 0) return 'single_value';
  const hasTimeGroup = unit.time !== null && unit.groupBy.length > 0;
  return hasTimeGroup && unit.groupBy.length === 1 ? 'trend' : 'comparison';
}

/* ---------- 事件与决策的纯函数辅助 ---------- */

function resolveUnit(
  previous: AskDataRequestUnitState | null,
  decision:
    | { outcome: 'unit'; unit: AskDataRequestUnitState }
    | { outcome: 'patch'; patch: AskUnitPatch }
): AskDataRequestUnitState | null {
  if (decision.outcome === 'unit') return decision.unit;
  if (previous === null) return null;
  // 定向增量 patch:只覆盖出现的层;未提及的显式设置结构上原样保留。
  return { ...previous, ...decision.patch };
}

function candidatesEvent(
  candidates: readonly RankedMetricCandidate[],
  selectedMetric: string | null,
  adHocDefinition: { formula: string; description: string | null } | null
): AnalysisStepEvent {
  return {
    type: 'candidates_retrieved',
    candidates: candidates.map(toMetricCandidate),
    selectedMetric,
    adHocDefinition
  };
}

function toMetricCandidate(candidate: RankedMetricCandidate): MetricCandidate {
  return {
    metricName: candidate.metricName,
    businessDomain: candidate.businessDomain,
    definitionDifference: candidate.definition
  };
}

function scopeCardEvent(
  unit: AskDataRequestUnitState,
  blockedOnConfirmation: boolean
): AnalysisStepEvent {
  const derivedScope = deriveExecutableUnit(unit, []).scope;
  return {
    type: 'scope_card_presented',
    businessDomain: unit.businessDomain,
    metricName: firstMetricName(unit),
    adHocDefinition: adHocDefinitionOf(unit),
    timeRange: derivedScope.timeRange,
    granularity: derivedScope.granularity,
    filters: derivedScope.filters,
    blockedOnConfirmation
  };
}

function interactionRequired(
  pending: AskPendingScopeCard,
  messages: AgentMessage[],
  state: AskConversationState
): AgentEvent {
  const interaction: AgentInteraction = {
    id: pending.interactionId,
    kind: 'confirm_scope_card',
    payload: {
      businessDomain: pending.unit.businessDomain,
      metricName: firstMetricName(pending.unit),
      adHocDefinition: adHocDefinitionOf(pending.unit),
      reasons: pending.reasons,
      ambiguousTerms: pending.ambiguousTerms,
      candidates: pending.candidates.map(toMetricCandidate),
      timeRange:
        pending.unit.time === null
          ? '不限定时间范围'
          : `${pending.unit.time.start} ~ ${pending.unit.time.end}`,
      granularity: pending.unit.time?.granularity ?? '未指定',
      filters: pending.unit.filters
    }
  };
  return {
    type: 'interaction_required',
    interaction,
    messages: withAskState(messages, state)
  };
}

function adHocDefinitionOf(
  unit: AskDataRequestUnitState
): { formula: string; description: string | null } | null {
  const formula = unit.metrics.find(
    (metric): metric is Extract<typeof metric, { kind: 'formula' }> => metric.kind === 'formula'
  );
  if (formula === undefined) return null;
  return { formula: formula.expression, description: formula.description ?? formula.label };
}

function firstMetricName(unit: AskDataRequestUnitState): string | null {
  const metric = unit.metrics.find(
    (entry): entry is Extract<typeof entry, { kind: 'metric' }> => entry.kind === 'metric'
  );
  return metric?.name ?? null;
}

function pinnedComponentFor(
  pins: AskRunnerOptions['pinnedComponents'],
  dataSourceId: string
): ExecutedDataRequestUnit['pinnedComponent'] {
  const pinned = pins?.find((pin) => pin.dataSourceId === dataSourceId)?.componentType;
  if (pinned === undefined) return undefined;
  // 目录外类型不进入推荐口(componentCatalogEntry 对未知类型抛错);
  // 钉住无效时按未钉住处理,由推荐口正常选型。
  return componentCatalog.some((entry) => entry.type === pinned)
    ? (pinned as ExecutedDataRequestUnit['pinnedComponent'])
    : undefined;
}

function summaryText(
  unit: AskDataRequestUnitState,
  rowCount: number,
  componentTypes: readonly string[]
): string {
  const metricText = unit.metrics
    .map((metric) => (metric.kind === 'metric' ? metric.name : `${metric.label}(临时口径)`))
    .join('、');
  const timeText =
    unit.time === null
      ? '不限定时间范围'
      : `${unit.time.start} ~ ${unit.time.end}(${unit.time.granularity})`;
  return (
    `已完成:业务域「${unit.businessDomain}」,指标 ${metricText || '(待定)'},` +
    `${timeText},返回 ${rowCount} 行,呈现为 ${componentTypes.join(' + ')}。`
  );
}

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values)];
}
