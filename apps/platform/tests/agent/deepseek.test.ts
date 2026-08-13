import { describe, expect, it } from 'vitest';
import {
  createDeepSeekModelProvider,
  DeepSeekProviderError
} from '../../src/lib/server/agent/deepseek.server';

describe('DeepSeek 模型 adapter', () => {
  it('只在服务端请求头注入 Key,使用当前模型与工具调用协议', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const provider = createDeepSeekModelProvider({
      apiKey: 'server-only-test-key',
      fetch: async (input, init) => {
        requests.push({ url: String(input), init });
        return new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: 'tool_calls',
                message: {
                  role: 'assistant',
                  content: '',
                  tool_calls: [
                    {
                      id: 'call-search',
                      type: 'function',
                      function: {
                        name: 'search_data_context',
                        arguments: '{"query":"成交总额","limit":10}'
                      }
                    }
                  ]
                }
              }
            ]
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
    });

    const response = await provider.complete({
      messages: [{ role: 'user', content: '创建成交总额单指标卡' }],
      tools: [
        {
          name: 'search_data_context',
          description: '检索目录',
          inputSchema: {
            type: 'object',
            properties: { query: { type: 'string' }, limit: { type: 'integer' } },
            required: ['query', 'limit'],
            additionalProperties: false
          }
        }
      ]
    });

    expect(response).toEqual({
      content: '',
      toolCalls: [
        {
          id: 'call-search',
          name: 'search_data_context',
          input: { query: '成交总额', limit: 10 }
        }
      ]
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe('https://api.deepseek.com/chat/completions');
    expect(new Headers(requests[0].init?.headers).get('authorization')).toBe(
      'Bearer server-only-test-key'
    );
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({
      model: 'deepseek-v4-pro',
      messages: [{ role: 'user', content: '创建成交总额单指标卡' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'search_data_context',
            description: '检索目录',
            parameters: {
              type: 'object',
              properties: { query: { type: 'string' }, limit: { type: 'integer' } },
              required: ['query', 'limit'],
              additionalProperties: false
            }
          }
        }
      ],
      tool_choice: 'auto',
      thinking: { type: 'disabled' },
      stream: false
    });
    expect(JSON.stringify(response)).not.toContain('server-only-test-key');
  });

  it('解析模型回报的结构化用量', async () => {
    const provider = createDeepSeekModelProvider({
      apiKey: 'server-only-test-key',
      fetch: async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { role: 'assistant', content: '完成。' } }],
            usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    });

    const response = await provider.complete({ messages: [], tools: [] });

    expect(response.usage).toEqual({
      promptTokens: 120,
      completionTokens: 30,
      totalTokens: 150
    });
  });

  it('HTTP 失败携带结构化状态码,便于归一化为限流分类', async () => {
    const provider = createDeepSeekModelProvider({
      apiKey: 'server-only-test-key',
      fetch: async () => new Response('rate limited', { status: 429 })
    });

    const failure = await provider.complete({ messages: [], tools: [] }).catch((cause) => cause);

    expect(failure).toBeInstanceOf(DeepSeekProviderError);
    expect(failure).toMatchObject({ code: 'HTTP_ERROR', status: 429 });
  });

  it('网络失败收敛为固定文案的 NETWORK_ERROR,不透传底层错误文本', async () => {
    const provider = createDeepSeekModelProvider({
      apiKey: 'server-only-test-key',
      fetch: async () => {
        throw new TypeError('fetch failed: authorization Bearer server-only-test-key');
      }
    });

    const failure = await provider.complete({ messages: [], tools: [] }).catch((cause) => cause);

    expect(failure).toBeInstanceOf(DeepSeekProviderError);
    expect(failure).toMatchObject({ code: 'NETWORK_ERROR' });
    expect((failure as Error).message).not.toContain('server-only-test-key');
  });

  it('中止原样上抛,由 Runner 判别取消或超时', async () => {
    const abort = new DOMException('中止', 'AbortError');
    const provider = createDeepSeekModelProvider({
      apiKey: 'server-only-test-key',
      fetch: async () => {
        throw abort;
      }
    });

    await expect(provider.complete({ messages: [], tools: [] })).rejects.toBe(abort);
  });

  it('非法工具参数携带工具名,归一化为非法工具调用分类', async () => {
    const provider = createDeepSeekModelProvider({
      apiKey: 'server-only-test-key',
      fetch: async () =>
        new Response(
          JSON.stringify({
            choices: [{
              message: {
                role: 'assistant',
                content: '',
                tool_calls: [{
                  id: 'call-1',
                  type: 'function',
                  function: { name: 'validate_page', arguments: '{broken json' }
                }]
              }
            }]
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    });

    const failure = await provider.complete({ messages: [], tools: [] }).catch((cause) => cause);

    expect(failure).toBeInstanceOf(DeepSeekProviderError);
    expect(failure).toMatchObject({ code: 'INVALID_TOOL_ARGUMENTS', toolName: 'validate_page' });
  });
});
