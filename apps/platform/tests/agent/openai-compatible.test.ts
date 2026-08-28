import { describe, expect, it } from 'vitest';
import {
  createOpenAICompatibleModelProvider,
  OpenAICompatibleProviderError
} from '../../src/lib/server/agent/openai-compatible.server';

describe('OpenAI 兼容模型 adapter', () => {
  it('使用显式内网端点完成非流式 chat 与 tool calling', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const signal = new AbortController().signal;
    const provider = createOpenAICompatibleModelProvider({
      apiKey: 'server-only-compatible-key',
      baseUrl: 'https://models.intranet.example/v1/',
      model: 'intranet-chat-model',
      fetch: async (input, init) => {
        requests.push({ url: String(input), init });
        return new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: 'tool_calls',
                message: {
                  role: 'assistant',
                  content: null,
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
            ],
            usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
    });

    const response = await provider.complete({
      messages: [
        { role: 'system', content: '你是 MetricCanvas 建页 Agent' },
        { role: 'user', content: '创建成交总额单指标卡' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [
            {
              id: 'call-previous',
              name: 'search_data_context',
              input: { query: '成交总额', limit: 10 }
            }
          ]
        },
        {
          role: 'tool',
          toolCallId: 'call-previous',
          name: 'search_data_context',
          isError: false,
          content: '{"matches":[]}'
        }
      ],
      tools: [
        {
          name: 'search_data_context',
          description: '检索数据上下文',
          inputSchema: {
            type: 'object',
            properties: { query: { type: 'string' }, limit: { type: 'integer' } },
            required: ['query', 'limit'],
            additionalProperties: false
          }
        }
      ],
      signal
    });

    expect(response).toEqual({
      content: '',
      toolCalls: [
        {
          id: 'call-search',
          name: 'search_data_context',
          input: { query: '成交总额', limit: 10 }
        }
      ],
      usage: { promptTokens: 120, completionTokens: 30, totalTokens: 150 }
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe('https://models.intranet.example/v1/chat/completions');
    expect(requests[0].init?.method).toBe('POST');
    expect(requests[0].init?.signal).toBe(signal);
    expect(new Headers(requests[0].init?.headers).get('authorization')).toBe(
      'Bearer server-only-compatible-key'
    );
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({
      model: 'intranet-chat-model',
      messages: [
        { role: 'system', content: '你是 MetricCanvas 建页 Agent' },
        { role: 'user', content: '创建成交总额单指标卡' },
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'call-previous',
              type: 'function',
              function: {
                name: 'search_data_context',
                arguments: '{"query":"成交总额","limit":10}'
              }
            }
          ]
        },
        { role: 'tool', tool_call_id: 'call-previous', content: '{"matches":[]}' }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'search_data_context',
            description: '检索数据上下文',
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
      stream: false
    });
    expect(JSON.stringify(response)).not.toContain('server-only-compatible-key');
  });

  it('纯 chat 请求不发送空 tools 与 tool_choice', async () => {
    let requestBody: unknown;
    const provider = createOpenAICompatibleModelProvider({
      apiKey: 'server-only-compatible-key',
      baseUrl: 'https://models.intranet.example/v1',
      model: 'intranet-chat-model',
      fetch: async (_input, init) => {
        requestBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            choices: [{ message: { role: 'assistant', content: '已完成。' } }]
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
    });

    await expect(
      provider.complete({ messages: [{ role: 'user', content: '请回答' }], tools: [] })
    ).resolves.toEqual({ content: '已完成。', toolCalls: [] });
    expect(requestBody).toEqual({
      model: 'intranet-chat-model',
      messages: [{ role: 'user', content: '请回答' }],
      stream: false
    });
  });

  it('HTTP 失败只携带结构化状态码，不读取上游正文', async () => {
    const provider = createOpenAICompatibleModelProvider({
      apiKey: 'server-only-compatible-key',
      baseUrl: 'https://models.intranet.example/v1',
      model: 'intranet-chat-model',
      fetch: async () =>
        new Response('response body containing server-only-compatible-key', { status: 429 })
    });

    const failure = await provider.complete({ messages: [], tools: [] }).catch((cause) => cause);

    expect(failure).toBeInstanceOf(OpenAICompatibleProviderError);
    expect(failure).toMatchObject({ code: 'HTTP_ERROR', status: 429 });
    expect((failure as Error).message).not.toContain('server-only-compatible-key');
  });

  it('网络失败收敛为固定错误，不透传底层异常与凭据', async () => {
    const provider = createOpenAICompatibleModelProvider({
      apiKey: 'server-only-compatible-key',
      baseUrl: 'https://models.intranet.example/v1',
      model: 'intranet-chat-model',
      fetch: async () => {
        throw new TypeError('fetch failed: authorization Bearer server-only-compatible-key');
      }
    });

    const failure = await provider.complete({ messages: [], tools: [] }).catch((cause) => cause);

    expect(failure).toBeInstanceOf(OpenAICompatibleProviderError);
    expect(failure).toMatchObject({ code: 'NETWORK_ERROR' });
    expect((failure as Error).message).not.toContain('server-only-compatible-key');
  });

  it('中止错误原样上抛，由 Runner 判别取消或超时', async () => {
    const abort = new DOMException('中止', 'AbortError');
    const provider = createOpenAICompatibleModelProvider({
      apiKey: 'server-only-compatible-key',
      baseUrl: 'https://models.intranet.example/v1',
      model: 'intranet-chat-model',
      fetch: async () => {
        throw abort;
      }
    });

    await expect(provider.complete({ messages: [], tools: [] })).rejects.toBe(abort);
  });

  it('非法 JSON 响应收敛为脱敏的 INVALID_RESPONSE', async () => {
    const provider = createOpenAICompatibleModelProvider({
      apiKey: 'server-only-compatible-key',
      baseUrl: 'https://models.intranet.example/v1',
      model: 'intranet-chat-model',
      fetch: async () =>
        new Response('{broken server-only-compatible-key', {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    });

    const failure = await provider.complete({ messages: [], tools: [] }).catch((cause) => cause);

    expect(failure).toBeInstanceOf(OpenAICompatibleProviderError);
    expect(failure).toMatchObject({ code: 'INVALID_RESPONSE' });
    expect((failure as Error).message).not.toContain('server-only-compatible-key');
  });

  it('缺少 assistant message 的 JSON 响应收敛为 INVALID_RESPONSE', async () => {
    const provider = createOpenAICompatibleModelProvider({
      apiKey: 'server-only-compatible-key',
      baseUrl: 'https://models.intranet.example/v1',
      model: 'intranet-chat-model',
      fetch: async () =>
        new Response('null', {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    });

    const failure = await provider.complete({ messages: [], tools: [] }).catch((cause) => cause);

    expect(failure).toBeInstanceOf(OpenAICompatibleProviderError);
    expect(failure).toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('非法工具参数收敛为 INVALID_TOOL_ARGUMENTS 并只携带工具名', async () => {
    const provider = createOpenAICompatibleModelProvider({
      apiKey: 'server-only-compatible-key',
      baseUrl: 'https://models.intranet.example/v1',
      model: 'intranet-chat-model',
      fetch: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: '',
                  tool_calls: [
                    {
                      id: 'call-1',
                      type: 'function',
                      function: {
                        name: 'validate_page',
                        arguments: '{broken server-only-compatible-key'
                      }
                    }
                  ]
                }
              }
            ]
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    });

    const failure = await provider.complete({ messages: [], tools: [] }).catch((cause) => cause);

    expect(failure).toBeInstanceOf(OpenAICompatibleProviderError);
    expect(failure).toMatchObject({
      code: 'INVALID_TOOL_ARGUMENTS',
      toolName: 'validate_page'
    });
    expect((failure as Error).message).not.toContain('server-only-compatible-key');
  });
});
