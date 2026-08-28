import { describe, expect, it } from 'vitest';
import type { McpClient } from '@metriccanvas/mcp';
import type { LifecycleContext } from '@metriccanvas/page-lifecycle';
import inlineReport from '../../../../packages/page/fixtures/contract-valid/inline-report.json';
import { askStateMessage, initialAskState } from '../../src/lib/ask/conversation';
import { createAgentRunner } from '../../src/lib/server/agent/runner';
import { createAgentRunRegistry } from '../../src/lib/server/agent/run-registry';
import {
  checkpointPageDocument,
  encodeSseFrame,
  handleAgentStreamRequest,
  type AgentStreamServices
} from '../../src/lib/server/agent/stream-endpoint';
import type {
  AgentRunner,
  ModelProvider,
  ModelResponse
} from '../../src/lib/server/agent/types';
import { createMemoryAnalysisSessionStore } from '../../src/lib/server/session/memory';
import type { AnalysisSessionStore } from '../../src/lib/server/session/store';
import { createScriptedModelProvider } from '../support/scripted-model-provider';

const IDENTITY: LifecycleContext = { actorId: 'developer-1', clientId: 'workbench', roles: [] };
const PAGE_DOCUMENT = { schemaVersion: '5.0', id: 'tokens-overview' };

interface SseFrame {
  id?: string;
  event?: string;
  data: unknown;
}

function parseBlock(block: string): SseFrame {
  const frame: SseFrame = { data: undefined };
  const dataLines: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('id: ')) frame.id = line.slice(4);
    else if (line.startsWith('event: ')) frame.event = line.slice(7);
    else if (line.startsWith('data: ')) dataLines.push(line.slice(6));
  }
  frame.data = JSON.parse(dataLines.join('\n'));
  return frame;
}

function parseFrames(text: string): SseFrame[] {
  return text
    .split('\n\n')
    .filter((block) => block.trim().length > 0)
    .map(parseBlock);
}

/** 逐帧消费:SSE 推送是拉动式的,取消与断连场景必须边读边触发。 */
async function* readFrames(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<SseFrame> {
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      if (block.trim().length > 0) yield parseBlock(block);
      boundary = buffer.indexOf('\n\n');
    }
  }
}

function frameLabel(frame: SseFrame): string {
  return frame.event ?? (frame.data as { type: string }).type;
}

