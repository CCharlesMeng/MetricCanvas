import { isAbortError } from './abort';
import type { AgentMessage, ModelProvider, TokenUsage } from './types';

export interface OpenAICompatibleModelProviderOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  fetch?: typeof fetch;
}

/** 连接内网自有的 OpenAI Chat Completions 兼容端点。 */
export function createOpenAICompatibleModelProvider(
  options: OpenAICompatibleModelProviderOptions
): ModelProvider {
  const fetchImpl = options.fetch ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/+$/, '');

  return {
    async complete(request) {
      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${options.apiKey}`,
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model: options.model,
            messages: request.messages.map(toOpenAICompatibleMessage),
            ...(request.tools.length > 0
              ? {
                  tools: request.tools.map((tool) => ({
                    type: 'function',
                    function: {
                      name: tool.name,
                      description: tool.description,
                      parameters: tool.inputSchema
                    }
                  })),
                  tool_choice: 'auto'
                }
              : {}),
            stream: false
          }),
          signal: request.signal
        });
      } catch (cause) {
        if (isAbortError(cause)) throw cause;
        throw new OpenAICompatibleProviderError(
          'NETWORK_ERROR',
          'OpenAI 兼容端点不可达'
        );
      }

      if (!response.ok) {
        throw new OpenAICompatibleProviderError(
          'HTTP_ERROR',
          `OpenAI 兼容端点请求失败(HTTP ${response.status})`,
          { status: response.status }
        );
      }
      let payload: OpenAICompatibleResponse | null;
      try {
        payload = (await response.json()) as OpenAICompatibleResponse;
      } catch {
        throw new OpenAICompatibleProviderError(
          'INVALID_RESPONSE',
          'OpenAI 兼容端点响应不是合法 JSON'
        );
      }
      const message = payload?.choices?.[0]?.message;
      if (!message) {
        throw new OpenAICompatibleProviderError(
          'INVALID_RESPONSE',
          'OpenAI 兼容端点响应缺少 assistant message'
        );
      }

      const usage = toTokenUsage(payload.usage);
      return {
        content: message.content ?? '',
        toolCalls: (message.tool_calls ?? []).map((call) => {
          let input: unknown;
          try {
            input = JSON.parse(call.function.arguments) as unknown;
          } catch {
            throw new OpenAICompatibleProviderError(
              'INVALID_TOOL_ARGUMENTS',
              `OpenAI 兼容模型工具参数不是合法 JSON:${call.function.name}`,
              { toolName: call.function.name }
            );
          }
          return {
            id: call.id,
            name: call.function.name,
            input
          };
        }),
        ...(usage ? { usage } : {})
      };
    }
  };
}

export class OpenAICompatibleProviderError extends Error {
  public readonly status?: number;
  public readonly toolName?: string;

  constructor(
    public readonly code:
      | 'HTTP_ERROR'
      | 'NETWORK_ERROR'
      | 'INVALID_RESPONSE'
      | 'INVALID_TOOL_ARGUMENTS',
    message: string,
    detail?: { status?: number; toolName?: string }
  ) {
    super(message);
    if (detail?.status !== undefined) this.status = detail.status;
    if (detail?.toolName !== undefined) this.toolName = detail.toolName;
  }
}

interface OpenAICompatibleResponse {
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
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

function toTokenUsage(usage: OpenAICompatibleResponse['usage']): TokenUsage | null {
  if (!usage || typeof usage.total_tokens !== 'number') return null;
  return {
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens
  };
}

function toOpenAICompatibleMessage(message: AgentMessage): Record<string, unknown> {
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
