import { describe, expect, it } from 'vitest';
import type { McpClient } from '@metriccanvas/agent-runner';
import { createAuthoringMcpClient } from '../src/lib/server/authoring-mcp.server';

describe('页面搭建工作台 authoring MCP adapter', () => {
  it('只向 Agent 暴露检索、读取和校验工具，写工具不能调用', async () => {
    const delegated: string[] = [];
    const client: McpClient = {
      async listTools() {
        return [
          { name: 'search_catalog', inputSchema: {} },
          { name: 'list_pages', inputSchema: {} },
          { name: 'get_page', inputSchema: {} },
          { name: 'validate_page', inputSchema: {} },
          { name: 'save_page', inputSchema: {} },
          { name: 'preview_page', inputSchema: {} },
          { name: 'request_publish', inputSchema: {} }
        ];
      },
      async callTool(request) {
        delegated.push(request.name);
        return { structuredContent: { ok: true } };
      }
    };
    const authoring = createAuthoringMcpClient(client);

    expect((await authoring.listTools()).map((tool) => tool.name)).toEqual([
      'search_catalog',
      'list_pages',
      'get_page',
      'validate_page'
    ]);
    await expect(
      authoring.callTool({ name: 'save_page', arguments: {} })
    ).resolves.toMatchObject({
      isError: true,
      structuredContent: {
        error: { code: 'AUTHORING_TOOL_NOT_ALLOWED' }
      }
    });
    expect(delegated).toEqual([]);

    await authoring.callTool({ name: 'validate_page', arguments: { document: {} } });
    expect(delegated).toEqual(['validate_page']);
  });
});
