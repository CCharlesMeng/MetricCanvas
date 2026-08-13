import { describe, expect, it } from 'vitest';
import { DeepSeekProviderError } from '../../src/lib/server/agent/deepseek.server';
import { normalizeAgentRunError } from '../../src/lib/server/agent/errors';
import { AgentRunnerError } from '../../src/lib/server/agent/runner';

const SECRET = 'sk-super-secret-key-do-not-leak';

function runnerError(
  code: ConstructorParameters<typeof AgentRunnerError>[0],
  cause?: unknown
): AgentRunnerError {
  return new AgentRunnerError(code, '内部停机文案', [], cause === undefined ? undefined : { cause });
}

describe('Agent 运行错误归一化为稳定分类', () => {
  it.each([
    {
      name: '模型限流(HTTP 429)',
      cause: runnerError('MODEL_FAILED', new DeepSeekProviderError('HTTP_ERROR', 'x', { status: 429 })),
      category: 'MODEL_RATE_LIMITED',
      retryable: true
    },
    {
      name: '模型协议错误(HTTP 500)',
      cause: runnerError('MODEL_FAILED', new DeepSeekProviderError('HTTP_ERROR', 'x', { status: 500 })),
      category: 'MODEL_PROTOCOL_ERROR',
      retryable: true
    },
    {
      name: '模型响应形状非法',
      cause: runnerError('MODEL_FAILED', new DeepSeekProviderError('INVALID_RESPONSE', 'x')),
      category: 'MODEL_PROTOCOL_ERROR',
      retryable: true
    },
    {
      name: '模型提供方不可达',
      cause: runnerError('MODEL_FAILED', new DeepSeekProviderError('NETWORK_ERROR', 'x')),
      category: 'MODEL_PROTOCOL_ERROR',
      retryable: true
    },
    {
      name: '非法工具调用(参数不是合法 JSON)',
      cause: runnerError(
        'MODEL_FAILED',
        new DeepSeekProviderError('INVALID_TOOL_ARGUMENTS', 'x', { toolName: 'validate_page' })
      ),
      category: 'INVALID_TOOL_CALL',
      retryable: true
    },
    {
      name: '运行超时',
      cause: runnerError('RUN_TIMEOUT'),
      category: 'RUN_TIMEOUT',
      retryable: true
    },
    {
      name: '最大模型轮次耗尽',
      cause: runnerError('MAX_MODEL_TURNS'),
      category: 'RUN_BUDGET_EXCEEDED',
      retryable: false
    },
    {
      name: 'token 用量耗尽',
      cause: runnerError('USAGE_LIMIT_EXCEEDED'),
      category: 'RUN_BUDGET_EXCEEDED',
      retryable: false
    },
    {
      name: '用户取消',
      cause: runnerError('CANCELLED'),
      category: 'RUN_CANCELLED',
      retryable: true
    },
    {
      name: '未识别异常兜底',
      cause: new Error('anything'),
      category: 'AGENT_INTERNAL_ERROR',
      retryable: false
    }
  ])('$name → $category', ({ cause, category, retryable }) => {
    const normalized = normalizeAgentRunError(cause);
    expect(normalized.category).toBe(category);
    expect(normalized.retryable).toBe(retryable);
    expect(normalized.stage).toBe('generation');
    expect(normalized.message.length).toBeGreaterThan(0);
  });

  it('归一化文案不透传底层错误文本:凭据与响应正文不进入稳定错误', () => {
    const leakyCauses: unknown[] = [
      new Error(`authorization: Bearer ${SECRET}`),
      runnerError('MODEL_FAILED', new Error(`response body containing ${SECRET}`)),
      runnerError(
        'MODEL_FAILED',
        new DeepSeekProviderError('INVALID_RESPONSE', `raw body: ${SECRET}`)
      )
    ];
    for (const cause of leakyCauses) {
      const normalized = normalizeAgentRunError(cause);
      expect(JSON.stringify(normalized)).not.toContain(SECRET);
    }
  });

  it('HTTP 状态码作为安全结构化字段进入文案,便于排障', () => {
    const normalized = normalizeAgentRunError(
      runnerError('MODEL_FAILED', new DeepSeekProviderError('HTTP_ERROR', 'x', { status: 503 }))
    );
    expect(normalized.message).toContain('503');
  });
});
