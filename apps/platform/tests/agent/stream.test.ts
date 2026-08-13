import { describe, expect, it } from 'vitest';
import type { McpClient } from '@metriccanvas/mcp';
import type { LifecycleContext } from '@metriccanvas/page-lifecycle';
import { DeepSeekProviderError } from '../../src/lib/server/agent/deepseek.server';
import { createAgentRunner } from '../../src/lib/server/agent/runner';
import {
  streamAgentRun,
  type AgentRunAudit,
  type AgentRunOutcome,
  type AgentRunStreamOptions,
  type SequencedAgentRunStreamEvent
} from '../../src/lib/server/agent/stream';
import type {
  AgentMessage,
  ModelProvider,
  ModelResponse
} from '../../src/lib/server/agent/types';
import { createMemoryAnalysisSessionStore } from '../../src/lib/server/session/memory';
import { createScriptedModelProvider } from '../support/scripted-model-provider';

const IDENTITY: LifecycleContext = { actorId: 'developer-1', clientId: 'workbench', roles: [] };
const ASK: AgentMessage[] = [{ role: 'user', content: '创建华东区 Tokens 消耗看板' }];

const PAGE_DOCUMENT = { schemaVersion: '5.0', id: 'tokens-overview' };

function successMcp(results: Array<{ isError?: boolean; structuredContent?: unknown }> = []) {
  const queue = [...results];
  const calls: string[] = [];
  const mcp: McpClient = {
    async listTools() {
      return [
        { name: 'validate_page', inputSchema: { type: 'object', properties: {} } },
        { name: 'search_data_context', inputSchema: { type: 'object', properties: {} } }
      ];
    },
    async callTool({ name }) {
      calls.push(name);
      return queue.shift() ?? { structuredContent: { ok: true }, isError: false };
    }
  };
  return { mcp, calls };
}

/** 先回放脚本,脚本耗尽后按注入的失败停机——重试场景的确定性模型替身。 */
function scriptedThenFailing(responses: ModelResponse[], failure: unknown): ModelProvider {
  const queue = structuredClone(responses);
  return {
    async complete() {
      const next = queue.shift();
      if (next) return next;
      throw failure;
    }
  };
}

async function collect(
  options: AgentRunStreamOptions
): Promise<{ events: SequencedAgentRunStreamEvent[]; outcome: AgentRunOutcome; audit: AgentRunAudit }> {
  let outcome: AgentRunOutcome | null = null;
  let audit: AgentRunAudit | null = null;
  const events: SequencedAgentRunStreamEvent[] = [];
  for await (const event of streamAgentRun({
    ...options,
    onOutcome: (value) => (outcome = value),
    auditSink: (value) => (audit = value)
  })) {
    events.push(event);
  }
  if (!outcome || !audit) throw new Error('推送通道未产出运行结果或审计');
  return { events, outcome, audit };
}

