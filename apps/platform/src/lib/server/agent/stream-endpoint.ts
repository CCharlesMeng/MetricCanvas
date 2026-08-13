import type { LifecycleContext } from '@metriccanvas/page-lifecycle';
import type { AskScopeConfirmation } from '../ask/orchestrator';
import type { AnalysisSessionStore } from '../session/store';
import { anySignal } from './abort';
import type { AgentRunRegistry } from './run-registry';
import {
  streamAgentRun,
  type AgentRunAudit,
  type AgentRunOutcome,
  type SequencedAgentRunStreamEvent
} from './stream';
import type { AgentRunner } from './types';
import {
  clientMessages,
  confirmedPageIdsOf,
  isWorkbenchAgentRequest,
  scopeConfirmationsOf,
  userDomainsOf,
  workbenchMessages
} from './workbench-request';

/**
 * 服务端推送端点(POST /api/agent/stream)的实现。SSE 协议:
 *
 * - 每条流事件一帧:`id` 为通道分配的单调序号,`data` 为一条
 *   AgentRunStreamEvent(契约见 ../session/step-event.ts),按 `data.type`
 *   收窄消费;工具调用的名称与进行中/成功/失败状态由
 *   tool_call_started / tool_call_finished 承载。
 * - 结束前追加一帧 `event: outcome`:运行终态、结束时的会话消息、
 *   (如有)已通过校验的页面文档、人工交互与归一化失败分类。重试失败
 *   步骤 = 以 outcome.messages 为基线携带新的 runId 再次 POST;
 *   取消 = POST /api/agent/runs/{runId}/cancel。
 *
 * 消费方式(#65 工作台):fetch POST 后读取 response.body,按空行分帧
 * 解析 `id:` / `event:` / `data:` 字段;EventSource 不支持 POST,不适用。
 */

export interface AgentStreamServices {
  createRunner(input: {
    confirmedPageIds: string[];
    runId: string;
    mode?: 'authoring' | 'lifecycle' | 'ask';
    identity: LifecycleContext;
    /** 问数编排(mode=ask)的人工确认与钉住状态;其余模式忽略。 */
    scopeConfirmations?: AskScopeConfirmation[];
    userDomains?: string[];
    pinnedComponents?: Array<{ dataSourceId: string; componentType: string }>;
  }): AgentRunner;
  sessions: Pick<AnalysisSessionStore, 'appendEvent'>;
  agentRuns: AgentRunRegistry;
  runtimeOrigin: string;
  agentModel: { provider: string; model: string };
}

export interface AgentStreamRequestInput {
  request: Request;
  identity: LifecycleContext;
  services: AgentStreamServices;
  /** 运行审计日志出口;缺省写结构化 console 日志。 */
  auditSink?: (audit: AgentRunAudit) => void;
  clock?: () => number;
}

export async function handleAgentStreamRequest(
  input: AgentStreamRequestInput
): Promise<Response> {
  const { request, identity, services } = input;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'INVALID_REQUEST', '请求体不是合法 JSON');
  }
  if (!isWorkbenchAgentRequest(body)) {
    return errorResponse(400, 'INVALID_REQUEST', 'messages 不是合法 Agent 会话');
  }

  const registration = services.agentRuns.register({
    runId: body.runId,
    actorId: identity.actorId
  });
  if (!registration) {
    return errorResponse(
      409,
      'AGENT_RUN_ALREADY_ACTIVE',
      `运行 ${body.runId} 正在进行中;取消它或换一个 runId`
    );
  }

  const sessionId = body.sessionId ?? null;
  const userDomains = userDomainsOf(body);
  // 工作台推送端点走问数编排(#66):步骤事件由编排真实生产;
  // 自由工具循环的搭建模式保留在非流式端点(../+server.ts)。
  const runner = services.createRunner({
    confirmedPageIds: confirmedPageIdsOf(body),
    runId: body.runId,
    mode: 'ask',
    identity,
    scopeConfirmations: scopeConfirmationsOf(body),
    ...(userDomains === undefined ? {} : { userDomains }),
    ...(body.pinnedComponents === undefined
      ? {}
      : { pinnedComponents: body.pinnedComponents })
  });

  let outcome: AgentRunOutcome | null = null;
  // 消费方放弃流(ReadableStream cancel)时先中止运行再收尾:否则收尾会
  // 等一个已无人消费、也无人中止的执行。请求断开与取消端点共用同一语义。
  const disconnect = new AbortController();
  const events = streamAgentRun({
    runner,
    runId: body.runId,
    messages: workbenchMessages(body),
    signal: anySignal([request.signal, registration.signal, disconnect.signal]),
    sessionId,
    persistStepEvent: async (targetSessionId, event) => {
      await services.sessions.appendEvent(
        { sessionId: targetSessionId, event },
        identity
      );
    },
    onOutcome: (finalOutcome) => {
      outcome = finalOutcome;
    },
    auditSink:
      input.auditSink ??
      ((audit) => console.info('[agent-run-audit]', JSON.stringify(audit))),
    ...(input.clock ? { clock: input.clock } : {})
  });

  const encoder = new TextEncoder();
  const iterator = events[Symbol.asyncIterator]();
  const stream = new ReadableStream<Uint8Array>({
    pull: async (controller) => {
      let next: IteratorResult<SequencedAgentRunStreamEvent, unknown>;
      try {
        next = await iterator.next();
      } catch (cause) {
        registration.finish();
        controller.error(cause);
        return;
      }
      if (!next.done) {
        controller.enqueue(
          encoder.encode(
            encodeSseFrame({
              id: String(next.value.sequence),
              data: JSON.stringify(next.value.event)
            })
          )
        );
        return;
      }
      registration.finish();
      if (outcome) {
        controller.enqueue(
          encoder.encode(
            encodeSseFrame({
              event: 'outcome',
              data: JSON.stringify(outcomePayload(outcome, services))
            })
          )
        );
      }
      controller.close();
    },
    cancel: async () => {
      disconnect.abort(new DOMException('推送连接已断开', 'AbortError'));
      try {
        await iterator.return?.(undefined);
      } finally {
        registration.finish();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive'
    }
  });
}

/** outcome 帧载荷:与非流式端点的响应同构,供重试、续跑与交互继续。 */
function outcomePayload(
  outcome: AgentRunOutcome,
  services: Pick<AgentStreamServices, 'runtimeOrigin' | 'agentModel'>
): Record<string, unknown> {
  return {
    status: outcome.status,
    messages: clientMessages(outcome.messages),
    ...(outcome.document ? { document: outcome.document } : {}),
    ...(outcome.interaction ? { interaction: outcome.interaction } : {}),
    ...(outcome.failure
      ? {
          error: {
            code: outcome.failure.category,
            message: outcome.failure.message,
            stage: outcome.failure.stage,
            retryable: outcome.failure.retryable
          }
        }
      : {}),
    runtimeOrigin: services.runtimeOrigin,
    agentModel: services.agentModel
  };
}

/** SSE 帧编码:字段顺序 id → event → data,空行结束一帧。 */
export function encodeSseFrame(frame: {
  id?: string;
  event?: string;
  data: string;
}): string {
  const lines: string[] = [];
  if (frame.id !== undefined) lines.push(`id: ${frame.id}`);
  if (frame.event !== undefined) lines.push(`event: ${frame.event}`);
  for (const dataLine of frame.data.split('\n')) {
    lines.push(`data: ${dataLine}`);
  }
  return `${lines.join('\n')}\n\n`;
}

function errorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}
