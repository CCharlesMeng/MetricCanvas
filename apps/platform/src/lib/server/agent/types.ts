import type { AgentInteraction, McpClient, McpToolResult, ToolDefinition } from '@metriccanvas/mcp';
import type { AnalysisStepEvent } from '../session/step-event';

export type { AgentInteraction };

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

/** 一次模型调用的结构化用量:普通日志只记它,不记 Prompt 与回复正文。 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ModelRequest {
  messages: AgentMessage[];
  tools: ToolDefinition[];
  signal?: AbortSignal;
}

export interface ModelResponse {
  content: string;
  toolCalls: ToolCall[];
  /** 模型提供方回报的用量;scripted fake 等不回报时缺省。 */
  usage?: TokenUsage;
}

export interface ModelProvider {
  complete(request: ModelRequest): Promise<ModelResponse>;
}

export type AgentEvent =
  | { type: 'assistant_message'; message: Extract<AgentMessage, { role: 'assistant' }> }
  | {
      /**
       * 编排步骤事件(#66):问数编排各阶段的结构化结果,契约唯一真源是
       * ../session/step-event.ts;推送通道原样下发并按 ADR-0030 落库。
       * 工具循环 Runner 不产生该事件,生产方是问数编排。
       */
      type: 'step';
      event: AnalysisStepEvent;
    }
  | { type: 'tool_started'; call: ToolCall }
  | {
      type: 'tool_finished';
      call: ToolCall;
      result: McpToolResult;
    }
  | {
      /** 一轮模型调用结束:回报本轮用量,供推送通道聚合成运行审计。 */
      type: 'turn_completed';
      turn: number;
      usage: TokenUsage | null;
    }
  | {
      type: 'interaction_required';
      interaction: AgentInteraction;
      messages: AgentMessage[];
      /**
       * 停机等待交互前已产出的已校验页面文档(如有)。问数编排的部分可答
       * 出口(#67)用它保证能答的部分照常交付;工具循环 Runner 不设置。
       */
      document?: Record<string, unknown> | null;
    }
  | {
      type: 'completed';
      messages: AgentMessage[];
      /**
       * 已通过校验的页面文档(如有)。问数编排的装配出口直接给出文档;
       * 工具循环 Runner 不设置,由通道回退到 validate_page 工具结果推导。
       */
      document?: Record<string, unknown> | null;
    };

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
  toolCallLimits?: Readonly<Record<string, number>>;
  /** 整次运行的超时;超时中止进行中的模型调用与工具执行并安全停止。 */
  timeoutMs?: number;
  /** 整次运行允许消耗的 token 总量上限;超过后不再发起模型调用与工具执行。 */
  maxTotalTokens?: number;
  /**
   * 超时信号工厂,缺省为 AbortSignal.timeout。测试注入手动可控的信号,
   * 使超时路径不依赖真实时间。
   */
  createTimeoutSignal?: (timeoutMs: number) => AbortSignal;
}
