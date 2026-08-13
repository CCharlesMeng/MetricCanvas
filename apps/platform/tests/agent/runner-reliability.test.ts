import { describe, expect, it } from 'vitest';
import type { McpClient } from '@metriccanvas/mcp';
import { AgentRunnerError, createAgentRunner } from '../../src/lib/server/agent/runner';
import type {
  AgentEvent,
  AgentMessage,
  ModelProvider
} from '../../src/lib/server/agent/types';
import { createScriptedModelProvider } from '../support/scripted-model-provider';

const USER_MESSAGES: AgentMessage[] = [{ role: 'user', content: '创建销售看板' }];

function noopMcp(overrides: Partial<McpClient> = {}): McpClient {
  return {
    async listTools() {
      return [
        { name: 'validate_page', inputSchema: { type: 'object', properties: {} } }
      ];
    },
    async callTool() {
      return { structuredContent: { ok: true }, isError: false };
    },
    ...overrides
  };
}

function toolCallResponse(id: string) {
  return {
    content: '',
    toolCalls: [{ id, name: 'validate_page', input: { document: {} } }]
  };
}

async function collectError(events: AsyncIterable<AgentEvent>): Promise<AgentRunnerError> {
  try {
    for await (const event of events) void event;
  } catch (cause) {
    expect(cause).toBeInstanceOf(AgentRunnerError);
    return cause as AgentRunnerError;
  }
  throw new Error('预期 Agent Runner 以 AgentRunnerError 停机');
}

describe('Agent Runner 取消贯穿模型调用与工具执行', () => {
  it('取消中止进行中的模型调用:信号传入模型提供方,停机快照保留既有会话', async () => {
    let modelSignal: AbortSignal | undefined;
    let modelInvoked!: () => void;
    const invoked = new Promise<void>((resolve) => (modelInvoked = resolve));
    const model: ModelProvider = {
      complete: ({ signal }) =>
        new Promise((_, reject) => {
          modelSignal = signal;
          modelInvoked();
          signal?.addEventListener(
            'abort',
            () => reject(new DOMException('模型调用已中止', 'AbortError')),
            { once: true }
          );
        })
    };
    const runner = createAgentRunner({ model, mcp: noopMcp() });
    const controller = new AbortController();

    const halted = collectError(runner.run({ messages: USER_MESSAGES, signal: controller.signal }));
    await invoked;
    controller.abort();
    const error = await halted;

    expect(error.code).toBe('CANCELLED');
    expect(modelSignal?.aborted).toBe(true);
    expect(error.messages).toEqual(USER_MESSAGES);
  });

  it('取消中止进行中的工具执行:不等不响应中止的工具返回,结果不进会话', async () => {
    let toolStarted!: () => void;
    const started = new Promise<void>((resolve) => (toolStarted = resolve));
    const mcp = noopMcp({
      callTool: () =>
        new Promise(() => {
          // 故意永不返回:证明取消不依赖工具自身配合。
          toolStarted();
        })
    });
    const model = createScriptedModelProvider([toolCallResponse('call-1')]);
    const runner = createAgentRunner({ model, mcp });
    const controller = new AbortController();

    const halted = collectError(runner.run({ messages: USER_MESSAGES, signal: controller.signal }));
    await started;
    controller.abort();
    const error = await halted;

    expect(error.code).toBe('CANCELLED');
    // 快照停在助手消息:工具没有结果,重试时会重新执行这一步。
    expect(error.messages.at(-1)).toMatchObject({ role: 'assistant' });
  });
});

