import type { AgentInteraction, AgentMessage } from '../server/agent/types';
import type { AgentRunOutcomeStatus } from '../server/agent/stream';
import type {
  AdHocDefinition,
  AgentRunStreamEvent,
  AnalysisIntent,
  ComponentChoice,
  DimensionFilter,
  ExecutionResultSummary,
  FailureStage,
  MetricCandidate
} from '../server/session/step-event';
import type { AgentRunOutcomeFrame } from './stream-consumer';

/**
 * 一次 Agent 运行的界面状态机(#65):把 AgentRunStreamEvent(契约唯一
 * 真源:$lib/server/session/step-event.ts)与 outcome 帧映射为对话轨与
 * 步骤时间线可直接渲染的视图状态。纯函数、不依赖浏览器,用构造的事件
 * 序列即可确定性测试。
 *
 * 事件 → 状态映射:
 * - run_started              → 记录 sessionId,保持 running
 * - assistant_replied        → 追加对话回复气泡
 * - tool_call_started/finished → 时间线工具调用条目:进行中 → 成功/失败(附错误码)
 * - domain_routed / candidates_retrieved / execution_started / rows_ready /
 *   document_ready           → 追加对应编排步骤(ADR-0037 顺序)
 * - scope_card_presented     → 追加口径卡;blockedOnConfirmation 标记阻塞
 * - step_failed              → 追加失败步骤(发现/生成/执行/呈现四段分类)
 * - run_interaction_required → 记录待人工交互;若最近口径卡处于阻塞且尚未
 *                              执行,标记该卡等待确认
 * - run_completed / run_failed / run_cancelled → 运行终态
 * - outcome 帧               → 终态、续跑基线消息、页面文档、交互与错误的最终真源
 */

export type WorkbenchRunStatus = 'running' | AgentRunOutcomeStatus;

export type ToolCallStepStatus = 'running' | 'succeeded' | 'failed';

/** 口径卡视图:完整生效范围 + 阻塞确认状态(ADR-0037)。 */
export interface ScopeCardView {
  businessDomain: string;
  metricName: string | null;
  adHocDefinition: AdHocDefinition | null;
  timeRange: string;
  granularity: string;
  filters: readonly DimensionFilter[];
  blockedOnConfirmation: boolean;
  /** 运行已停在人工交互且本卡是阻塞源:界面在卡上呈现"确认执行"。 */
  awaitingConfirmation: boolean;
}

export type RunStep =
  | {
      kind: 'domain_routed';
      question: string;
      routedDomains: readonly string[];
      overriddenByUser: boolean;
    }
  | {
      kind: 'candidates_retrieved';
      candidates: readonly MetricCandidate[];
      selectedMetric: string | null;
      adHocDefinition: AdHocDefinition | null;
    }
  | { kind: 'scope_card'; card: ScopeCardView }
  | { kind: 'execution_started' }
  | { kind: 'rows_ready'; summary: ExecutionResultSummary }
  | {
      kind: 'document_ready';
      intent: AnalysisIntent;
      components: readonly ComponentChoice[];
      transientPageId: string;
    }
  | {
      kind: 'tool_call';
      toolCallId: string;
      toolName: string;
      status: ToolCallStepStatus;
      errorCode: string | null;
    }
  | { kind: 'step_failed'; stage: FailureStage; code: string; message: string }
  | { kind: 'interaction_required'; interactionId: string; interactionKind: string };

export interface RunFailureView {
  code: string;
  message: string;
  stage: FailureStage | null;
  retryable: boolean;
}

export interface WorkbenchRunView {
  runId: string;
  /** 本轮用户问题;确认后续跑的运行没有新问题,为 null。 */
  question: string | null;
  status: WorkbenchRunStatus;
  sessionId: string | null;
  /** 助手文本回复(assistant_replied),按到达顺序。 */
  replies: string[];
  steps: RunStep[];
  /** 待人工交互:运行停机等待确认,由用户动作发起新运行继续。 */
  pendingInteraction: AgentInteraction | null;
  failure: RunFailureView | null;
  /** 本次运行产出的已校验页面文档(outcome 帧)。 */
  document: Record<string, unknown> | null;
  /** outcome 帧的会话消息:下一轮请求的基线。 */
  baselineMessages: AgentMessage[] | null;
}

