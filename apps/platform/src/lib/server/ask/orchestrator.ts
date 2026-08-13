import { componentCatalog } from '@metriccanvas/page';
import type {
  DomainSemanticSurface,
  ExecutedDataRequestUnit,
  FormulaTrace,
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
  type MetricCandidate,
  type MetricGapOccurrence
} from '../session/step-event';
import { adHocGapKey, scopeGapKey } from '../session/metric-gap';
import {
  withAskState,
  parseAskConversation,
  askUnitDataSourceId,
  ASK_DATA_SOURCE_ID,
  type AskConversationState,
  type AskPendingGapEntry,
  type AskPendingScopeCard,
  type AskUnitEntryState,
  type ScopeBlockReason
} from '../../ask/conversation';
import { disambiguateCandidates } from './retrieval';
import { canonicalizeUnit, deriveExecutableUnit } from './unit-derivation';
import type {
  AskDataRequestUnitState,
  AskOrchestrationPorts,
  AskUnitFormingDecision,
  AskUnitGapAspect,
  AskUnitOperation,
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
 *   运行以解释性回复正常收束。
 * - 缺口条目(#67,ADR-0036):检索不到合适指标不阻塞回答——临时口径
 *   尽力作答,面外与部分缺失单独列出。缺口出现在用户确认后才登记:
 *   临时口径以口径卡确认为确认时点,面外与部分缺失以 confirm_gap_entry
 *   交互为确认时点;登记即产出 metric_gap_recorded 步骤事件,随会话
 *   事件流落库,幂等键与计数聚合见 ../session/metric-gap.ts。
 *
 * 多取数单元模型:会话状态承载单元集合(每单元稳定 dataSourceId),口径
 * 成形的决策是定向单元操作集(新增/整单元重写/定向 patch/删除),一轮可含
 * 多个操作;未被操作触及的单元结构性不变(ADR-0037),不重新执行——其
 * 初始行从随请求传回的 draft 文档(上一轮临时页面)里按数据源名取回,
 * draft 缺失时按原口径重新取数兜底,绝不编造。请求 target(画布选中组件)
 * 映射为组件所绑数据源对应的单元,作为本轮定向修改的默认对象。
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
  /**
   * 上一轮临时页面文档(工作台随请求传回的工作副本):未触及单元的
   * 查询定义与初始行的合法载体——会话状态不内嵌业务数据行(ADR-0030)。
   */
  draft?: Record<string, unknown>;
  /** 画布选中组件的定位:映射为该组件所绑数据源对应的单元,作本轮默认修改目标。 */
  target?: { sectionId: string; componentId: string };
  timeoutMs?: number;
  /** 测试注入手动可控的超时信号。 */
  createTimeoutSignal?: (timeoutMs: number) => AbortSignal;
}

/**
 * 问数首个页面数据源名(声明真源在会话契约 ../../ask/conversation):
 * 多单元模型下每个单元的数据源名由 askUnitDataSourceId 按序号派生。
 */
export { ASK_DATA_SOURCE_ID } from '../../ask/conversation';

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

  /** 缺口出现登记(#67):仅在用户确认后调用;事件流是唯一落库通道。 */
  const recordGap = async function* (
    occurrence: MetricGapOccurrence
  ): AsyncGenerator<AgentEvent> {
    try {
      await ports.gapSink?.(occurrence);
    } catch {
      // 观察口失败不得中断已确认的登记;metric_gap_recorded 事件仍照常落库。
    }
    yield step({ type: 'metric_gap_recorded', gap: occurrence });
  };

  /* ---------- 续跑:缺口登记确认(无新问题) ---------- */
  if (question === null && (state.pendingGapEntry ?? null) !== null) {
    const pendingGap = state.pendingGapEntry!;
    for (const occurrence of pendingGap.occurrences) {
      yield* recordGap(occurrence);
    }
    yield assistant(
      `已登记 ${pendingGap.occurrences.length} 条指标需求条目;` +
        '同一缺口重复出现会累加出现次数,供数据侧评估是否建设指标。'
    );
    yield completed({ ...state, pendingGapEntry: null }, null);
    return;
  }

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
    // 历史单 unit 口径卡兼容:单元集合与触及清单缺省时,以阻塞单元为
    // 唯一被触及单元,替换(或补入)进当前单元集合。
    const blockingId = pending.dataSourceId ?? ASK_DATA_SOURCE_ID;
    let blockingUnit = pending.unit;
    let entries: AskUnitEntryState[] =
      pending.units ??
      upsertUnitEntry(state.units, {
        dataSourceId: blockingId,
        unit: blockingUnit,
        intent: null,
        requestedComponent: null
      });
    const touched = pending.touchedDataSourceIds ?? [blockingId];
    if (pending.ambiguousTerms.length > 0) {
      const selection = confirmation?.selectedMetric;
      if (!selection) {
        // 消歧未决不接受空白确认:系统不替用户选(ADR-0037),原卡重新阻塞。
        yield step(scopeCardEvent(blockingUnit, true, blockingId));
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
      blockingUnit = {
        ...blockingUnit,
        businessDomain: selection.businessDomain,
        metrics: [...blockingUnit.metrics, { kind: 'metric', name: selection.metricName }]
      };
    }
    haltIfAborted();
    const surfaces = await ports.retrieval.domainSurfaces(
      dedupe([blockingUnit.businessDomain, ...entries.map((entry) => entry.unit.businessDomain)])
    );
    blockingUnit = canonicalizeUnit(blockingUnit, surfaces);
    entries = entries.map((entry) =>
      entry.dataSourceId === blockingId ? { ...entry, unit: blockingUnit } : entry
    );
    const resumedState: AskConversationState = {
      ...state,
      businessDomains: dedupe([blockingUnit.businessDomain, ...state.businessDomains]).slice(0, 2),
      pending: null
    };
    // 确认后的口径卡以非阻塞形态回显一次:本轮实际生效范围的锚点。
    for (const id of touched) {
      const entry = entries.find((candidate) => candidate.dataSourceId === id);
      if (entry) yield step(scopeCardEvent(entry.unit, false, entry.dataSourceId));
    }
    // 临时口径缺口(#67):口径卡确认即用户确认,此刻登记一次出现。
    // 幂等键取表达式形状,与高频 formula 形状排行天然合并(ADR-0036)。
    const confirmedAdHoc = adHocDefinitionOf(blockingUnit);
    if (confirmedAdHoc !== null) {
      yield* recordGap({
        idempotencyKey: adHocGapKey(blockingUnit.businessDomain, confirmedAdHoc.formula),
        question: pending.question,
        searchTerms: dedupe(pending.candidates.map((candidate) => candidate.matchedTerm)),
        closestCandidates: pending.candidates.map(toMetricCandidate),
        adHocDefinition: confirmedAdHoc,
        expectedDimensions: blockingUnit.groupBy,
        expectedGranularity: blockingUnit.time?.granularity ?? null,
        businessDomain: blockingUnit.businessDomain
      });
    }
    yield* executeAndPresent({
      ports,
      options,
      units: entries,
      touched,
      added: entries
        .map((entry) => entry.dataSourceId)
        .filter((id) => !state.units.some((entry) => entry.dataSourceId === id)),
      targetDataSourceId: blockingId,
      surfaces,
      state: resumedState,
      question: pending.question,
      isNewQuestion: false,
      candidates: pending.candidates,
      gapAspects: pending.gapAspects ?? [],
      messages,
      decide,
      haltIfAborted,
      signal,
      step,
      assistant,
      completed
    });
    return;
  }

  // 新问题到来即放弃上一轮未确认的缺口登记(不登记,不重复提示)。
  state.pendingGapEntry = null;

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
  } else if (state.businessDomains.length > 0 && state.units.length > 0) {
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
    state.units.length > 0 &&
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

  /* ---------- 口径成形(模型只产出结构化决策;定向单元操作集) ---------- */
  const surfaces = await ports.retrieval.domainSurfaces(routedDomains);
  // target 消费:请求 target(画布选中组件)→ draft 文档里该组件的
  // data.main → 对应单元,作为本轮定向修改的默认对象。
  const targetDataSourceId = targetUnitIdOf(options, state.units);
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
        previousUnits: state.units.map((entry) => ({
          dataSourceId: entry.dataSourceId,
          unit: entry.unit
        })),
        targetDataSourceId,
        ...(violationFeedback === undefined ? {} : { violationFeedback }),
        ...(signal ? { signal } : {})
      })
    );
  let decision = await formUnitOnce();
  if (
    decision.outcome === 'out_of_scope' &&
    state.units.length > 0 &&
    (explicitComponentRequest(question) !== null || genericVisualizationRequest(question))
  ) {
    // 纯展示追问的确定性保护:话语点名了组件形态(或泛指换图表)且存在
    // 增量修改基线时,模型的「面外」判定不成立——本轮的实质诉求就是换
    // 展示。按空操作集继续(取数单元不变),组件选择由呈现阶段的确定性
    // 通道兑现。
    decision = { outcome: 'operations', operations: [] };
  }

  // 结构操作一致性闸门:问题命中结构操作动词(有限闭集,映射仅有的四种
  // 单元操作,不是场景枚举)而模型回传空操作/面外时,不静默放行——带
  // 反馈重试一次(复用违规反馈机制);重试仍空则诚实失败,绝不以「无变化」
  // 假装完成。受控实验:同一输入下模型约 1/4 概率输出空结果,静默放行
  // 会让用户感知指令被无视。
  const structuralIntent = structuralOperationIntent(question, state.units.length);
  if (
    structuralIntent !== null &&
    state.units.length > 0 &&
    isEmptyStructuralResponse(decision)
  ) {
    haltIfAborted();
    decision = await formUnitOnce([
      `用户的这条追问要求对单元集合做结构调整(${structuralIntent}),但你回传了空结果。` +
        '请输出定向单元操作(operations):合并 = remove 被并入的单元 + modify 保留单元把指标并齐;' +
        '拆分 = modify 原单元只保留部分指标 + add 新单元承载其余;增加 = add;删除 = remove。'
    ]);
    if (isEmptyStructuralResponse(decision)) {
      yield step(candidatesEvent(candidates, null, null));
      yield step({
        type: 'step_failed',
        stage: 'generation',
        code: 'STRUCTURAL_INTENT_NOT_APPLIED',
        message: `模型两次未能把「${structuralIntent}」诉求翻译为单元操作,不以「无变化」假装完成`
      });
      yield assistant(
        `这条结构调整(${structuralIntent})没有被成功理解,页面保持原样。` +
          '可以换一种说法再试,例如「把两个组件合并成一个」「删除第二个组件」「拆成两个图,分别展示 A 和 B」。'
      );
      yield completed(state, null);
      return;
    }
  }
  if (decision.outcome === 'out_of_scope') {
    yield step(candidatesEvent(candidates, null, null));
    yield step({
      type: 'step_failed',
      stage: 'discovery',
      code: 'OUT_OF_SEMANTIC_SURFACE',
      message: decision.reason
    });
    // 面外缺口(#67):运行以解释性回复正常收束,不阻塞后续提问;
    // 是否登记为指标需求条目由用户确认(确认后才登记,#36 内核)。
    const gapDomain = routedDomains[0]!;
    const pendingGap: AskPendingGapEntry = {
      interactionId: `confirm-gap:${options.runId}`,
      occurrences: [
        {
          idempotencyKey: scopeGapKey(gapDomain, question),
          question,
          searchTerms: dedupe(candidates.map((candidate) => candidate.matchedTerm)),
          closestCandidates: candidates.map(toMetricCandidate),
          adHocDefinition: null,
          expectedDimensions: [],
          expectedGranularity: null,
          businessDomain: gapDomain
        }
      ]
    };
    yield assistant(
      `语义面内没有能回答该问题的数据能力:${decision.reason}。已按发现阶段降级,不编造数据。` +
        '可确认把该需求登记为指标需求条目,供数据侧评估建设;也可直接换个问题。'
    );
    yield gapInteractionRequired(pendingGap, question, messages, {
      ...state,
      pendingGapEntry: pendingGap
    });
    return;
  }
  const gapAspects = decision.gaps ?? [];

  /* ---------- 操作集应用(确定性;未触及单元结构性不变,ADR-0037) ---------- */
  const operations = operationsOf(decision, state.units, targetDataSourceId);
  if (state.units.length === 0 && !operations.some((operation) => operation.op === 'add')) {
    throw halt('MODEL_FAILED', '首轮口径成形必须产出完整取数单元,模型只回传了增量 patch');
  }
  const applied = applyUnitOperations({
    entries: state.units,
    operations,
    nextOrdinal: state.nextUnitOrdinal,
    routedDomains,
    fallbackDomain: selected[0]?.businessDomain ?? routedDomains[0]!,
    question,
    onUnknownUnit: (dataSourceId) => {
      throw halt('MODEL_FAILED', `单元操作引用了不存在的取数单元:${dataSourceId}`);
    }
  });
  let entries = applied.entries;
  let touched = applied.touched;

  // 歧义命中词对应的指标从被触及单元中剔除:消歧只能由用户完成。
  const ambiguousNames = new Set(
    candidates
      .filter((candidate) => ambiguousTerms.includes(candidate.matchedTerm))
      .map((candidate) => candidate.metricName)
  );
  entries = entries.map((entry) => {
    if (!touched.includes(entry.dataSourceId)) return entry;
    let unit = entry.unit;
    if (ambiguousNames.size > 0) {
      unit = {
        ...unit,
        metrics: unit.metrics.filter(
          (metric) => metric.kind !== 'metric' || !ambiguousNames.has(metric.name)
        )
      };
    }
    return { ...entry, unit: canonicalizeUnit(unit, surfaces) };
  });

  const nextState: AskConversationState = {
    ...state,
    businessDomains: routedDomains,
    domainsOverriddenByUser: overriddenByUser,
    nextUnitOrdinal: applied.nextOrdinal,
    pending: null
  };

  if (entries.length === 0) {
    // 操作集删光了全部单元:如实收束,没有可呈现的内容。
    yield step(candidatesEvent(candidates, null, null));
    yield assistant('已按要求删除全部取数单元;当前没有可呈现的内容,请提出新的问题。');
    yield completed({ ...nextState, units: [], transientPageId: null }, null);
    return;
  }

  // 消歧未决且本轮没有结构性操作时,用户的选择仍需落到某个单元:
  // 以默认目标单元(target 或首单元)为承接单元。
  if (ambiguousTerms.length > 0 && touched.length === 0) {
    touched = [targetDataSourceId ?? entries[0]!.dataSourceId];
  }

  const primaryEntry =
    entries.find((entry) => entry.dataSourceId === touched[0]) ?? entries[0]!;
  const adHocOfPrimary = adHocDefinitionOf(primaryEntry.unit);
  yield step(
    candidatesEvent(
      candidates,
      ambiguousTerms.length > 0 ? null : firstMetricName(primaryEntry.unit),
      adHocOfPrimary
    )
  );

  /* ---------- 口径卡:触发条件阻塞,其余直接执行(ADR-0037) ---------- */
  const touchedEntries = entries.filter((entry) => touched.includes(entry.dataSourceId));
  const reasons: ScopeBlockReason[] = [];
  if (ambiguousTerms.length > 0) reasons.push('ambiguous_metric');
  if (touchedEntries.some((entry) => adHocDefinitionOf(entry.unit) !== null)) {
    reasons.push('ad_hoc_definition');
  }
  if (touchedEntries.some((entry) => entry.unit.time?.providedBy === 'model')) {
    reasons.push('model_completed_time');
  }

  if (reasons.length > 0) {
    const blockingEntry =
      touchedEntries.find(
        (entry) =>
          adHocDefinitionOf(entry.unit) !== null || entry.unit.time?.providedBy === 'model'
      ) ?? touchedEntries[0]!;
    const pending: AskPendingScopeCard = {
      interactionId: `confirm-scope:${options.runId}`,
      reasons,
      unit: blockingEntry.unit,
      dataSourceId: blockingEntry.dataSourceId,
      units: entries,
      touchedDataSourceIds: touched,
      ambiguousTerms,
      candidates,
      question,
      gapAspects
    };
    yield step(scopeCardEvent(blockingEntry.unit, true, blockingEntry.dataSourceId));
    yield interactionRequired(pending, messages, { ...nextState, pending });
    return;
  }

  for (const entry of touchedEntries) {
    yield step(scopeCardEvent(entry.unit, false, entry.dataSourceId));
  }
  yield* executeAndPresent({
    ports,
    options,
    units: entries,
    touched,
    added: applied.added,
    targetDataSourceId,
    surfaces,
    state: nextState,
    question,
    isNewQuestion: true,
    candidates,
    gapAspects,
    messages,
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
  /** 本轮全部单元的下一状态(含未触及单元),按呈现顺序。 */
  units: AskUnitEntryState[];
  /** 本轮被新增或修改、需要重新走清单校验→真实执行的单元。 */
  touched: string[];
  /** 本轮新增的单元(显式组件点名的新增语义作用对象)。 */
  added: string[];
  /** 本轮定向修改的默认目标单元(target 映射结果);无 target 时为 null。 */
  targetDataSourceId: string | null;
  surfaces: DomainSemanticSurface[];
  state: AskConversationState;
  question: string;
  isNewQuestion: boolean;
  /** 本轮检索候选:部分缺口条目「最接近候选与口径差异」的素材来源。 */
  candidates: RankedMetricCandidate[];
  /** 问题里语义面无法回答的部分(#67):单独列出,确认后登记。 */
  gapAspects: AskUnitGapAspect[];
  messages: AgentMessage[];
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

/** 单元的呈现来源:本轮真实执行的结果,或上一轮 draft 文档里的既有面。 */
type UnitPresentation =
  | {
      kind: 'executed';
      fields: ExecutedDataRequestUnit['fields'];
      query: ExecutedDataRequestUnit['query'];
      initial: NonNullable<ExecutedDataRequestUnit['initial']>;
      rowCount: number;
      formulaTraces: FormulaTrace[];
    }
  | {
      kind: 'draft';
      fields: ExecutedDataRequestUnit['fields'];
      query: ExecutedDataRequestUnit['query'];
      initial: NonNullable<ExecutedDataRequestUnit['initial']>;
    };

async function* executeAndPresent(context: ExecutionContext): AsyncGenerator<AgentEvent> {
  const { ports, options, surfaces, state, question, step, assistant, completed } = context;
  const entries = context.units.map((entry) => ({ ...entry }));
  const presentations = new Map<string, UnitPresentation>();

  /* ---------- 清单校验 → 真实执行(仅被触及单元;未触及复用既有面) ---------- */
  for (const entry of entries) {
    const isTouched = context.touched.includes(entry.dataSourceId);
    if (!isTouched) {
      const fromDraft = draftPresentationOf(options.draft, entry.dataSourceId);
      if (fromDraft !== null) {
        presentations.set(entry.dataSourceId, fromDraft);
        continue;
      }
      // draft 未随请求传回(或不含该数据源)的兜底:按原口径重新取数,
      // 绝不编造初始行;口径未变,不重复呈现口径卡。
    }
    let unit = entry.unit;
    let derived = deriveExecutableUnit(unit, surfaces);

    context.haltIfAborted();
    yield step({
      type: 'execution_started',
      effectiveQuery: {
        language: 'dqe',
        body: derived.body,
        fieldMappings: derived.fields
      } as unknown as JSONValue,
      dataSourceId: entry.dataSourceId
    });

    // 运行取消会经注入的执行端口中止进行中的真实查询(#32/#64 设施);
    // 验真把中止归一为执行失败返回,这里在解读失败前先裁决取消/超时。
    const verify = async () => {
      const result = await ports.verifyUnit({
        dataSourceId: entry.dataSourceId,
        fields: derived.fields,
        query: { language: 'dqe', body: derived.body },
        question
      });
      context.haltIfAborted();
      return result;
    };
    let verification = await verify();

    // 清单校验被拒:给模型一次携带违规反馈的定向修复机会(名称与取值都有
    // 候选);修复决策里只采纳指向本单元的操作。
    if (
      !verification.ok &&
      verification.failure.code === 'UNIT_MANIFEST_REJECTED' &&
      isTouched &&
      context.formUnitOnce !== undefined
    ) {
      const feedback = (verification.failure.violations ?? []).map(
        (violation) =>
          `${violation.message}${violation.candidates.length > 0 ? `;候选:${violation.candidates.join('、')}` : ''}`
      );
      const repaired = await context.formUnitOnce(feedback);
      const repairedUnit = repairedUnitOf(repaired, unit, entry.dataSourceId);
      if (repairedUnit !== null) {
        unit = canonicalizeUnit(
          { ...repairedUnit, businessDomain: unit.businessDomain },
          surfaces
        );
        entry.unit = unit;
        derived = deriveExecutableUnit(unit, surfaces);
        verification = await verify();
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
      },
      dataSourceId: entry.dataSourceId
    });

    presentations.set(entry.dataSourceId, {
      kind: 'executed',
      fields: derived.fields,
      query: { language: 'dqe', body: derived.body },
      initial: {
        capturedAt: (ports.clock ?? (() => new Date()))().toISOString(),
        rows: verification.sampleRows,
        totalCount: verification.totalCount ?? verification.returnedRowCount
      },
      rowCount: verification.returnedRowCount,
      formulaTraces: verification.formulaTraces
    });
  }

  /* ---------- 意图判定(可跳过)与组件选择(确定性硬闸) ---------- */
  for (const entry of entries) {
    if (!context.touched.includes(entry.dataSourceId)) {
      entry.intent = entry.intent ?? defaultIntent(entry.unit);
      continue;
    }
    if (!context.isNewQuestion && entry.intent !== null) continue;
    entry.intent = await decideIntentWithFallback(context, entry.unit, entry.intent);
  }

  // 用户话语显式点名组件形态(「改成柱状图」)是最强展示信号:确定性
  // 识别(词汇唯一来源是 componentCatalog 的中文名),不依赖模型意图
  // 判定。作用域规则(点名与泛词解除共用):本轮被触及的全部单元
  // (新增/替换/定向修改的对象——「拆分成两个表格」的 modify+add 两个
  // 单元都要变表格)> 画布选中的 target 单元 > 全部单元;跨追问轮按
  // 单元保持,新点名覆盖,优先于 UI 钉住。泛词(「图表」)不点名:
  // 解除既有点名,把该单元的展示交还模型意图。
  const presentationScopeIds =
    context.touched.length > 0
      ? context.touched
      : context.targetDataSourceId !== null
        ? [context.targetDataSourceId]
        : entries.map((entry) => entry.dataSourceId);
  const requestedNow = explicitComponentRequest(question);
  if (requestedNow !== null) {
    for (const entry of entries) {
      if (presentationScopeIds.includes(entry.dataSourceId)) {
        entry.requestedComponent = requestedNow;
      }
    }
  } else if (genericVisualizationRequest(question)) {
    for (const entry of entries) {
      if (presentationScopeIds.includes(entry.dataSourceId)) {
        entry.requestedComponent = null;
      }
    }
  }

  const pinnedTypeOf = (
    entry: AskUnitEntryState
  ): ExecutedDataRequestUnit['pinnedComponent'] =>
    catalogComponentType(entry.requestedComponent) ??
    pinnedComponentFor(options.pinnedComponents, entry.dataSourceId);

  /* ---------- 装配(多 units 直接走 assembleTransientPage) ---------- */
  const executedUnits: ExecutedDataRequestUnit[] = entries.map((entry) => {
    const presentation = presentations.get(entry.dataSourceId)!;
    const adHoc = adHocDefinitionOf(entry.unit);
    const pinnedType = pinnedTypeOf(entry);
    return {
      dataSourceId: entry.dataSourceId,
      // 临时口径在呈现处可辨(ADR-0036):组件可见标题携带标记,随文档
      // 本身走到任何渲染宿主,不依赖工作台外壳。
      title: `${entry.unit.title ?? question}${adHoc === null ? '' : '(临时口径)'}`,
      fields: presentation.fields,
      query: presentation.query,
      initial: presentation.initial,
      intent: INTENT_TO_VISUALIZE[entry.intent ?? defaultIntent(entry.unit)],
      ...(pinnedType === undefined ? {} : { pinnedComponent: pinnedType })
    };
  });

  const transientPageId = transientPageIdFor(options.runId);
  const assembly = ports.assemblePage({
    pageId: transientPageId,
    description: question,
    units: executedUnits,
    sectionTitle: '问数结果',
    container: 'panel'
  });
  const roundTraces = mergeFormulaTraces(state.formulaTraces, entries, presentations);
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
    const rejectedEntry = entries.find(
      (entry) => entry.dataSourceId === pinnedIssue?.dataSourceId
    );
    const rejectedRequest = catalogComponentType(rejectedEntry?.requestedComponent) ?? null;
    yield assistant(
      pinnedIssue !== undefined
        ? rejectedRequest !== null
          ? `「${componentLabel(rejectedRequest)}」不适配当前结果形状,系统不会替你改选:${pinnedIssue.message}。可换一种展示说法或改问。`
          : `钉住的组件未通过组件能力硬闸,系统不会自动改写钉住选择:${pinnedIssue.message}。可取消钉住或改问。`
        : `结果无法装配为页面文档:${firstIssue.message}`
    );
    yield completed({ ...state, units: entries, formulaTraces: roundTraces }, null);
    return;
  }

  const entryOf = (dataSourceId: string): AskUnitEntryState | undefined =>
    entries.find((entry) => entry.dataSourceId === dataSourceId);
  const components = assembly.document.sections.flatMap((section) =>
    section.components.map((component) => {
      const owner = entryOf(component.data.main);
      const pinned = owner === undefined ? undefined : pinnedTypeOf(owner);
      return {
        componentType: component.type,
        pinnedByUser: pinned !== undefined && component.type === pinned,
        dataSourceId: component.data.main
      };
    })
  );
  const primaryEntry =
    entries.find((entry) => entry.dataSourceId === context.touched[0]) ?? entries[0]!;
  const primaryIntent = primaryEntry.intent ?? defaultIntent(primaryEntry.unit);
  yield step({ type: 'document_ready', intent: primaryIntent, components, transientPageId });

  const finalState: AskConversationState = {
    ...state,
    units: entries,
    transientPageId,
    formulaTraces: roundTraces,
    pending: null
  };
  const document = assembly.document as unknown as Record<string, unknown>;
  yield assistant(summaryText(entries, presentations, components.map((c) => c.componentType)));
  if (context.gapAspects.length === 0) {
    yield completed(finalState, document);
    return;
  }

  // 部分可答分开呈现(ADR-0036、#67):能答的部分已在上方作答;缺的部分
  // 结构上不在取数单元与页面文档里,这里单独列出,经用户确认后才登记。
  const gapAnchor = primaryEntry.unit;
  const pendingGap: AskPendingGapEntry = {
    interactionId: `confirm-gap:${options.runId}`,
    occurrences: context.gapAspects.map((gap) => ({
      idempotencyKey: scopeGapKey(gapAnchor.businessDomain, gap.aspect),
      question,
      searchTerms: [gap.aspect],
      closestCandidates: context.candidates.map(toMetricCandidate),
      adHocDefinition: null,
      expectedDimensions: gapAnchor.groupBy,
      expectedGranularity: gapAnchor.time?.granularity ?? null,
      businessDomain: gapAnchor.businessDomain
    }))
  };
  yield assistant(
    '以下部分当前数据能力无法回答,单独列为缺口,未混入本次结果:\n' +
      context.gapAspects.map((gap) => `- ${gap.aspect}:${gap.reason}`).join('\n') +
      '\n可确认登记为指标需求条目;也可直接继续追问。'
  );
  yield gapInteractionRequired(
    pendingGap,
    question,
    context.messages,
    { ...finalState, pendingGapEntry: pendingGap },
    document
  );
}