function agentRequest(body: unknown): Request {
  return new Request('http://platform.local/api/agent/stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
}

function buildServices(options: {
  models: Record<string, ModelProvider>;
  mcp: McpClient;
  sessions?: AnalysisSessionStore;
}): AgentStreamServices {
  return {
    createRunner({ runId }) {
      const model = options.models[runId];
      if (!model) throw new Error(`测试未准备 runId ${runId} 的模型脚本`);
      return createAgentRunner({ model, mcp: options.mcp });
    },
    sessions: options.sessions ?? createMemoryAnalysisSessionStore(),
    agentRuns: createAgentRunRegistry(),
    runtimeOrigin: 'http://runtime.local',
    agentModel: { provider: 'scripted', model: 'component-selecting-scripted' }
  };
}

function validatingMcp(): McpClient {
  return {
    async listTools() {
      return [{ name: 'validate_page', inputSchema: { type: 'object', properties: {} } }];
    },
    async callTool() {
      return { structuredContent: { ok: true, valid: true, errors: [] }, isError: false };
    }
  };
}

function validateThenReply(): ModelResponse[] {
  return [
    {
      content: '',
      toolCalls: [{ id: 'v-1', name: 'validate_page', input: { document: PAGE_DOCUMENT } }]
    },
    { content: '看板已生成并通过校验。', toolCalls: [] }
  ];
}

describe('服务端推送端点:SSE 按步骤下发', () => {
  it('检查点文档区分本轮无新文档与结构化清空', () => {
    const draft = { id: 'ask-transient-old' };
    expect(checkpointPageDocument({ id: 'new' }, draft, 'ask-transient-new')).toEqual({
      id: 'new'
    });
    expect(checkpointPageDocument(null, draft, 'ask-transient-old')).toBe(draft);
    expect(checkpointPageDocument(null, draft, null)).toBeNull();
  });

  it('事件帧按序号下发,结束前追加 outcome 帧(消息、文档与模型描述)', async () => {
    const services = buildServices({
      models: { 'run-1': createScriptedModelProvider(validateThenReply()) },
      mcp: validatingMcp()
    });
    const response = await handleAgentStreamRequest({
      request: agentRequest({
        runId: 'run-1',
        messages: [{ role: 'user', content: '创建 Tokens 消耗看板' }]
      }),
      identity: IDENTITY,
      services,
      auditSink: () => {}
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(response.headers.get('cache-control')).toBe('no-store');

    const frames = parseFrames(await response.text());
    const eventFrames = frames.filter((frame) => frame.event !== 'outcome');
    expect(eventFrames.map((frame) => frame.id)).toEqual(['1', '2', '3', '4', '5']);
    expect(eventFrames.map((frame) => (frame.data as { type: string }).type)).toEqual([
      'run_started',
      'tool_call_started',
      'tool_call_finished',
      'assistant_replied',
      'run_completed'
    ]);
    expect(eventFrames[0].data).toEqual({
      type: 'run_started',
      runId: 'run-1',
      sessionId: null
    });

    const outcome = frames.at(-1);
    expect(outcome?.event).toBe('outcome');
    expect(outcome?.data).toMatchObject({
      status: 'completed',
      document: PAGE_DOCUMENT,
      runtimeOrigin: 'http://runtime.local',
      agentModel: { provider: 'scripted', model: 'component-selecting-scripted' }
    });
    const messages = (outcome?.data as { messages: Array<{ role: string }> }).messages;
    expect(messages.at(-1)).toMatchObject({ role: 'assistant' });
  });

  it('有会话的问数运行在 outcome 前保存最新检查点并回传版本', async () => {
    const sessions = createMemoryAnalysisSessionStore();
    const document = {
      ...structuredClone(inlineReport),
      id: 'ask-transient-checkpoint'
    } as Record<string, unknown>;
    const state = {
      ...initialAskState(),
      transientPageId: 'ask-transient-checkpoint'
    };
    const runner: AgentRunner = {
      async *run({ messages }) {
        yield {
          type: 'step',
          event: {
            type: 'domain_routed',
            question: '成交总额是多少?',
            routedDomains: ['运营分析'],
            overriddenByUser: false
          }
        };
        yield {
          type: 'completed',
          messages: [...messages, askStateMessage(state)],
          document
        };
      }
    };
    const services: AgentStreamServices = {
      createRunner: () => runner,
      sessions,
      agentRuns: createAgentRunRegistry(),
      runtimeOrigin: 'http://runtime.local',
      agentModel: { provider: 'scripted', model: 'ask-scripted' }
    };
    const response = await handleAgentStreamRequest({
      request: agentRequest({
        runId: 'run-checkpoint',
        sessionId: 'session-checkpoint',
        messages: [{ role: 'user', content: '成交总额是多少?' }],
        pinnedComponents: [{ dataSourceId: 'result', componentType: 'metricCard' }]
      }),
      identity: IDENTITY,
      services,
      auditSink: () => {}
    });
    const frames = parseFrames(await response.text());
    expect(frames.at(-1)?.data).toMatchObject({
      status: 'completed',
      checkpointVersion: 1,
      document: { id: 'ask-transient-checkpoint' }
    });

    const stored = await sessions.getSession({ sessionId: 'session-checkpoint' }, IDENTITY);
    if (!stored.ok) throw new Error(stored.error.message);
    expect(stored.session.checkpoint).toMatchObject({
      version: 1,
      basedOnEventSequence: 1,
      document: { id: 'ask-transient-checkpoint' },
      askState: { transientPageId: 'ask-transient-checkpoint' },
      pinnedComponents: [{ dataSourceId: 'result', componentType: 'metricCard' }]
    });
  });

  it('失败运行:step_failed 按会话落库,outcome 携带归一化错误供重试', async () => {
    const sessions = createMemoryAnalysisSessionStore();
    const failingModel: ModelProvider = {
      async complete() {
        throw new Error('unexpected explosion');
      }
    };
    const services = buildServices({
      models: { 'run-1': failingModel },
      mcp: validatingMcp(),
      sessions
    });

    const response = await handleAgentStreamRequest({
      request: agentRequest({
        runId: 'run-1',
        sessionId: 'session-9',
        messages: [{ role: 'user', content: '创建看板' }]
      }),
      identity: IDENTITY,
      services,
      auditSink: () => {}
    });
    const frames = parseFrames(await response.text());

    expect(frames.map((frame) => frame.event ?? (frame.data as { type: string }).type)).toEqual([
      'run_started',
      'step_failed',
      'run_failed',
      'outcome'
    ]);
    expect(frames.at(-1)?.data).toMatchObject({
      status: 'failed',
      error: { code: 'AGENT_INTERNAL_ERROR', stage: 'generation', retryable: false }
    });

    const stored = await sessions.getSession({ sessionId: 'session-9' }, IDENTITY);
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.session.actorId).toBe('developer-1');
    expect(stored.session.events.map((entry) => entry.event.type)).toEqual(['step_failed']);
  });

  it('取消进行中的运行:信号中止执行,下发 run_cancelled 并释放 runId', async () => {
    let toolStarted!: () => void;
    const started = new Promise<void>((resolve) => (toolStarted = resolve));
    const hangingMcp: McpClient = {
      async listTools() {
        return [{ name: 'validate_page', inputSchema: { type: 'object', properties: {} } }];
      },
      callTool: () =>
        new Promise(() => {
          toolStarted();
        })
    };
    const services = buildServices({
      models: {
        'run-1': createScriptedModelProvider([
          {
            content: '',
            toolCalls: [{ id: 'v-1', name: 'validate_page', input: { document: PAGE_DOCUMENT } }]
          }
        ])
      },
      mcp: hangingMcp
    });

    const response = await handleAgentStreamRequest({
      request: agentRequest({ runId: 'run-1', messages: [{ role: 'user', content: '创建看板' }] }),
      identity: IDENTITY,
      services,
      auditSink: () => {}
    });

    // 工具执行真正开始后触发取消:先证明他人取消无效,再由本人取消。
    void started.then(() => {
      expect(
        services.agentRuns.cancel('run-1', {
          actorId: 'developer-2',
          clientId: 'workbench',
          roles: []
        })
      ).toBe('not_found');
      expect(services.agentRuns.cancel('run-1', IDENTITY)).toBe('cancelled');
    });

    const frames: SseFrame[] = [];
    const reader = response.body!.getReader();
    for await (const frame of readFrames(reader)) frames.push(frame);

    expect(frames.map(frameLabel)).toEqual([
      'run_started',
      'tool_call_started',
      'run_cancelled',
      'outcome'
    ]);
    expect(frames.at(-1)?.data).toMatchObject({ status: 'cancelled' });

    // 运行结束后 runId 释放,同 runId 可重试。
    const again = services.agentRuns.register({ runId: 'run-1', actorId: IDENTITY.actorId });
    expect(again).not.toBeNull();
    again?.finish();
  });

  it('同 runId 并发重放被拒绝(409);运行结束后可复用', async () => {
    let toolStarted!: () => void;
    const started = new Promise<void>((resolve) => (toolStarted = resolve));
    const hangingMcp: McpClient = {
      async listTools() {
        return [{ name: 'validate_page', inputSchema: { type: 'object', properties: {} } }];
      },
      callTool: () =>
        new Promise(() => {
          toolStarted();
        })
    };
    const services = buildServices({
      models: {
        'run-1': createScriptedModelProvider([
          {
            content: '',
            toolCalls: [{ id: 'v-1', name: 'validate_page', input: { document: PAGE_DOCUMENT } }]
          }
        ])
      },
      mcp: hangingMcp
    });
    const first = await handleAgentStreamRequest({
      request: agentRequest({ runId: 'run-1', messages: [{ role: 'user', content: '创建看板' }] }),
      identity: IDENTITY,
      services,
      auditSink: () => {}
    });

    const duplicate = await handleAgentStreamRequest({
      request: agentRequest({ runId: 'run-1', messages: [{ role: 'user', content: '再来一次' }] }),
      identity: IDENTITY,
      services,
      auditSink: () => {}
    });
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toMatchObject({
      error: { code: 'AGENT_RUN_ALREADY_ACTIVE' }
    });

    // 取消后消费到流结束,runId 释放,可复用。
    expect(services.agentRuns.cancel('run-1', IDENTITY)).toBe('cancelled');
    const frames = parseFrames(await first.text());
    expect(frames.at(-1)?.data).toMatchObject({ status: 'cancelled' });
    const again = services.agentRuns.register({ runId: 'run-1', actorId: IDENTITY.actorId });
    expect(again).not.toBeNull();
    again?.finish();
    void started;
  });

  it('消费方断开连接即中止运行并释放 runId', async () => {
    let toolStarted!: () => void;
    const started = new Promise<void>((resolve) => (toolStarted = resolve));
    const hangingMcp: McpClient = {
      async listTools() {
        return [{ name: 'validate_page', inputSchema: { type: 'object', properties: {} } }];
      },
      callTool: () =>
        new Promise(() => {
          toolStarted();
        })
    };
    const services = buildServices({
      models: {
        'run-1': createScriptedModelProvider([
          {
            content: '',
            toolCalls: [{ id: 'v-1', name: 'validate_page', input: { document: PAGE_DOCUMENT } }]
          }
        ])
      },
      mcp: hangingMcp
    });
    const response = await handleAgentStreamRequest({
      request: agentRequest({ runId: 'run-1', messages: [{ role: 'user', content: '创建看板' }] }),
      identity: IDENTITY,
      services,
      auditSink: () => {}
    });

    // 消费到工具进行中即断开:端点先中止运行信号再收尾,不等悬挂的工具。
    const reader = response.body!.getReader();
    for await (const frame of readFrames(reader)) {
      if (frameLabel(frame) === 'tool_call_started') break;
    }
    await started;
    await reader.cancel();

    const again = services.agentRuns.register({ runId: 'run-1', actorId: IDENTITY.actorId });
    expect(again).not.toBeNull();
    again?.finish();
  });

  it.each([
    { name: '非法 JSON', body: '{not-json' },
    { name: '缺 runId', body: { messages: [{ role: 'user', content: 'x' }] } },
    { name: '非法 sessionId', body: { runId: 'run-1', sessionId: 'bad session!', messages: [{ role: 'user', content: 'x' }] } },
    { name: '空 messages', body: { runId: 'run-1', messages: [] } }
  ])('$name 返回 400', async ({ body }) => {
    const services = buildServices({
      models: { 'run-1': createScriptedModelProvider([]) },
      mcp: validatingMcp()
    });
    const response = await handleAgentStreamRequest({
      request: agentRequest(body),
      identity: IDENTITY,
      services,
      auditSink: () => {}
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'INVALID_REQUEST' } });
  });
});

describe('SSE 帧编码', () => {
  it('按 id → event → data 编码,跨行 data 拆成多个 data 行,空行结束一帧', () => {
    expect(encodeSseFrame({ id: '3', data: '{"a":1}' })).toBe('id: 3\ndata: {"a":1}\n\n');
    expect(encodeSseFrame({ event: 'outcome', data: 'line1\nline2' })).toBe(
      'event: outcome\ndata: line1\ndata: line2\n\n'
    );
  });
});
