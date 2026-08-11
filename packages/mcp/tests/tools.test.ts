import { describe, expect, it } from 'vitest';
import { createMemoryPageLifecycle } from '@metriccanvas/page-lifecycle';
import { createMemoryTemplateLibrary } from '@metriccanvas/template-library';
import {
  connectInProcessMetricCanvasMcp,
  createDataContextSearch,
  createMetricCanvasMcpServer,
  PAGE_BUILDING_PROMPT,
  type DataContextSnapshot
} from '../src';

const snapshot: DataContextSnapshot = {
  formatVersion: '1.0',
  id: 'test-context',
  version: 'context-v1',
  generatedAt: '2026-07-31T00:00:00.000Z',
  source: 'test',
  executionEnvironments: [{
    id: 'dqe-test',
    name: '测试 DQE',
    language: 'dqe',
    endpointRef: 'test',
    schemas: [{
      id: 'sales',
      name: '销售',
      description: '销售分析',
      objects: [{
        id: 'orders',
        name: '订单',
        kind: 'dataset',
        description: '订单汇总',
        fields: [{
          name: '成交总额',
          type: 'number',
          description: '订单成交金额',
          aliases: ['GMV'],
          roleHints: ['measure'],
          nullable: false,
          sensitive: false
        }]
      }],
      relationships: [],
      verifiedQueries: []
    }],
    constraints: {
      readOnly: true,
      maxRows: 1000,
      maxColumns: 20,
      maxQueriesPerBatch: 5,
      timeoutMs: 30000
    },
    security: { scope: 'test' }
  }]
};

function server() {
  const dataContext = createDataContextSearch({
    current: async () => snapshot
  });
  const lifecycle = createMemoryPageLifecycle({
    dataContext: { current: async () => ({ version: snapshot.version }) }
  });
  const templates = createMemoryTemplateLibrary({ pageLifecycle: lifecycle });
  return createMetricCanvasMcpServer({
    dataContext,
    lifecycle,
    templates,
    context: () => ({ actorId: 'tester', clientId: 'test' }),
    previewUrl: ({ pageId, revisionId }) => `/pages/${pageId}?revision=${revisionId}`
  });
}

describe('v4 页面搭建 MCP', () => {
  it('只暴露数据上下文与页面生命周期工具，不再暴露旧指标工具', async () => {
    const connection = await connectInProcessMetricCanvasMcp(server());
    const names = (await connection.client.listTools()).map((tool) => tool.name);
    expect(names).toContain('search_data_context');
    expect(names).toContain('validate_page');
    expect(names).not.toContain('search_catalog');
    expect(names).not.toContain('record_metric_gap');
    await connection.close();
  });

  it('检索 Schema 元数据并返回数据上下文版本', async () => {
    const connection = await connectInProcessMetricCanvasMcp(server());
    const result = await connection.client.callTool({
      name: 'search_data_context',
      arguments: { query: 'GMV', limit: 5 }
    });
    expect(result.structuredContent).toMatchObject({
      ok: true,
      dataContextVersion: 'context-v1',
      matches: [{ kind: 'field', field: { name: '成交总额' } }]
    });
    await connection.close();
  });

  it('Prompt 描述 v4、inline、DQE 和 AI 总结边界', () => {
    expect(PAGE_BUILDING_PROMPT).toContain('inline');
    expect(PAGE_BUILDING_PROMPT).toContain('DQE');
    expect(PAGE_BUILDING_PROMPT).toContain('aiSummary');
    expect(PAGE_BUILDING_PROMPT).toContain('props.title');
    expect(PAGE_BUILDING_PROMPT).toContain('摘要默认使用 text');
    expect(PAGE_BUILDING_PROMPT).toContain('明确声明运行时 SSE');
    expect(PAGE_BUILDING_PROMPT).not.toContain('search_catalog');
    expect(PAGE_BUILDING_PROMPT).not.toContain('METRIC_GAP');
    expect(PAGE_BUILDING_PROMPT).not.toContain('NA客户数');
    expect(PAGE_BUILDING_PROMPT).not.toContain('客户级别');
  });
});
