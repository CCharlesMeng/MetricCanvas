import {
  isPersistedStepEvent,
  type AgentRunStreamEvent,
  type AnalysisStepEvent,
  type StepFailedEvent
} from '../session/step-event';
import { validatedAgentDocument } from '../agent-events.server';
import { normalizeAgentRunError, type NormalizedAgentError } from './errors';
import { AgentRunnerError } from './runner';
import type {
  AgentEvent,
  AgentInteraction,
  AgentMessage,
  AgentRunner,
  TokenUsage
} from './types';

/**
 * Agent 运行推送通道(#32):把 Runner 的异步事件序列翻译成带序号的
 * AgentRunStreamEvent(契约唯一真源:../session/step-event.ts),供服务端
 * 推送端点按序下发;其中属于步骤事件的部分按 ADR-0030 落库。
 *
 * 通道只做三件事:翻译、编号、落库,并在结束时产出运行结果(供重试/续跑)
 * 与运行审计(结构化用量、工具审计与错误分类)。它不感知 HTTP 与 SSE,
 * 独立可测;传输编码在 stream-endpoint.ts。
 *
 * 日志红线:运行审计不含 Prompt、模型回复正文、工具入参与任何凭据,
 * 只有计数、耗时、用量与稳定错误分类。
 */

export interface SequencedAgentRunStreamEvent {
  /** 会话内从 1 开始单调递增:界面按序消费与断线定位的依据。 */
  sequence: number;
  event: AgentRunStreamEvent;
}

export type AgentRunOutcomeStatus =
  | 'completed'
  | 'interaction_required'
  | 'failed'
  | 'cancelled';

/** 运行结果:终态、结束时的会话状态与(如有)已通过校验的页面文档。 */
export interface AgentRunOutcome {
  status: AgentRunOutcomeStatus;
  /**
   * 运行结束时的会话状态。失败与取消时是停机时刻的快照:重试失败步骤
   * 即以它为基线再次运行,已完成的步骤不重做。
   */
  messages: AgentMessage[];
  document: Record<string, unknown> | null;
  interaction: AgentInteraction | null;
  failure: NormalizedAgentError | null;
}

export interface AgentRunAuditToolCall {
  toolName: string;
  status: 'succeeded' | 'failed';
  durationMs: number;
}

/** 运行审计:普通日志唯一允许记录的运行级内容。 */
export interface AgentRunAudit {
  runId: string;
  sessionId: string | null;
  outcome: AgentRunOutcomeStatus;
  modelTurns: number;
  usage: TokenUsage;
  toolCalls: AgentRunAuditToolCall[];
  failure: { category: NormalizedAgentError['category']; stage: NormalizedAgentError['stage'] } | null;
}

export interface AgentRunStreamOptions {
  runner: AgentRunner;
  runId: string;
  messages: AgentMessage[];
  signal?: AbortSignal;
  /** 关联的分析会话:提供时,通道产生的步骤事件经 persistStepEvent 落库。 */
  sessionId?: string | null;
  persistStepEvent?: (sessionId: string, event: AnalysisStepEvent) => Promise<void>;
  /**
   * 运行终态的会话检查点写入。与步骤事件一样,写入失败不得
   * 掩盖 Agent 本身的终态或中断推送。
   */
  persistOutcome?: (sessionId: string, outcome: AgentRunOutcome) => Promise<void>;
  /** 运行结束(任何终态)时回调一次:推送端点用它拼装结果帧。 */
  onOutcome?: (outcome: AgentRunOutcome) => void;
  auditSink?: (audit: AgentRunAudit) => void;
  /** 毫秒时钟,只用于工具耗时审计;测试注入固定时钟。 */
  clock?: () => number;
}

