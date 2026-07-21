import { json } from '@sveltejs/kit';
import type { AgentEvent, AgentMessage } from '@metriccanvas/agent-runner';
import { PAGE_BUILDING_PROMPT } from '@metriccanvas/mcp';
import { getPlatformServices } from '$lib/server/services.server';
import type { RequestHandler } from './$types';

const WORKBENCH_PROMPT = `METRICCANVAS_AUTHORING_MODE

${PAGE_BUILDING_PROMPT}

当前客户端是单页页面搭建工作台。你只负责检索、生成、修改和调用 validate_page 校验未保存工作副本；不得保存页面修订、创建精确预览或申请发布租约，这些动作只能由用户点击明确的界面按钮触发。若提供了当前未保存工作副本，必须以它为基线修改，保留用户未要求改变的内容。若提供了组件定位，只把它视为默认修改目标，不得未经用户描述自动修改。生成或修改后必须调用 validate_page；校验通过后停止工具调用并简要说明调整结果。新建看板页面首次校验通过时，工作台会展示结构化页面 id 确认，不要用普通文本重复索取确认。`;

const AUTHORING_CONTEXT_PREFIX = 'METRICCANVAS_AUTHORING_CONTEXT:';

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

  const conversation = body.messages.filter((message) => message.role !== 'system');
  let messages: AgentMessage[] = [
    { role: 'system', content: WORKBENCH_PROMPT },
    ...(body.draft
      ? [
          {
            role: 'system' as const,
            content:
              AUTHORING_CONTEXT_PREFIX +
              JSON.stringify({ document: body.draft, target: body.target ?? null })
          }
        ]
      : []),
    ...conversation
  ];
  const { createRunner, runtimeOrigin } = await getPlatformServices();
  const runner = createRunner({
    confirmedPageIds: (body.confirmations ?? []).map((confirmation) => confirmation.pageId),
    runId: body.runId,
    mode: 'authoring'
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
    const document = validatedDocument(events);
    return json(
      {
        messages: clientMessages(terminal.messages),
        events: events.filter(
          (event) =>
            event.type !== 'completed' && event.type !== 'interaction_required'
        ),
        interaction: terminal.interaction,
        ...(document ? { document } : {}),
        runtimeOrigin
      },
      { headers: { 'cache-control': 'no-store' } }
    );
  }
  return json(
    {
      messages: clientMessages(terminal.messages),
      events: events.filter((event) => event.type !== 'completed'),
      ...(validatedDocument(events) ? { document: validatedDocument(events) } : {}),
      runtimeOrigin
    },
    { headers: { 'cache-control': 'no-store' } }
  );
};

interface AgentRequest {
  runId: string;
  messages: AgentMessage[];
  confirmations?: Array<{ kind: 'page_id'; pageId: string }>;
  draft?: Record<string, unknown>;
  target?: { sectionId: string; componentId: string };
}

function isAgentRequest(value: unknown): value is AgentRequest {
  if (typeof value !== 'object' || value === null || !('messages' in value)) return false;
  const request = value as {
    runId?: unknown;
    messages?: unknown;
    confirmations?: unknown;
    draft?: unknown;
    target?: unknown;
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
  if (request.draft !== undefined && !isRecord(request.draft)) return false;
  if (
    request.target !== undefined &&
    (!isRecord(request.target) ||
      typeof request.target.sectionId !== 'string' ||
      request.target.sectionId.length === 0 ||
      typeof request.target.componentId !== 'string' ||
      request.target.componentId.length === 0)
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

function validatedDocument(events: AgentEvent[]): Record<string, unknown> | null {
  for (const event of [...events].reverse()) {
    if (
      event.type === 'tool_started' &&
      event.call.name === 'validate_page' &&
      isRecord(event.call.input) &&
      isRecord(event.call.input.document)
    ) {
      return event.call.input.document;
    }
  }
  return null;
}

function clientMessages(messages: AgentMessage[]): AgentMessage[] {
  return messages.filter(
    (message) =>
      message.role !== 'system' || !message.content.startsWith(AUTHORING_CONTEXT_PREFIX)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