async function decideIntentWithFallback(
  context: ExecutionContext,
  unit: AskDataRequestUnitState,
  previousIntent: AnalysisIntent | null
): Promise<AnalysisIntent> {
  try {
    const decision = await context.decide(() =>
      context.ports.model.decideIntent({
        question: context.question,
        unit,
        previousIntent,
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

/* ---------- 单元操作集的确定性应用 ---------- */

/**
 * 把口径成形决策归一为定向单元操作集:操作集原样返回;单单元简写
 * (unit / patch)落到目标单元——有 target 时是 target 对应单元,否则
 * 是首单元;首轮的 unit 简写即新增。
 */
function operationsOf(
  decision: Exclude<AskUnitFormingDecision, { outcome: 'out_of_scope' }>,
  entries: readonly AskUnitEntryState[],
  targetDataSourceId: string | null
): AskUnitOperation[] {
  if (decision.outcome === 'operations') return decision.operations;
  const targetId = targetDataSourceId ?? entries[0]?.dataSourceId ?? null;
  if (decision.outcome === 'unit') {
    return targetId === null
      ? [{ op: 'add', unit: decision.unit }]
      : [{ op: 'replace', dataSourceId: targetId, unit: decision.unit }];
  }
  if (targetId === null) return [];
  return [{ op: 'modify', dataSourceId: targetId, patch: decision.patch }];
}

interface ApplyUnitOperationsInput {
  entries: readonly AskUnitEntryState[];
  operations: readonly AskUnitOperation[];
  nextOrdinal: number;
  routedDomains: readonly string[];
  /** 单元业务域不在路由域内时的确定性纠偏(消歧胜出候选的域优先)。 */
  fallbackDomain: string;
  question: string;
  onUnknownUnit: (dataSourceId: string) => never;
}

interface ApplyUnitOperationsResult {
  entries: AskUnitEntryState[];
  /** 被新增或实际修改的单元(空 patch 不触及,ADR-0037 的结构性不变)。 */
  touched: string[];
  added: string[];
  nextOrdinal: number;
}

/**
 * 应用定向单元操作集:add 由编排分配稳定数据源名(序号只增不复用),
 * replace / modify 定向作用于指定单元,remove 删除。未被触及的单元
 * 原对象原样保留(结构性不变是引用级保证)。
 */
function applyUnitOperations(input: ApplyUnitOperationsInput): ApplyUnitOperationsResult {
  let entries = [...input.entries];
  const touched: string[] = [];
  const added: string[] = [];
  let nextOrdinal = input.nextOrdinal;

  const coerceDomain = (unit: AskDataRequestUnitState): AskDataRequestUnitState =>
    input.routedDomains.includes(unit.businessDomain)
      ? unit
      : { ...unit, businessDomain: input.fallbackDomain };
  const indexOf = (dataSourceId: string): number => {
    const index = entries.findIndex((entry) => entry.dataSourceId === dataSourceId);
    if (index === -1) input.onUnknownUnit(dataSourceId);
    return index;
  };
  const touch = (dataSourceId: string): void => {
    if (!touched.includes(dataSourceId)) touched.push(dataSourceId);
  };

  for (const operation of input.operations) {
    switch (operation.op) {
      case 'add': {
        const unit = coerceDomain(operation.unit);
        const dataSourceId = askUnitDataSourceId(nextOrdinal);
        nextOrdinal += 1;
        entries.push({
          dataSourceId,
          unit: { ...unit, title: unit.title ?? input.question },
          intent: null,
          requestedComponent: null
        });
        touch(dataSourceId);
        added.push(dataSourceId);
        break;
      }
      case 'replace': {
        const index = indexOf(operation.dataSourceId);
        const unit = coerceDomain(operation.unit);
        entries[index] = {
          ...entries[index]!,
          unit: { ...unit, title: unit.title ?? input.question }
        };
        touch(operation.dataSourceId);
        break;
      }
      case 'modify': {
        const index = indexOf(operation.dataSourceId);
        // 空 patch 不构成触及:定向增量语义下没有任何层被改变。
        if (Object.keys(operation.patch).length === 0) break;
        entries[index] = {
          ...entries[index]!,
          unit: { ...entries[index]!.unit, ...operation.patch }
        };
        touch(operation.dataSourceId);
        break;
      }
      case 'remove': {
        const index = indexOf(operation.dataSourceId);
        entries = entries.filter((_, entryIndex) => entryIndex !== index);
        break;
      }
    }
  }
  return {
    entries,
    touched: touched.filter((id) => entries.some((entry) => entry.dataSourceId === id)),
    added: added.filter((id) => entries.some((entry) => entry.dataSourceId === id)),
    nextOrdinal
  };
}

/**
 * 清单校验修复决策中指向指定单元的修复结果:操作集里取该单元的
 * replace/modify;单单元简写按目标单元解读。无可用修复时返回 null。
 */
function repairedUnitOf(
  decision: AskUnitFormingDecision,
  current: AskDataRequestUnitState,
  dataSourceId: string
): AskDataRequestUnitState | null {
  if (decision.outcome === 'out_of_scope') return null;
  if (decision.outcome === 'unit') return decision.unit;
  if (decision.outcome === 'patch') return { ...current, ...decision.patch };
  for (const operation of decision.operations) {
    if (operation.op === 'replace' && operation.dataSourceId === dataSourceId) {
      return operation.unit;
    }
    if (operation.op === 'modify' && operation.dataSourceId === dataSourceId) {
      return { ...current, ...operation.patch };
    }
    if (operation.op === 'add' && decision.operations.length === 1) {
      // 模型把修复误报成新增:按整单元重写解读,不扩张单元集合。
      return operation.unit;
    }
  }
  return null;
}

/** 替换或补入一个单元条目(历史单 unit 口径卡的兼容续跑用)。 */
function upsertUnitEntry(
  entries: readonly AskUnitEntryState[],
  entry: AskUnitEntryState
): AskUnitEntryState[] {
  return entries.some((candidate) => candidate.dataSourceId === entry.dataSourceId)
    ? entries.map((candidate) =>
        candidate.dataSourceId === entry.dataSourceId
          ? { ...candidate, unit: entry.unit }
          : candidate
      )
    : [...entries, entry];
}

/* ---------- 呈现来源辅助 ---------- */

/**
 * 从随请求传回的 draft 文档(上一轮临时页面)取未触及单元的既有面:
 * 查询定义与初始行逐字节复用,不重新执行。draft 是文档态页面,其
 * dataSources 形状由装配唯一实现产出并通过过 validate。
 */
function draftPresentationOf(
  draft: Record<string, unknown> | undefined,
  dataSourceId: string
): UnitPresentation | null {
  if (draft === undefined) return null;
  const dataSources = draft.dataSources;
  if (typeof dataSources !== 'object' || dataSources === null) return null;
  const dataSource = (dataSources as Record<string, unknown>)[dataSourceId];
  if (typeof dataSource !== 'object' || dataSource === null) return null;
  const { fields, source } = dataSource as { fields?: unknown; source?: unknown };
  if (typeof fields !== 'object' || fields === null) return null;
  if (typeof source !== 'object' || source === null) return null;
  const { type, query, initial } = source as {
    type?: unknown;
    query?: unknown;
    initial?: unknown;
  };
  if (type !== 'query' || typeof query !== 'object' || query === null) return null;
  if (
    typeof initial !== 'object' ||
    initial === null ||
    !Array.isArray((initial as { rows?: unknown }).rows)
  ) {
    return null;
  }
  return {
    kind: 'draft',
    fields: fields as ExecutedDataRequestUnit['fields'],
    query: query as ExecutedDataRequestUnit['query'],
    initial: initial as NonNullable<ExecutedDataRequestUnit['initial']>
  };
}

/**
 * formula 留痕的跨轮维护(#68):本轮真实执行产生的留痕如实追加;上一轮
 * 留痕仅在其表达式仍存在于当前单元集合的 formula 指标里时保留(单元被
 * 删除或口径被改写后,留痕随之退场)。
 */
function mergeFormulaTraces(
  previous: readonly FormulaTrace[],
  entries: readonly AskUnitEntryState[],
  presentations: ReadonlyMap<string, UnitPresentation>
): FormulaTrace[] {
  const fresh = entries.flatMap((entry) => {
    const presentation = presentations.get(entry.dataSourceId);
    return presentation?.kind === 'executed' ? presentation.formulaTraces : [];
  });
  const liveExpressions = new Set(
    entries.flatMap((entry) =>
      entry.unit.metrics.flatMap((metric) =>
        metric.kind === 'formula' ? [metric.expression] : []
      )
    )
  );
  const freshExpressions = new Set(fresh.map((trace) => trace.expression));
  const kept = previous.filter(
    (trace) => liveExpressions.has(trace.expression) && !freshExpressions.has(trace.expression)
  );
  return [...kept, ...fresh];
}

/* ---------- 事件与决策的纯函数辅助 ---------- */

/** 请求 target(sectionId/componentId)→ draft 文档组件的 data.main → 单元。 */
function targetUnitIdOf(
  options: Pick<AskRunnerOptions, 'draft' | 'target'>,
  entries: readonly AskUnitEntryState[]
): string | null {
  const { draft, target } = options;
  if (draft === undefined || target === undefined) return null;
  const sections = Array.isArray(draft.sections)
    ? (draft.sections as Array<Record<string, unknown>>)
    : [];
  const section = sections.find((candidate) => candidate.id === target.sectionId);
  const components = Array.isArray(section?.components)
    ? (section.components as Array<Record<string, unknown>>)
    : [];
  const component = components.find((candidate) => candidate.id === target.componentId);
  const data = component?.data;
  const main =
    typeof data === 'object' && data !== null
      ? (data as { main?: unknown }).main
      : undefined;
  return typeof main === 'string' &&
    entries.some((entry) => entry.dataSourceId === main)
    ? main
    : null;
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
  blockedOnConfirmation: boolean,
  dataSourceId: string
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
    blockedOnConfirmation,
    dataSourceId
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

/**
 * 缺口登记确认(#67):非阻塞出口——回答(或降级解释)已经给出,交互只
 * 决定是否登记;用户不确认(换个问题)即放弃,不产生缺口条目。部分可答
 * 时随事件携带已装配的页面文档,能答的部分照常交付。
 */
function gapInteractionRequired(
  pendingGap: AskPendingGapEntry,
  question: string,
  messages: AgentMessage[],
  state: AskConversationState,
  document?: Record<string, unknown> | null
): AgentEvent {
  const interaction: AgentInteraction = {
    id: pendingGap.interactionId,
    kind: 'confirm_gap_entry',
    payload: {
      question,
      entries: pendingGap.occurrences.map((occurrence) => ({
        businessDomain: occurrence.businessDomain,
        sought: occurrence.searchTerms.join('、') || occurrence.question,
        adHocFormula: occurrence.adHocDefinition?.formula ?? null
      }))
    }
  };
  return {
    type: 'interaction_required',
    interaction,
    messages: withAskState(messages, state),
    ...(document === undefined ? {} : { document })
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

/**
 * 用户话语中的显式组件请求:确定性词面匹配组件目录的中文名(目录是
 * 组件词汇唯一来源,不自造别名);多个命中取问题中最后出现者(「不要
 * 折线图,改成柱状图」→ 柱状图)。
 */
function explicitComponentRequest(
  question: string
): ExecutedDataRequestUnit['pinnedComponent'] | null {
  let best: { type: ExecutedDataRequestUnit['pinnedComponent']; index: number } | null = null;
  for (const entry of componentCatalog) {
    for (const term of [entry.label, ...entry.aliases]) {
      const index = question.lastIndexOf(term);
      if (index >= 0 && (best === null || index > best.index)) {
        best = { type: entry.type, index };
      }
    }
  }
  return best?.type ?? null;
}

/**
 * 泛指可视化的词面:不点名任何具体组件形态(「图表」不在组件目录的
 * 名称与别名里),语义是「换成图表类展示」。命中时解除目标单元的既有
 * 显式点名,把展示选择交还该单元的模型意图;仅在显式点名未命中时判定。
 */
const GENERIC_VISUALIZATION_TERMS = ['图表', '图形', '可视化'] as const;

function genericVisualizationRequest(question: string): boolean {
  return GENERIC_VISUALIZATION_TERMS.some((term) => question.includes(term));
}

/** 把状态里的宽字符串收窄回组件目录类型;目录外(历史脏值)按未点名处理。 */
function catalogComponentType(
  value: string | null | undefined
): ExecutedDataRequestUnit['pinnedComponent'] | null {
  if (value === null || value === undefined) return null;
  return componentCatalog.some((entry) => entry.type === value)
    ? (value as ExecutedDataRequestUnit['pinnedComponent'])
    : null;
}

/** 组件类型的中文名(componentCatalog 真源);目录外原样返回。 */
function componentLabel(type: string): string {
  return componentCatalog.find((entry) => entry.type === type)?.label ?? type;
}

type StructuralIntentKind = '合并' | '拆分' | '删除' | '增加';

/**
 * 结构操作动词闭集:命中即认定本轮要求单元结构变化(映射仅有的四种
 * 单元操作)。刻意不收裸词「增加/新增」(与指标名「新增客户数」冲突,
 * 且 add 操作模型极少输出空结果),只收强操作词与带量词组合。
 */
const STRUCTURAL_INTENT_TERMS: ReadonlyArray<readonly [string, StructuralIntentKind]> = [
  ['合并', '合并'],
  ['合成一', '合并'],
  ['合到', '合并'],
  ['放到一', '合并'],
  ['放在一', '合并'],
  ['放一张', '合并'],
  ['拆分', '拆分'],
  ['拆成', '拆分'],
  ['分成', '拆分'],
  ['分开展示', '拆分'],
  ['分别展示', '拆分'],
  ['删除', '删除'],
  ['移除', '删除'],
  ['去掉', '删除'],
  ['增加一个', '增加'],
  ['添加一个', '增加'],
  ['再加一个', '增加'],
  ['加一个', '增加']
];

/**
 * 结构诉求是否「尚未满足」:目标状态已成立时空操作是合法响应——
 * 「分别展示」而单元已拆开、「合并」而只剩一个单元,都不该触发重试。
 */
function structuralOperationIntent(question: string, unitCount: number): string | null {
  for (const [term, kind] of STRUCTURAL_INTENT_TERMS) {
    if (!question.includes(term)) continue;
    if (kind === '合并' && unitCount <= 1) continue;
    if (kind === '拆分' && unitCount > 1) continue;
    return kind;
  }
  return null;
}

/** 空结构响应:面外、空操作集或空 patch——对结构诉求而言等于什么都没做。 */
function isEmptyStructuralResponse(decision: AskUnitFormingDecision): boolean {
  if (decision.outcome === 'out_of_scope') return true;
  if (decision.outcome === 'operations') {
    return (
      decision.operations.length === 0 ||
      decision.operations.every(
        (operation) =>
          operation.op === 'modify' && Object.keys(operation.patch).length === 0
      )
    );
  }
  if (decision.outcome === 'patch') return Object.keys(decision.patch).length === 0;
  return false;
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
  entries: readonly AskUnitEntryState[],
  presentations: ReadonlyMap<string, UnitPresentation>,
  componentTypes: readonly string[]
): string {
  const rowCountOf = (dataSourceId: string): number => {
    const presentation = presentations.get(dataSourceId);
    if (presentation === undefined) return 0;
    return presentation.kind === 'executed'
      ? presentation.rowCount
      : presentation.initial.rows.length;
  };
  const unitLine = (entry: AskUnitEntryState): string => {
    const unit = entry.unit;
    const metricText = unit.metrics
      .map((metric) => (metric.kind === 'metric' ? metric.name : `${metric.label}(临时口径)`))
      .join('、');
    const timeText =
      unit.time === null
        ? '不限定时间范围'
        : `${unit.time.start} ~ ${unit.time.end}(${unit.time.granularity})`;
    return `业务域「${unit.businessDomain}」,指标 ${metricText || '(待定)'},${timeText},返回 ${rowCountOf(entry.dataSourceId)} 行`;
  };
  if (entries.length === 1) {
    return `已完成:${unitLine(entries[0]!)},呈现为 ${componentTypes.map(componentLabel).join(' + ')}。`;
  }
  return (
    `已完成 ${entries.length} 个取数单元:\n` +
    entries.map((entry, index) => `${index + 1}. ${unitLine(entry)}`).join('\n') +
    `\n呈现为 ${componentTypes.map(componentLabel).join(' + ')}。`
  );
}

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values)];
}
