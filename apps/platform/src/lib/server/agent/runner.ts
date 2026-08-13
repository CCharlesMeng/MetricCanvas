import type { McpToolResult } from '@metriccanvas/mcp';
import { abortable, anySignal, isAbortError } from './abort';
import type { AgentMessage, AgentRunner, AgentRunnerOptions } from './types';

/**
 * Agent Runner:多轮模型调用与工具执行的循环。
 *
 * 可靠性边界(#32):
 * - 取消与超时经由 AbortSignal 贯穿模型调用与工具执行——调用方信号与运行
 *   超时信号合并后传给模型提供方(中断进行中的 HTTP 请求),工具执行同样
 *   被该信号打断,不存在"只改状态位不停执行"的假取消。
 * - 最大模型轮次、运行超时与 token 用量上限任一到达即安全停止:不再发起
 *   新的模型调用与工具执行,以携带会话快照的 AgentRunnerError 结束,调用方
 *   可据此让用户重试失败步骤(以快照为基线重新运行)。
 */
export function createAgentRunner(options: AgentRunnerOptions): AgentRunner {
  const maxModelTurns = options.maxModelTurns ?? 12;
  const createTimeoutSignal =
    options.createTimeoutSignal ?? ((timeoutMs: number) => AbortSignal.timeout(timeoutMs));

  return {
    async *run({ messages: initialMessages, signal: cancelSignal }) {
      const messages = structuredClone(initialMessages);
      const timeoutSignal =
        options.timeoutMs !== undefined ? createTimeoutSignal(options.timeoutMs) : undefined;
      const signal = anySignal([cancelSignal, timeoutSignal]);

      const halt = (code: HaltCode, message: string, cause?: unknown): AgentRunnerError =>
        new AgentRunnerError(code, message, messages, cause === undefined ? undefined : { cause });
      const haltIfAborted = (): void => {
        if (timeoutSignal?.aborted) {
          throw halt('RUN_TIMEOUT', `Agent 运行超过 ${options.timeoutMs} 毫秒超时上限`);
        }
        if (cancelSignal?.aborted) {
          throw halt('CANCELLED', 'Agent 运行已被取消', cancelSignal.reason);
        }
      };
      const haltFromAbort = (cause: unknown): AgentRunnerError => {
        if (timeoutSignal?.aborted) {
          return halt('RUN_TIMEOUT', `Agent 运行超过 ${options.timeoutMs} 毫秒超时上限`, cause);
        }
        return halt('CANCELLED', 'Agent 运行已被取消', cause);
      };

      const tools = await options.mcp.listTools();
      const toolCallCounts = new Map<string, number>();
      let totalTokens = 0;

      for (let turn = 0; turn < maxModelTurns; turn++) {
        haltIfAborted();
        let response;
        try {
          response = await options.model.complete({ messages, tools, signal });
        } catch (cause) {
          if (isAbortError(cause)) throw haltFromAbort(cause);
          throw halt('MODEL_FAILED', '模型调用失败', cause);
        }
        const assistantMessage: Extract<AgentMessage, { role: 'assistant' }> = {
          role: 'assistant',
          content: response.content,
          toolCalls: response.toolCalls
        };
        messages.push(assistantMessage);
        if (assistantMessage.content.length > 0) {
          yield { type: 'assistant_message', message: assistantMessage };
        }
        totalTokens += response.usage?.totalTokens ?? 0;
        yield { type: 'turn_completed', turn: turn + 1, usage: response.usage ?? null };

        if (response.toolCalls.length === 0) {
          yield { type: 'completed', messages };
          return;
        }
        // 用量上限只在还要继续消耗时拦截:本轮响应已经产生,直接完成比作废更安全;
        // 要继续执行工具与下一轮模型调用时,先确认预算仍然可用。
        if (options.maxTotalTokens !== undefined && totalTokens > options.maxTotalTokens) {
          throw halt(
            'USAGE_LIMIT_EXCEEDED',
            `Agent 运行累计消耗 ${totalTokens} tokens,超过上限 ${options.maxTotalTokens}`
          );
        }

        for (const call of response.toolCalls) {
          haltIfAborted();
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
              result = await abortable(
                options.mcp.callTool({ name: call.name, arguments: call.input }),
                signal
              );
            } catch (cause) {
              if (isAbortError(cause)) throw haltFromAbort(cause);
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
        `Agent Runner 超过最大模型轮次 ${maxModelTurns}`,
        messages
      );
    }
  };
}

/** Runner 停机分类:上限、超时、取消与模型失败;由 agent/errors.ts 归一化为稳定错误。 */
export type HaltCode =
  | 'MAX_MODEL_TURNS'
  | 'RUN_TIMEOUT'
  | 'USAGE_LIMIT_EXCEEDED'
  | 'CANCELLED'
  | 'MODEL_FAILED';

export class AgentRunnerError extends Error {
  constructor(
    public readonly code: HaltCode,
    message: string,
    /** 停机时刻的会话快照:重试失败步骤以它为基线,已完成的步骤不重做。 */
    public readonly messages: AgentMessage[],
    options?: { cause?: unknown }
  ) {
    super(message, options);
  }
}