export function createRunView(input: {
  runId: string;
  question: string | null;
}): WorkbenchRunView {
  return {
    runId: input.runId,
    question: input.question,
    status: 'running',
    sessionId: null,
    replies: [],
    steps: [],
    pendingInteraction: null,
    failure: null,
    document: null,
    baselineMessages: null
  };
}

export function applyStreamEvent(
  view: WorkbenchRunView,
  event: AgentRunStreamEvent
): WorkbenchRunView {
  switch (event.type) {
    case 'run_started':
      return { ...view, sessionId: event.sessionId };
    case 'assistant_replied':
      return { ...view, replies: [...view.replies, event.content] };
    case 'tool_call_started':
      return appendStep(view, {
        kind: 'tool_call',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        status: 'running',
        errorCode: null
      });
    case 'tool_call_finished':
      return finishToolCall(view, event.toolCallId, event.toolName, {
        status: event.status,
        errorCode: event.errorCode
      });
    case 'domain_routed':
      return appendStep(view, {
        kind: 'domain_routed',
        question: event.question,
        routedDomains: event.routedDomains,
        overriddenByUser: event.overriddenByUser
      });
    case 'candidates_retrieved':
      return appendStep(view, {
        kind: 'candidates_retrieved',
        candidates: event.candidates,
        selectedMetric: event.selectedMetric,
        adHocDefinition: event.adHocDefinition
      });
    case 'scope_card_presented':
      return appendStep(view, {
        kind: 'scope_card',
        card: {
          businessDomain: event.businessDomain,
          metricName: event.metricName,
          adHocDefinition: event.adHocDefinition,
          timeRange: event.timeRange,
          granularity: event.granularity,
          filters: event.filters,
          blockedOnConfirmation: event.blockedOnConfirmation,
          awaitingConfirmation: false
        }
      });
    case 'execution_started':
      return appendStep(view, { kind: 'execution_started' });
    case 'rows_ready':
      return appendStep(view, { kind: 'rows_ready', summary: event.summary });
    case 'document_ready':
      return appendStep(view, {
        kind: 'document_ready',
        intent: event.intent,
        components: event.components,
        transientPageId: event.transientPageId
      });
    case 'step_failed':
      return appendStep(view, {
        kind: 'step_failed',
        stage: event.stage,
        code: event.code,
        message: event.message
      });
    case 'run_interaction_required':
      return markBlockedScopeCardAwaiting(
        appendStep(
          {
            ...view,
            pendingInteraction: {
              id: event.interactionId,
              kind: event.kind,
              payload: event.payload
            }
          },
          {
            kind: 'interaction_required',
            interactionId: event.interactionId,
            interactionKind: event.kind
          }
        )
      );
    case 'run_completed':
      return { ...view, status: 'completed' };
    case 'run_failed':
      return {
        ...view,
        status: 'failed',
        failure: view.failure ?? failureFromLastStep(view, event.retryable)
      };
    case 'run_cancelled':
      return { ...view, status: 'cancelled' };
  }
}

/** outcome 帧是终态、基线消息、页面文档、交互与错误的最终真源。 */
export function applyOutcome(
  view: WorkbenchRunView,
  outcome: AgentRunOutcomeFrame
): WorkbenchRunView {
  return markBlockedScopeCardAwaiting({
    ...view,
    status: outcome.status,
    baselineMessages: outcome.messages,
    document: outcome.document ?? view.document,
    pendingInteraction: outcome.interaction ?? view.pendingInteraction,
    failure: outcome.error
      ? {
          code: outcome.error.code,
          message: outcome.error.message,
          stage: outcome.error.stage ?? null,
          retryable: outcome.error.retryable
        }
      : view.failure
  });
}

