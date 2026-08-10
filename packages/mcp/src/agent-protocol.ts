/**
 * MCP 协议边界类型:一个 Agent 消费本包提供的 MCP server 时看到的形状。
 * `connectInProcessMetricCanvasMcp` 产出满足 `McpClient` 的对象;
 * Agent 循环(apps/platform)只依赖这些类型,不感知 SDK transport 细节。
 */
export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface AgentInteraction {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
}

export interface McpToolResult {
  structuredContent?: unknown;
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
  interaction?: AgentInteraction;
}

export interface McpClient {
  listTools(): Promise<ToolDefinition[]>;
  callTool(request: { name: string; arguments: unknown }): Promise<McpToolResult>;
}
