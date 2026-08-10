import type { AgentInteraction, McpClient, McpToolResult, ToolDefinition } from '@metriccanvas/mcp';

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
  toolCallLimits?: Readonly<Record<string, number>>;
}
