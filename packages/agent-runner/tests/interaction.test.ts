import { describe, expect, it } from 'vitest';
import {
  createAgentRunner,
  createScriptedModelProvider,
  type AgentEvent,
  type McpClient
} from '@metriccanvas/agent-runner';

describe('Agent Runner 人工交互', () => {
  it('达到单工具调用预算后不再委托，并把结构化预算错误交还模型', async () => {
    const delegatedQueries: string[] = [];
    const mcp: McpClient = {
      async listTools() {
        return [
          {
            name: 'search_catalog',
            inputSchema: { type: 'object', properties: {} }
          }
        ];
      },
      async callTool(request) {
        delegatedQueries.push(
          String((request.arguments as { query?: unknown }).query)
        );
        return { structuredContent: { ok: true, matches: [] } };
      }
    };
    const model = createScriptedModelProvider([
      {
        content: '',
        toolCalls: ['gmv', 'order-count', 'region', 'channel'].map(
          (query, index) => ({
            id: `search-${index + 1}`,
            name: 'search_catalog',
            input: { query }
          })
        )
      },
      {
        content: '我会使用已有结果继续，而不是继续检索。',
        toolCalls: []
      }
    ]);
    const runner = createAgentRunner({
      model,
      mcp,
      toolCallLimits: { search_catalog: 3 }
    });

    const events = await collect(
      runner.run({
        messages: [{ role: 'user', content: '创建销售经营概览' }]
      })
    );

    expect(delegatedQueries).toEqual(['gmv', 'order-count', 'region']);
    const fourthResult = events.find(
      (event) =>
        event.type === 'tool_finished' && event.call.id === 'search-4'
    );
    expect(fourthResult).toMatchObject({
      type: 'tool_finished',
      result: {
        isError: true,
        structuredContent: {
          ok: false,
          error: {
            code: 'TOOL_CALL_LIMIT_EXCEEDED',
            tool: 'search_catalog',
            limit: 3
          }
        }
      }
    });
  });

  it('工具请求人工确认时暂停并返回可继续的会话', async () => {
    const mcp: McpClient = {
      async listTools() {
        return [
          {
            name: 'validate_page',
            inputSchema: { type: 'object', properties: {} }
          }
        ];
      },
      async callTool() {
        return {
          structuredContent: { ok: true, valid: true, errors: [] },
          interaction: {
            id: 'confirm-page-id:sales-total',
            kind: 'confirm_page_id',
            payload: {
              pageId: 'sales-total',
              immutableAfterSave: true
            }
          }
        };
      }
    };
    const model = createScriptedModelProvider([
      {
        content: '',
        toolCalls: [
          {
            id: 'validate-1',
            name: 'validate_page',
            input: { document: { id: 'sales-total' } }
          }
        ]
      }
    ]);
    const runner = createAgentRunner({ model, mcp });

    const events = await collect(
      runner.run({
        messages: [{ role: 'user', content: '创建成交总额页面' }]
      })
    );

    expect(events.map((event) => event.type)).toEqual([
      'tool_started',
      'tool_finished',
      'interaction_required'
    ]);
    const interaction = events[2];
    expect(interaction).toMatchObject({
      type: 'interaction_required',
      interaction: {
        id: 'confirm-page-id:sales-total',
        kind: 'confirm_page_id',
        payload: {
          pageId: 'sales-total',
          immutableAfterSave: true
        }
      }
    });
    if (interaction.type !== 'interaction_required') {
      throw new Error('预期 Agent Runner 暂停等待人工交互');
    }
    expect(interaction.messages.at(-1)).toMatchObject({
      role: 'tool',
      name: 'validate_page',
      isError: false
    });
  });
});

async function collect(events: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const collected: AgentEvent[] = [];
  for await (const event of events) collected.push(event);
  return collected;
}
