import type { McpToolResult } from '@metriccanvas/mcp';
import type { AgentMessage, AgentRunner, AgentRunnerOptions } from './types';

export function createAgentRunner(options: AgentRunnerOptions): AgentRunner {
  const maxModelTurns = options.maxModelTurns ?? 12;

  return {
    async *run({ messages: initialMessages, signal }) {
      const messages = structuredClone(initialMessages);
      const tools = await options.mcp.listTools();
      const toolCallCounts = new Map<string, number>();

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
          const limit = options.toolCallLimits?.[call.name];
          const count = toolCallCounts.get(call.name) ?? 0;
          if (limit !== undefined && count >= limit) {
            result = {
              isError: true,
              structuredContent: {
                ok: false,
                error: {
                  code: 'TOOL_CALL_LIMIT_EXCEEDED',
                  message:
                    `${call.name} 在本次 Agent Run 中最多调用 ${limit} 次；` +
                    '请使用已有工具结果继续，或向用户澄清后结束当前运行',
                  tool: call.name,
                  limit
                }
              }
            };
          } else {
            toolCallCounts.set(call.name, count + 1);
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

export class AgentRunnerError extends Error {
  constructor(
    public readonly code: 'MAX_MODEL_TURNS',
    message: string
  ) {
    super(message);
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error
    ? signal.reason
    : new DOMException('Agent Runner 已取消', 'AbortError');
}