describe('推送通道:按步骤下发可顺序消费的事件', () => {
  it('工具调用运行:事件按序编号,工具名称与成功状态可见,校验过的文档进入结果', async () => {
    const { mcp } = successMcp([
      { structuredContent: { ok: true, valid: true, errors: [] }, isError: false }
    ]);
    const model = createScriptedModelProvider([
      {
        content: '',
        toolCalls: [{ id: 'call-validate', name: 'validate_page', input: { document: PAGE_DOCUMENT } }]
      },
      { content: '看板已生成并通过校验。', toolCalls: [] }
    ]);
    const runner = createAgentRunner({ model, mcp });

    const { events, outcome } = await collect({ runner, runId: 'run-1', messages: ASK });

    expect(events.map((entry) => entry.sequence)).toEqual([1, 2, 3, 4, 5]);
    expect(events.map((entry) => entry.event.type)).toEqual([
      'run_started',
      'tool_call_started',
      'tool_call_finished',
      'assistant_replied',
      'run_completed'
    ]);
    expect(events[1].event).toEqual({
      type: 'tool_call_started',
      toolCallId: 'call-validate',
      toolName: 'validate_page'
    });
    expect(events[2].event).toEqual({
      type: 'tool_call_finished',
      toolCallId: 'call-validate',
      toolName: 'validate_page',
      status: 'succeeded',
      errorCode: null
    });
    expect(outcome.status).toBe('completed');
    expect(outcome.document).toEqual(PAGE_DOCUMENT);
  });

  it('澄清:助手以文本提问收尾,续跑以上一次结果消息为基线', async () => {
    const { mcp } = successMcp();
    const clarify = createAgentRunner({
      model: createScriptedModelProvider([
        { content: '请确认统计的时间范围:本月还是最近 90 天?', toolCalls: [] }
      ]),
      mcp
    });
    const first = await collect({ runner: clarify, runId: 'run-1', messages: ASK });
    expect(first.events.map((entry) => entry.event.type)).toEqual([
      'run_started',
      'assistant_replied',
      'run_completed'
    ]);
    expect(first.outcome.status).toBe('completed');

    const resume = createAgentRunner({
      model: createScriptedModelProvider([{ content: '已按本月生成看板。', toolCalls: [] }]),
      mcp
    });
    const second = await collect({
      runner: resume,
      runId: 'run-2',
      messages: [...first.outcome.messages, { role: 'user', content: '本月' }]
    });
    expect(second.outcome.status).toBe('completed');
    expect(second.outcome.messages.at(-1)).toEqual({
      role: 'assistant',
      content: '已按本月生成看板。',
      toolCalls: []
    });
  });

  it('自动修复:工具失败带稳定错误码回流,模型修正后重试成功', async () => {
    const { mcp, calls } = successMcp([
      {
        isError: true,
        structuredContent: {
          ok: false,
          error: { code: 'PAGE_ID_PLACEHOLDER', message: '页面 id 必须是真实候选值' }
        }
      },
      { structuredContent: { ok: true, valid: true, errors: [] }, isError: false }
    ]);
    const model = createScriptedModelProvider([
      {
        content: '',
        toolCalls: [{ id: 'v-1', name: 'validate_page', input: { document: { id: '__pending__' } } }]
      },
      {
        content: '',
        toolCalls: [{ id: 'v-2', name: 'validate_page', input: { document: PAGE_DOCUMENT } }]
      },
      { content: '已修正页面 id 并通过校验。', toolCalls: [] }
    ]);
    const runner = createAgentRunner({ model, mcp });

    const { events, outcome } = await collect({ runner, runId: 'run-1', messages: ASK });

    const finishes = events.flatMap((entry) =>
      entry.event.type === 'tool_call_finished' ? [entry.event] : []
    );
    expect(finishes).toEqual([
      {
        type: 'tool_call_finished',
        toolCallId: 'v-1',
        toolName: 'validate_page',
        status: 'failed',
        errorCode: 'PAGE_ID_PLACEHOLDER'
      },
      {
        type: 'tool_call_finished',
        toolCallId: 'v-2',
        toolName: 'validate_page',
        status: 'succeeded',
        errorCode: null
      }
    ]);
    expect(calls).toEqual(['validate_page', 'validate_page']);
    expect(outcome.status).toBe('completed');
  });
});

