import type { AgentMessage, ModelProvider } from './types';

export interface DeepSeekModelProviderOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  fetch?: typeof fetch;
}

export function createDeepSeekModelProvider(
  options: DeepSeekModelProviderOptions
): ModelProvider {
  if (options.apiKey.length === 0) {
    throw new DeepSeekProviderError('MISSING_API_KEY', '缺少 DeepSeek API Key');
  }
  const fetchImpl = options.fetch ?? fetch;
  const baseUrl = (options.baseUrl ?? 'https://api.deepseek.com').replace(/\/+$/, '');
  const model = options.model ?? 'deepseek-v4-pro';

  return {
    async complete(request) {
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${options.apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: request.messages.map(toDeepSeekMessage),
          tools: request.tools.map((tool) => ({
            type: 'function',
            function: {
              name: tool.name,
              ...(tool.description ? { description: tool.description } : {}),
              parameters: tool.inputSchema
            }
          })),
          tool_choice: 'auto',
          // 不把 reasoning_content 暴露给工作台或会话;本切片使用非思考模式。
          thinking: { type: 'disabled' },
          stream: false
        }),
        signal: request.signal
      });
      if (!response.ok) {
        throw new DeepSeekProviderError(
          'HTTP_ERROR',
          `DeepSeek 请求失败:HTTP ${response.status}`
        );
      }

      const payload = (await response.json()) as DeepSeekResponse;
      const message = payload.choices?.[0]?.message;
      if (!message) {
        throw new DeepSeekProviderError('INVALID_RESPONSE', 'DeepSeek 响应缺少 assistant message');
      }

      return {
        content: message.content ?? '',
        toolCalls: (message.tool_calls ?? []).map((call) => {
          let input: unknown;
          try {
            input = JSON.parse(call.function.arguments);
          } catch {
            throw new DeepSeekProviderError(
              'INVALID_TOOL_ARGUMENTS',
              `DeepSeek 工具参数不是合法 JSON:${call.function.name}`
            );
          }
          return {
            id: call.id,
            name: call.function.name,
            input
          };
        })
      };
    }
  };
}

export class DeepSeekProviderError extends Error {
  constructor(
    public readonly code:
      | 'MISSING_API_KEY'
      | 'HTTP_ERROR'
      | 'INVALID_RESPONSE'
      | 'INVALID_TOOL_ARGUMENTS',
    message: string
  ) {
    super(message);
  }
}

interface DeepSeekResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    };
  }>;
}

function toDeepSeekMessage(message: AgentMessage): Record<string, unknown> {
  if (message.role === 'assistant') {
    return {
      role: 'assistant',
      content: message.content,
      ...(message.toolCalls.length > 0
        ? {
            tool_calls: message.toolCalls.map((call) => ({
              id: call.id,
              type: 'function',
              function: {
                name: call.name,
                arguments: JSON.stringify(call.input)
              }
            }))
          }
        : {})
    };
  }
  if (message.role === 'tool') {
    return {
      role: 'tool',
      tool_call_id: message.toolCallId,
      content: message.content
    };
  }
  return { role: message.role, content: message.content };
}
