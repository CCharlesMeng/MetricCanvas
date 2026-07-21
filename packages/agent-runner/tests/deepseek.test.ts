import { describe, expect, it } from 'vitest';
import { createDeepSeekModelProvider } from '@metriccanvas/agent-runner';

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
                        name: 'search_catalog',
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
          name: 'search_catalog',
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
          name: 'search_catalog',
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
            name: 'search_catalog',
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
});
