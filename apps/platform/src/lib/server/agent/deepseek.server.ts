import { isAbortError } from './abort';
import type { AgentMessage, ModelProvider, TokenUsage } from './types';

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
      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/chat/completions`, {
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
            // 不把 reasoning_content 暴露给工作台或会话;本切片使用非流式模式:
            // 步骤事件流式下发(#32)只流步骤,不流模型 token。
            thinking: { type: 'disabled' },
            stream: false
          }),
          signal: request.signal
        });
      } catch (cause) {
        // 中止原样上抛,由 Runner 判别是取消还是运行超时;其余网络失败
        // 收敛为固定文案的传输错误,不透传底层文本(可能含请求细节)。
        if (isAbortError(cause)) throw cause;
        throw new DeepSeekProviderError('NETWORK_ERROR', 'DeepSeek 请求无法送达');
      }
      if (!response.ok) {
        throw new DeepSeekProviderError(
          'HTTP_ERROR',
          `DeepSeek 请求失败:HTTP ${response.status}`,
          { status: response.status }
        );
      }

      let payload: DeepSeekResponse;
      try {
        payload = (await response.json()) as DeepSeekResponse;
      } catch {
        throw new DeepSeekProviderError('INVALID_RESPONSE', 'DeepSeek 响应不是合法 JSON');
      }
      const message = payload.choices?.[0]?.message;
      if (!message) {
        throw new DeepSeekProviderError('INVALID_RESPONSE', 'DeepSeek 响应缺少 assistant message');
      }

      const usage = toTokenUsage(payload.usage);
      return {
        content: message.content ?? '',
        toolCalls: (message.tool_calls ?? []).map((call) => {
          let input: unknown;
          try {
            input = JSON.parse(call.function.arguments);
          } catch {
            throw new DeepSeekProviderError(
              'INVALID_TOOL_ARGUMENTS',
              `DeepSeek 工具参数不是合法 JSON:${call.function.name}`,
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

export class DeepSeekProviderError extends Error {
  /** HTTP_ERROR 时的响应状态码。 */
  public readonly status?: number;
  /** INVALID_TOOL_ARGUMENTS 时的工具名。 */
  public readonly toolName?: string;

  constructor(
    public readonly code:
      | 'MISSING_API_KEY'
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
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

function toTokenUsage(usage: DeepSeekResponse['usage']): TokenUsage | null {
  if (!usage || typeof usage.total_tokens !== 'number') return null;
  return {
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens
  };
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
