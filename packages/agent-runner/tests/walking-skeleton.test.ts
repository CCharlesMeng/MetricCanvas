import { describe, expect, it } from 'vitest';
import {
  createAgentRunner,
  createScriptedModelProvider,
  type AgentEvent,
  type AgentMessage,
  type McpClient
} from '@metriccanvas/agent-runner';

const pageDocument = {
  schemaVersion: '1.0',
  id: 'sales-total',
  dataSources: {
    sales: {
      fields: {
        gmv: { type: 'number', role: 'metric' }
      },
      source: {
        type: 'query',
        query: { metrics: ['gmv'], aggregation: 'sum' }
      }
    }
  },
  sections: [
    {
      id: 'overview',
      title: '成交总额',
      layout: { type: 'grid', columns: 12 },
      components: [
        {
          id: 'w-gmv',
          type: 'metricCard',
          layout: { span: 3 },
          data: { main: 'sales' },
          props: {
            rows: [{ label: '成交总额', valueField: 'gmv' }]
          }
        }
      ]
    }
  ]
};

describe('Agent Runner 单指标卡 walking skeleton', () => {
  it('先检索并等待页面 id 确认,确认后才校验、保存、预览和申请发布', async () => {
    const calledTools: string[] = [];
    const mcp: McpClient = {
      async listTools() {
        return [
          'search_catalog',
          'validate_page',
          'save_page',
          'preview_page',
          'request_publish'
        ].map((name) => ({
          name,
          description: name,
          inputSchema: { type: 'object', properties: {} }
        }));
      },
      async callTool({ name }) {
        calledTools.push(name);
        const results: Record<string, unknown> = {
          search_catalog: {
            ok: true,
            metadataVersion: 'catalog-v1',
            matches: [{ kind: 'metric', code: 'gmv', name: '成交总额' }]
          },
          validate_page: { ok: true, valid: true, errors: [] },
          save_page: {
            ok: true,
            revision: {
              pageId: 'sales-total',
              revisionId: 'revision-1',
              revisionNumber: 1
            }
          },
          preview_page: {
            ok: true,
            previewUrl: 'https://runtime.example/previews/sales-total/revision-1'
          },
          request_publish: {
            ok: true,
            request: {
              confirmationUrl: 'https://platform.example/publish/request-1/confirm?token=secret'
            }
          }
        };
        return { structuredContent: results[name], isError: false };
      }
    };
    const model = createScriptedModelProvider([
      {
        content: '',
        toolCalls: [
          { id: 'call-search', name: 'search_catalog', input: { query: '成交总额', limit: 10 } }
        ]
      },
      { content: '拟定页面 id 为 sales-total。该 id 保存后不可更改，请确认。', toolCalls: [] },
      {
        content: '',
        toolCalls: [
          { id: 'call-validate', name: 'validate_page', input: { document: pageDocument } }
        ]
      },
      {
        content: '',
        toolCalls: [
          {
            id: 'call-save',
            name: 'save_page',
            input: {
              pageId: 'sales-total',
              baseRevisionId: null,
              document: pageDocument,
              idempotencyKey: 'save-sales-total-r1'
            }
          }
        ]
      },
      {
        content: '',
        toolCalls: [
          {
            id: 'call-preview',
            name: 'preview_page',
            input: { pageId: 'sales-total', revisionId: 'revision-1' }
          }
        ]
      },
      {
        content: '',
        toolCalls: [
          {
            id: 'call-publish',
            name: 'request_publish',
            input: {
              pageId: 'sales-total',
              revisionId: 'revision-1',
              idempotencyKey: 'publish-sales-total-r1'
            }
          }
        ]
      },
      {
        content: 'R1 已保存并可预览。请打开发布确认链接完成人工确认。',
        toolCalls: []
      }
    ]);
    const runner = createAgentRunner({ model, mcp, maxModelTurns: 10 });

    const firstEvents = await collect(
      runner.run({
        messages: [{ role: 'user', content: '创建一个展示成交总额的单指标卡页面' }]
      })
    );
    const firstCompleted = completedMessages(firstEvents);
    expect(calledTools).toEqual(['search_catalog']);
    expect(firstCompleted.at(-1)).toEqual({
      role: 'assistant',
      content: '拟定页面 id 为 sales-total。该 id 保存后不可更改，请确认。',
      toolCalls: []
    });

    const secondEvents = await collect(
      runner.run({
        messages: [...firstCompleted, { role: 'user', content: '确认使用 sales-total' }]
      })
    );
    expect(calledTools).toEqual([
      'search_catalog',
      'validate_page',
      'save_page',
      'preview_page',
      'request_publish'
    ]);
    expect(completedMessages(secondEvents).at(-1)).toEqual({
      role: 'assistant',
      content: 'R1 已保存并可预览。请打开发布确认链接完成人工确认。',
      toolCalls: []
    });
  });
});

async function collect(events: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const collected: AgentEvent[] = [];
  for await (const event of events) collected.push(event);
  return collected;
}

function completedMessages(events: AgentEvent[]): AgentMessage[] {
  const completed = [...events].reverse().find((event) => event.type === 'completed');
  if (!completed || completed.type !== 'completed') throw new Error('Agent Runner 未完成');
  return completed.messages;
}