describe('推送通道:失败归一化落库与取消', () => {
  it('模型限流归一化为稳定分类:step_failed 落库,run_failed 标记可重试', async () => {
    const sessions = createMemoryAnalysisSessionStore();
    const { mcp } = successMcp();
    const runner = createAgentRunner({
      model: scriptedThenFailing([], new DeepSeekProviderError('HTTP_ERROR', 'x', { status: 429 })),
      mcp
    });

    const { events, outcome } = await collect({
      runner,
      runId: 'run-1',
      messages: ASK,
      sessionId: 'session-1',
      persistStepEvent: async (sessionId, event) => {
        const result = await sessions.appendEvent({ sessionId, event }, IDENTITY);
        expect(result.ok).toBe(true);
      }
    });

    expect(events.map((entry) => entry.event.type)).toEqual([
      'run_started',
      'step_failed',
      'run_failed'
    ]);
    expect(events[1].event).toEqual({
      type: 'step_failed',
      stage: 'generation',
      code: 'MODEL_RATE_LIMITED',
      message: '模型提供方限流(HTTP 429)'
    });
    expect(events[2].event).toEqual({ type: 'run_failed', retryable: true });
    expect(outcome.status).toBe('failed');
    expect(outcome.failure?.category).toBe('MODEL_RATE_LIMITED');

    const stored = await sessions.getSession({ sessionId: 'session-1' }, IDENTITY);
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.session.events.map((entry) => entry.event.type)).toEqual(['step_failed']);
  });

  it('清空会话只清空当前视图:已落库事件保留,后续运行在同一会话追加', async () => {
    const sessions = createMemoryAnalysisSessionStore();
    const persistStepEvent: AgentRunStreamOptions['persistStepEvent'] = async (
      sessionId,
      event
    ) => {
      await sessions.appendEvent({ sessionId, event }, IDENTITY);
    };
    const failure = new DeepSeekProviderError('HTTP_ERROR', 'x', { status: 429 });
    const { mcp } = successMcp();

    const first = await collect({
      runner: createAgentRunner({ model: scriptedThenFailing([], failure), mcp }),
      runId: 'run-1',
      messages: ASK,
      sessionId: 'session-1',
      persistStepEvent
    });
    // 用户清空当前视图:纯客户端行为,丢弃本地事件即可,服务端无删除入口。
    first.events.length = 0;

    await collect({
      runner: createAgentRunner({ model: scriptedThenFailing([], failure), mcp }),
      runId: 'run-2',
      messages: ASK,
      sessionId: 'session-1',
      persistStepEvent
    });

    const stored = await sessions.getSession({ sessionId: 'session-1' }, IDENTITY);
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.session.events.map((entry) => entry.sequence)).toEqual([1, 2]);
    expect(stored.session.events.map((entry) => entry.event.type)).toEqual([
      'step_failed',
      'step_failed'
    ]);
  });

  it('取消:下发 run_cancelled,不落 step_failed,结果快照可用于续跑', async () => {
    const sessions = createMemoryAnalysisSessionStore();
    let toolStarted!: () => void;
    const started = new Promise<void>((resolve) => (toolStarted = resolve));
    const mcp: McpClient = {
      async listTools() {
        return [{ name: 'validate_page', inputSchema: { type: 'object', properties: {} } }];
      },
      callTool: () =>
        new Promise(() => {
          toolStarted();
        })
    };
    const runner = createAgentRunner({
      model: createScriptedModelProvider([
        {
          content: '',
          toolCalls: [{ id: 'v-1', name: 'validate_page', input: { document: PAGE_DOCUMENT } }]
        }
      ]),
      mcp
    });
    const controller = new AbortController();

    const consuming = collect({
      runner,
      runId: 'run-1',
      messages: ASK,
      signal: controller.signal,
      sessionId: 'session-1',
      persistStepEvent: async (sessionId, event) => {
        await sessions.appendEvent({ sessionId, event }, IDENTITY);
      }
    });
    await started;
    controller.abort();
    const { events, outcome, audit } = await consuming;

    expect(events.map((entry) => entry.event.type)).toEqual([
      'run_started',
      'tool_call_started',
      'run_cancelled'
    ]);
    expect(outcome.status).toBe('cancelled');
    expect(outcome.messages.at(-1)).toMatchObject({ role: 'assistant' });
    expect(audit.outcome).toBe('cancelled');
    const stored = await sessions.getSession({ sessionId: 'session-1' }, IDENTITY);
    expect(stored.ok).toBe(false);
  });

  it('重试失败步骤:以失败快照为基线续跑,已完成的工具调用不重做', async () => {
    const { mcp, calls } = successMcp([
      { structuredContent: { ok: true, matches: [{ kind: 'metric', name: 'Tokens消耗量' }] } }
    ]);
    const failing = createAgentRunner({
      model: scriptedThenFailing(
        [
          {
            content: '',
            toolCalls: [
              { id: 's-1', name: 'search_data_context', input: { query: 'Tokens', limit: 10 } }
            ]
          }
        ],
        new DeepSeekProviderError('HTTP_ERROR', 'x', { status: 429 })
      ),
      mcp
    });

    const first = await collect({ runner: failing, runId: 'run-1', messages: ASK });
    expect(first.outcome.status).toBe('failed');
    // 失败快照停在已完成的工具结果上:检索这一步已经完成。
    expect(first.outcome.messages.at(-1)).toMatchObject({
      role: 'tool',
      name: 'search_data_context'
    });

    const retry = await collect({
      runner: createAgentRunner({
        model: createScriptedModelProvider([
          { content: '已基于检索结果生成看板。', toolCalls: [] }
        ]),
        mcp
      }),
      runId: 'run-1-retry',
      messages: first.outcome.messages
    });

    expect(retry.outcome.status).toBe('completed');
    expect(calls).toEqual(['search_data_context']);
  });
});

describe('推送通道:运行审计只记录结构化内容', () => {
  it('审计含用量、工具审计与错误分类;不含 Prompt、回复正文与凭据', async () => {
    const SECRET = 'sk-test-secret-value';
    const { mcp } = successMcp([
      { structuredContent: { ok: true, valid: true, errors: [] }, isError: false }
    ]);
    const runner = createAgentRunner({
      model: scriptedThenFailing(
        [
          {
            content: '这是助手的回复正文,不得进入日志。',
            toolCalls: [{ id: 'v-1', name: 'validate_page', input: { document: PAGE_DOCUMENT } }],
            usage: { promptTokens: 120, completionTokens: 30, totalTokens: 150 }
          }
        ],
        new DeepSeekProviderError('INVALID_RESPONSE', `raw: ${SECRET}`)
      ),
      mcp
    });

    let tick = 0;
    const { audit } = await collect({
      runner,
      runId: 'run-audit',
      messages: [{ role: 'user', content: `问题原文含敏感客户名,${SECRET}` }],
      clock: () => {
        tick += 10;
        return tick;
      }
    });

    expect(audit).toEqual({
      runId: 'run-audit',
      sessionId: null,
      outcome: 'failed',
      modelTurns: 1,
      usage: { promptTokens: 120, completionTokens: 30, totalTokens: 150 },
      toolCalls: [{ toolName: 'validate_page', status: 'succeeded', durationMs: 10 }],
      failure: { category: 'MODEL_PROTOCOL_ERROR', stage: 'generation' }
    });
    const serialized = JSON.stringify(audit);
    expect(serialized).not.toContain(SECRET);
    expect(serialized).not.toContain('助手的回复正文');
    expect(serialized).not.toContain('问题原文');
  });
});