export async function* streamAgentRun(
  options: AgentRunStreamOptions
): AsyncGenerator<SequencedAgentRunStreamEvent> {
  const clock = options.clock ?? Date.now;
  const sessionId = options.sessionId ?? null;
  let sequence = 0;
  const emit = (event: AgentRunStreamEvent): SequencedAgentRunStreamEvent => {
    sequence += 1;
    return { sequence, event };
  };

  const agentEvents: AgentEvent[] = [];
  const usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let modelTurns = 0;
  const toolCalls: AgentRunAuditToolCall[] = [];
  const toolStartedAt = new Map<string, number>();
  let outcome: AgentRunOutcome | null = null;

  const persist = async (event: AnalysisStepEvent): Promise<void> => {
    if (!sessionId || !options.persistStepEvent || !isPersistedStepEvent(event)) return;
    try {
      await options.persistStepEvent(sessionId, event);
    } catch {
      // 落库失败不得掩盖运行本身的终态,也不得中断推送;审计仍记录失败分类。
    }
  };

  try {
    yield emit({ type: 'run_started', runId: options.runId, sessionId });
    try {
      for await (const event of options.runner.run({
        messages: options.messages,
        signal: options.signal
      })) {
        agentEvents.push(event);
        switch (event.type) {
          case 'assistant_message':
            yield emit({ type: 'assistant_replied', content: event.message.content });
            break;
          case 'step':
            // 编排步骤事件(#66):原样进入通道并按 ADR-0030 落库。
            await persist(event.event);
            yield emit(event.event);
            break;
          case 'turn_completed':
            modelTurns = event.turn;
            if (event.usage) {
              usage.promptTokens += event.usage.promptTokens;
              usage.completionTokens += event.usage.completionTokens;
              usage.totalTokens += event.usage.totalTokens;
            }
            break;
          case 'tool_started':
            toolStartedAt.set(event.call.id, clock());
            yield emit({
              type: 'tool_call_started',
              toolCallId: event.call.id,
              toolName: event.call.name
            });
            break;
          case 'tool_finished': {
            const status = event.result.isError === true ? 'failed' : 'succeeded';
            const startedAt = toolStartedAt.get(event.call.id);
            toolCalls.push({
              toolName: event.call.name,
              status,
              durationMs: startedAt === undefined ? 0 : clock() - startedAt
            });
            yield emit({
              type: 'tool_call_finished',
              toolCallId: event.call.id,
              toolName: event.call.name,
              status,
              errorCode: toolErrorCode(event.result)
            });
            break;
          }
          case 'interaction_required':
            outcome = {
              status: 'interaction_required',
              messages: event.messages,
              // 编排可携带停机前已产出的文档(#67 部分可答);工具循环回退推导。
              document: event.document ?? validatedAgentDocument(agentEvents),
              interaction: event.interaction,
              failure: null
            };
            yield emit({
              type: 'run_interaction_required',
              interactionId: event.interaction.id,
              kind: event.interaction.kind,
              payload: event.interaction.payload
            });
            break;
          case 'completed':
            outcome = {
              status: 'completed',
              messages: event.messages,
              // 编排的装配出口直接给出已校验文档;工具循环回退到工具结果推导。
              document: event.document ?? validatedAgentDocument(agentEvents),
              interaction: null,
              failure: null
            };
            yield emit({ type: 'run_completed' });
            break;
        }
      }
      if (!outcome) {
        // Runner 契约要求以 completed / interaction_required 收尾或抛出;
        // 走到这里说明消费到了不完整序列,按内部错误归一化。
        const failure = normalizeAgentRunError(null);
        outcome = failureOutcome(failure, options.messages, agentEvents);
        const stepFailed = toStepFailed(failure);
        await persist(stepFailed);
        yield emit(stepFailed);
        yield emit({ type: 'run_failed', retryable: failure.retryable });
      }
    } catch (cause) {
      const failure = normalizeAgentRunError(cause);
      const messages =
        cause instanceof AgentRunnerError ? cause.messages : options.messages;
      if (failure.category === 'RUN_CANCELLED') {
        outcome = {
          status: 'cancelled',
          messages,
          document: validatedAgentDocument(agentEvents),
          interaction: null,
          failure
        };
        yield emit({ type: 'run_cancelled' });
      } else {
        outcome = failureOutcome(failure, messages, agentEvents);
        const stepFailed = toStepFailed(failure);
        await persist(stepFailed);
        yield emit(stepFailed);
        yield emit({ type: 'run_failed', retryable: failure.retryable });
      }
    }
  } finally {
    // 消费方提前放弃(如浏览器断开推送连接)时没有终态事件,按取消收束。
    const finalOutcome: AgentRunOutcome =
      outcome ?? {
        status: 'cancelled',
        messages: options.messages,
        document: validatedAgentDocument(agentEvents),
        interaction: null,
        failure: null
      };
    if (sessionId && options.persistOutcome) {
      try {
        await options.persistOutcome(sessionId, finalOutcome);
      } catch {
        // 检查点持久化是恢复能力,不改写已完成运行的业务结果。
      }
    }
    options.onOutcome?.(finalOutcome);
    options.auditSink?.({
      runId: options.runId,
      sessionId,
      outcome: finalOutcome.status,
      modelTurns,
      usage,
      toolCalls,
      failure: finalOutcome.failure
        ? { category: finalOutcome.failure.category, stage: finalOutcome.failure.stage }
        : null
    });
  }
}

function failureOutcome(
  failure: NormalizedAgentError,
  messages: AgentMessage[],
  agentEvents: AgentEvent[]
): AgentRunOutcome {
  return {
    status: 'failed',
    messages,
    document: validatedAgentDocument(agentEvents),
    interaction: null,
    failure
  };
}

function toStepFailed(failure: NormalizedAgentError): StepFailedEvent {
  return {
    type: 'step_failed',
    stage: failure.stage,
    code: failure.category,
    message: failure.message
  };
}

function toolErrorCode(result: {
  isError?: boolean;
  structuredContent?: unknown;
}): string | null {
  if (result.isError !== true) return null;
  const content = result.structuredContent;
  if (typeof content !== 'object' || content === null) return null;
  const error = (content as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}