describe('Agent Runner 上限与超时安全停止', () => {
  it('运行超时中止进行中的执行并以 RUN_TIMEOUT 停机(注入超时信号,不依赖真实时间)', async () => {
    const timeoutController = new AbortController();
    let toolStarted!: () => void;
    const started = new Promise<void>((resolve) => (toolStarted = resolve));
    const mcp = noopMcp({
      callTool: () =>
        new Promise(() => {
          toolStarted();
        })
    });
    const model = createScriptedModelProvider([toolCallResponse('call-1')]);
    const runner = createAgentRunner({
      model,
      mcp,
      timeoutMs: 5_000,
      createTimeoutSignal: (timeoutMs) => {
        expect(timeoutMs).toBe(5_000);
        return timeoutController.signal;
      }
    });

    const halted = collectError(runner.run({ messages: USER_MESSAGES }));
    await started;
    timeoutController.abort(new DOMException('超时', 'TimeoutError'));
    const error = await halted;

    expect(error.code).toBe('RUN_TIMEOUT');
    expect(error.messages.at(-1)).toMatchObject({ role: 'assistant' });
  });

  it('token 用量超过上限后不再执行工具与后续模型调用', async () => {
    const usage = { promptTokens: 100_000, completionTokens: 50_000, totalTokens: 150_000 };
    const toolCalls: string[] = [];
    const mcp = noopMcp({
      async callTool({ name }) {
        toolCalls.push(name);
        return { structuredContent: { ok: true }, isError: false };
      }
    });
    const model = createScriptedModelProvider([
      { ...toolCallResponse('call-1'), usage },
      { ...toolCallResponse('call-2'), usage },
      { content: '不应到达第三轮', toolCalls: [] }
    ]);
    const runner = createAgentRunner({ model, mcp, maxTotalTokens: 200_000 });

    const error = await collectError(runner.run({ messages: USER_MESSAGES }));

    expect(error.code).toBe('USAGE_LIMIT_EXCEEDED');
    // 第一轮 150k 在预算内执行了工具;第二轮累计 300k 超限,工具不再执行。
    expect(toolCalls).toEqual(['validate_page']);
  });

  it('最后一轮纯文本回复越过用量上限时仍正常完成:答案已产生,完成比作废更安全', async () => {
    const model = createScriptedModelProvider([
      {
        content: '看板已生成。',
        toolCalls: [],
        usage: { promptTokens: 250_000, completionTokens: 1_000, totalTokens: 251_000 }
      }
    ]);
    const runner = createAgentRunner({ model, mcp: noopMcp(), maxTotalTokens: 200_000 });

    const events: AgentEvent[] = [];
    for await (const event of runner.run({ messages: USER_MESSAGES })) events.push(event);

    expect(events.at(-1)).toMatchObject({ type: 'completed' });
  });

  it('达到最大模型轮次以 MAX_MODEL_TURNS 停机并携带会话快照', async () => {
    const model = createScriptedModelProvider([toolCallResponse('call-1')]);
    const runner = createAgentRunner({ model, mcp: noopMcp(), maxModelTurns: 1 });

    const error = await collectError(runner.run({ messages: USER_MESSAGES }));

    expect(error.code).toBe('MAX_MODEL_TURNS');
    expect(error.messages.at(-1)).toMatchObject({ role: 'tool', name: 'validate_page' });
  });

  it('模型提供方失败以 MODEL_FAILED 停机并保留原因', async () => {
    const cause = new Error('provider exploded');
    const model: ModelProvider = {
      complete: async () => {
        throw cause;
      }
    };
    const runner = createAgentRunner({ model, mcp: noopMcp() });

    const error = await collectError(runner.run({ messages: USER_MESSAGES }));

    expect(error.code).toBe('MODEL_FAILED');
    expect(error.cause).toBe(cause);
  });
});

describe('Agent Runner 逐轮用量事件', () => {
  it('每轮模型调用后回报 turn_completed 与该轮用量;无用量时为 null', async () => {
    const usage = { promptTokens: 10, completionTokens: 5, totalTokens: 15 };
    const model = createScriptedModelProvider([
      { ...toolCallResponse('call-1'), usage },
      { content: '完成。', toolCalls: [] }
    ]);
    const runner = createAgentRunner({ model, mcp: noopMcp() });

    const events: AgentEvent[] = [];
    for await (const event of runner.run({ messages: USER_MESSAGES })) events.push(event);

    const turns = events.filter((event) => event.type === 'turn_completed');
    expect(turns).toEqual([
      { type: 'turn_completed', turn: 1, usage },
      { type: 'turn_completed', turn: 2, usage: null }
    ]);
  });
});