/** 推送连接层面的失败(网络中断、协议错):按失败终态呈现,可重试。 */
export function applyTransportFailure(
  view: WorkbenchRunView,
  message: string
): WorkbenchRunView {
  if (view.status !== 'running') return view;
  return {
    ...view,
    status: 'failed',
    failure: { code: 'STREAM_DISCONNECTED', message, stage: null, retryable: true }
  };
}

/** 运行是否停在口径卡阻塞确认上(候选歧义 / 自由生成表达式等,ADR-0037)。 */
export function awaitingScopeConfirmation(view: WorkbenchRunView): boolean {
  return view.steps.some(
    (step) => step.kind === 'scope_card' && step.card.awaitingConfirmation
  );
}

/** 时间线里的口径卡步骤,按呈现顺序。 */
export function scopeCards(view: WorkbenchRunView): ScopeCardView[] {
  return view.steps.flatMap((step) =>
    step.kind === 'scope_card' ? [step.card] : []
  );
}

function appendStep(view: WorkbenchRunView, step: RunStep): WorkbenchRunView {
  return { ...view, steps: [...view.steps, step] };
}

function finishToolCall(
  view: WorkbenchRunView,
  toolCallId: string,
  toolName: string,
  result: { status: 'succeeded' | 'failed'; errorCode: string | null }
): WorkbenchRunView {
  const index = lastIndexWhere(
    view.steps,
    (step) => step.kind === 'tool_call' && step.toolCallId === toolCallId
  );
  if (index === -1) {
    // 开始帧缺失(如断线重连后半程消费)时仍呈现结果,不丢工具状态。
    return appendStep(view, {
      kind: 'tool_call',
      toolCallId,
      toolName,
      status: result.status,
      errorCode: result.errorCode
    });
  }
  const steps = [...view.steps];
  const current = steps[index] as Extract<RunStep, { kind: 'tool_call' }>;
  steps[index] = { ...current, status: result.status, errorCode: result.errorCode };
  return { ...view, steps };
}

/**
 * 运行停在人工交互时,若最近一张口径卡带阻塞标记且其后没有真实执行,
 * 该卡即为阻塞源:标记等待确认,由界面在卡上呈现"确认执行"。
 */
function markBlockedScopeCardAwaiting(view: WorkbenchRunView): WorkbenchRunView {
  if (!view.pendingInteraction) return view;
  const lastScopeIndex = lastIndexWhere(
    view.steps,
    (step) => step.kind === 'scope_card'
  );
  if (lastScopeIndex === -1) return view;
  const scopeStep = view.steps[lastScopeIndex] as Extract<
    RunStep,
    { kind: 'scope_card' }
  >;
  if (!scopeStep.card.blockedOnConfirmation || scopeStep.card.awaitingConfirmation) {
    return view;
  }
  const executedAfter = view.steps
    .slice(lastScopeIndex + 1)
    .some((step) => step.kind === 'execution_started');
  if (executedAfter) return view;
  const steps = [...view.steps];
  steps[lastScopeIndex] = {
    ...scopeStep,
    card: { ...scopeStep.card, awaitingConfirmation: true }
  };
  return { ...view, steps };
}

function failureFromLastStep(
  view: WorkbenchRunView,
  retryable: boolean
): RunFailureView {
  const lastFailedIndex = lastIndexWhere(
    view.steps,
    (step) => step.kind === 'step_failed'
  );
  const lastFailed = lastFailedIndex === -1 ? undefined : view.steps[lastFailedIndex];
  if (lastFailed && lastFailed.kind === 'step_failed') {
    return {
      code: lastFailed.code,
      message: lastFailed.message,
      stage: lastFailed.stage,
      retryable
    };
  }
  return { code: 'AGENT_RUN_FAILED', message: '运行失败', stage: null, retryable };
}

function lastIndexWhere<T>(items: readonly T[], match: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item !== undefined && match(item)) return index;
  }
  return -1;
}
