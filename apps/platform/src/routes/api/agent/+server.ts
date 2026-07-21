import { json } from '@sveltejs/kit';
import type { AgentEvent, AgentMessage } from '@metriccanvas/agent-runner';
import { PAGE_BUILDING_PROMPT } from '@metriccanvas/mcp';
import { getPlatformServices } from '$lib/server/services.server';
import type { RequestHandler } from './$types';

const WORKBENCH_PROMPT = `${PAGE_BUILDING_PROMPT}

当前客户端是页面搭建工作台。生成页面文档后先调用 validate_page；校验通过时工作台会自动暂停并展示结构化页面 id 确认，不要用普通文本索取该确认。收到工作台确认消息后才调用 save_page。若会话中已有 get_page 回执，表示正在编辑已存在看板页面：使用其 revision.revisionId 作为 save_page.baseRevisionId，先校验编辑后的页面文档，再保存新的页面修订。若 save_page 返回 REVISION_CONFLICT，绝不能自动重试或改用其他基线；明确告知用户在工作台重新加载当前页面修订。不要在回复中回显发布确认 URL 或 token，工作台会提供安全按钮。`;

export const POST: RequestHandler = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: { code: 'INVALID_REQUEST', message: '请求体不是合法 JSON' } }, { status: 400 });
  }
  if (!isAgentRequest(body)) {
    return json(
      { error: { code: 'INVALID_REQUEST', message: 'messages 不是合法 Agent 会话' } },
      { status: 400 }
    );
  }

  let messages: AgentMessage[] = body.messages.some((message) => message.role === 'system')
    ? body.messages
    : [{ role: 'system', content: WORKBENCH_PROMPT }, ...body.messages];
  const { createRunner } = await getPlatformServices();
  const runner = createRunner({
    confirmedPageIds: (body.confirmations ?? []).map((confirmation) => confirmation.pageId),
    runId: body.runId
  });
  const events: AgentEvent[] = [];

  try {
    for await (const event of runner.run({ messages, signal: request.signal })) {
      events.push(event);
    }
  } catch (cause) {
    return json(
      {
        error: {
          code: 'AGENT_RUN_FAILED',
          message: cause instanceof Error ? cause.message : String(cause)
        }
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
      { error: { code: 'AGENT_INCOMPLETE', message: 'Agent Runner 未返回完成状态' } },
      { status: 502 }
    );
  }
  if (terminal.type === 'interaction_required') {
    return json(
      {
        messages: terminal.messages,
        events: events.filter(
          (event) =>
            event.type !== 'completed' && event.type !== 'interaction_required'
        ),
        interaction: terminal.interaction
      },
      { headers: { 'cache-control': 'no-store' } }
    );
  }
  return json(
    {
      messages: terminal.messages,
      events: events.filter((event) => event.type !== 'completed')
    },
    { headers: { 'cache-control': 'no-store' } }
  );
};

interface AgentRequest {
  runId: string;
  messages: AgentMessage[];
  confirmations?: Array<{ kind: 'page_id'; pageId: string }>;
}

function isAgentRequest(value: unknown): value is AgentRequest {
  if (typeof value !== 'object' || value === null || !('messages' in value)) return false;
  const request = value as {
    runId?: unknown;
    messages?: unknown;
    confirmations?: unknown;
  };
  if (
    typeof request.runId !== 'string' ||
    !/^[a-zA-Z0-9-]{1,100}$/u.test(request.runId)
  ) {
    return false;
  }
  const messages = request.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 200) return false;
  if (
    request.confirmations !== undefined &&
    (!Array.isArray(request.confirmations) ||
      request.confirmations.length > 20 ||
      !request.confirmations.every(
        (confirmation) =>
          typeof confirmation === 'object' &&
          confirmation !== null &&
          (confirmation as { kind?: unknown }).kind === 'page_id' &&
          typeof (confirmation as { pageId?: unknown }).pageId === 'string' &&
          (confirmation as { pageId: string }).pageId.length <= 100
      ))
  ) {
    return false;
  }
  return messages.every((message) => {
    if (
      typeof message !== 'object' ||
      message === null ||
      !('role' in message) ||
      !('content' in message) ||
      typeof message.content !== 'string'
    ) {
      return false;
    }
    if (message.role === 'system' || message.role === 'user') return true;
    if (message.role === 'assistant') return Array.isArray((message as { toolCalls?: unknown }).toolCalls);
    return (
      message.role === 'tool' &&
      typeof (message as { toolCallId?: unknown }).toolCallId === 'string' &&
      typeof (message as { name?: unknown }).name === 'string' &&
      typeof (message as { isError?: unknown }).isError === 'boolean'
    );
  });
}
