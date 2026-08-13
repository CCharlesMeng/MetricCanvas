import { json } from '@sveltejs/kit';
import type { AgentEvent, AgentMessage } from '$lib/server/agent/types';
import { normalizeAgentRunError } from '$lib/server/agent/errors';
import {
  clientMessages,
  confirmedPageIdsOf,
  isWorkbenchAgentRequest,
  workbenchMessages
} from '$lib/server/agent/workbench-request';
import { validatedAgentDocument } from '$lib/server/agent-events.server';
import { getPlatformServices } from '$lib/server/services.server';
import type { RequestHandler } from './$types';

/**
 * 既有非流式端点:一次运行收齐全部事件后整体返回,供确定性测试与
 * 不消费推送的客户端使用。分步呈现走 ./stream 的服务端推送端点,
 * 两个端点共用同一份请求契约(agent/workbench-request.ts)。
 */

export const GET: RequestHandler = async () => {
  const { agentModel } = await getPlatformServices();
  return json(
    { agentModel },
    { headers: { 'cache-control': 'no-store' } }
  );
};

export const POST: RequestHandler = async ({ request, locals }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: { code: 'INVALID_REQUEST', message: '请求体不是合法 JSON' } }, { status: 400 });
  }
  if (!isWorkbenchAgentRequest(body)) {
    return json(
      { error: { code: 'INVALID_REQUEST', message: 'messages 不是合法 Agent 会话' } },
      { status: 400 }
    );
  }

  const messages: AgentMessage[] = workbenchMessages(body);
  const { createRunner, runtimeOrigin, agentModel } = await getPlatformServices();
  const runner = createRunner({
    confirmedPageIds: confirmedPageIdsOf(body),
    runId: body.runId,
    mode: 'authoring',
    identity: locals.identity
  });
  const events: AgentEvent[] = [];

  try {
    for await (const event of runner.run({ messages, signal: request.signal })) {
      events.push(event);
    }
  } catch (cause) {
    const failure = normalizeAgentRunError(cause);
    return json(
      {
        error: {
          code: failure.category,
          message: failure.message,
          stage: failure.stage,
          retryable: failure.retryable
        },
        agentModel
      },
      { status: 502, headers: { 'cache-control': 'no-store' } }
    );
  }

  const terminal = [...events]
    .reverse()
    .find(
      (event) => event.type === 'completed' || event.type === 'interaction_required'
    );
  if (!terminal) {
    return json(
      {
        error: { code: 'AGENT_INCOMPLETE', message: 'Agent Runner 未返回完成状态' },
        agentModel
      },
      { status: 502 }
    );
  }
  if (terminal.type === 'interaction_required') {
    const document = validatedAgentDocument(events);
    return json(
      {
        messages: clientMessages(terminal.messages),
        events: events.filter(
          (event) =>
            event.type !== 'completed' &&
            event.type !== 'interaction_required' &&
            event.type !== 'turn_completed'
        ),
        interaction: terminal.interaction,
        ...(document ? { document } : {}),
        runtimeOrigin,
        agentModel
      },
      { headers: { 'cache-control': 'no-store' } }
    );
  }
  const document = validatedAgentDocument(events);
  return json(
    {
      messages: clientMessages(terminal.messages),
      events: events.filter(
        (event) => event.type !== 'completed' && event.type !== 'turn_completed'
      ),
      ...(document ? { document } : {}),
      runtimeOrigin,
      agentModel
    },
    { headers: { 'cache-control': 'no-store' } }
  );
};
