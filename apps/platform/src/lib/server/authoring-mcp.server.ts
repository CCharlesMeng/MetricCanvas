import type { McpClient } from '@metriccanvas/agent-runner';

const AUTHORING_TOOLS = new Set([
  'search_catalog',
  'search_templates',
  'list_pages',
  'get_page',
  'validate_page'
]);

/**
 * 页面搭建工作台只让 Agent 生成和校验未保存工作副本。
 * 保存页面修订、精确预览和发布由显式界面动作调用页面生命周期。
 */
export function createAuthoringMcpClient(client: McpClient): McpClient {
  return {
    async listTools() {
      return (await client.listTools()).filter((tool) => AUTHORING_TOOLS.has(tool.name));
    },
    callTool(request) {
      if (!AUTHORING_TOOLS.has(request.name)) {
        return Promise.resolve({
          isError: true,
          structuredContent: {
            ok: false,
            error: {
              code: 'AUTHORING_TOOL_NOT_ALLOWED',
              message: `页面搭建 Agent 不能调用写工具 ${request.name}`
            }
          }
        });
      }
      return client.callTool(request);
    }
  };
}
