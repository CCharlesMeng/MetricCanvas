export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

export type AgentMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls: ToolCall[] }
  | {
      role: 'tool';
      content: string;
      toolCallId: string;
      name: string;
      isError: boolean;
    };

export interface ModelRequest {
  messages: AgentMessage[];
  tools: ToolDefinition[];
  signal?: AbortSignal;
}

export interface ModelResponse {
  content: string;
  toolCalls: ToolCall[];
}

export interface ModelProvider {
  complete(request: ModelRequest): Promise<ModelResponse>;
}

export interface McpToolResult {
  structuredContent?: unknown;
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
  interaction?: AgentInteraction;
}

export interface AgentInteraction {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
}

export interface McpClient {
  listTools(): Promise<ToolDefinition[]>;
  callTool(request: { name: string; arguments: unknown }): Promise<McpToolResult>;
}

export type AgentEvent =
  | { type: 'assistant_message'; message: Extract<AgentMessage, { role: 'assistant' }> }
  | { type: 'tool_started'; call: ToolCall }
  | {
      type: 'tool_finished';
      call: ToolCall;
      result: McpToolResult;
    }
  | {
      type: 'interaction_required';
      interaction: AgentInteraction;
      messages: AgentMessage[];
    }
  | { type: 'completed'; messages: AgentMessage[] };

export interface RunAgentInput {
  messages: AgentMessage[];
  signal?: AbortSignal;
}

export interface AgentRunner {
  run(input: RunAgentInput): AsyncIterable<AgentEvent>;
}

export interface AgentRunnerOptions {
  model: ModelProvider;
  mcp: McpClient;
  maxModelTurns?: number;
}

export function createAgentRunner(options: AgentRunnerOptions): AgentRunner {
  const maxModelTurns = options.maxModelTurns ?? 12;

  return {
    async *run({ messages: initialMessages, signal }) {
      const messages = structuredClone(initialMessages);
      const tools = await options.mcp.listTools();

      for (let turn = 0; turn < maxModelTurns; turn++) {
        throwIfAborted(signal);
        const response = await options.model.complete({ messages, tools, signal });
        const assistantMessage: Extract<AgentMessage, { role: 'assistant' }> = {
          role: 'assistant',
          content: response.content,
          toolCalls: response.toolCalls
        };
        messages.push(assistantMessage);
        if (assistantMessage.content.length > 0) {
          yield { type: 'assistant_message', message: assistantMessage };
        }

        if (response.toolCalls.length === 0) {
          yield { type: 'completed', messages };
          return;
        }

        for (const call of response.toolCalls) {
          throwIfAborted(signal);
          yield { type: 'tool_started', call };

          let result: McpToolResult;
          try {
            result = await options.mcp.callTool({
              name: call.name,
              arguments: call.input
            });
          } catch (cause) {
            result = {
              isError: true,
              structuredContent: {
                ok: false,
                error: {
                  code: 'MCP_CALL_FAILED',
                  message: cause instanceof Error ? cause.message : String(cause)
                }
              }
            };
          }
          yield { type: 'tool_finished', call, result };
          messages.push({
            role: 'tool',
            toolCallId: call.id,
            name: call.name,
            content: JSON.stringify(result.structuredContent ?? result.content ?? null),
            isError: result.isError === true
          });
          if (result.interaction) {
            yield {
              type: 'interaction_required',
              interaction: result.interaction,
              messages
            };
            return;
          }
        }
      }

      throw new AgentRunnerError(
        'MAX_MODEL_TURNS',
        `Agent Runner 超过最大模型轮次 ${maxModelTurns}`
      );
    }
  };
}

export function createScriptedModelProvider(responses: ModelResponse[]): ModelProvider {
  const queue = structuredClone(responses);
  return {
    async complete() {
      const next = queue.shift();
      if (!next) {
        throw new AgentRunnerError('SCRIPT_EXHAUSTED', 'scripted model 响应已耗尽');
      }
      return structuredClone(next);
    }
  };
}

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

export class AgentRunnerError extends Error {
  constructor(
    public readonly code: 'MAX_MODEL_TURNS' | 'SCRIPT_EXHAUSTED',
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

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error
    ? signal.reason
    : new DOMException('Agent Runner 已取消', 'AbortError');
}
