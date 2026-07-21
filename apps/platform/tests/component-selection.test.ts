import { describe, expect, it } from 'vitest';
import type { AgentMessage, ModelResponse } from '@metriccanvas/agent-runner';
import { componentCatalog, validate, type CatalogSnapshot } from '@metriccanvas/page';
import { createComponentSelectingScriptedProvider } from '../src/lib/server/scripted-model.server';

const catalog: CatalogSnapshot = {
  formatVersion: '1.0',
  syncedAt: '2026-07-21T12:00:00.000Z',
  source: 'component-selection-test',
  metrics: [
    {
      code: 'gmv',
      name: '成交总额',
      valueType: 'decimal',
      availableDimensions: ['region', 'channel', 'mtime'],
      availableAggregations: ['sum']
    },
    {
      code: 'order-count',
      name: '订单量',
      valueType: 'integer',
      availableDimensions: ['region', 'channel', 'mtime'],
      availableAggregations: ['sum']
    }
  ],
  dimensions: [
    { code: 'region', name: '区域', cardinality: 3 },
    { code: 'channel', name: '渠道', cardinality: 2 },
    { code: 'mtime', name: '统计时间', cardinality: 5 }
  ]
};

describe('Agent 按诉求选择组件', () => {
  it.each([
    ['展示成交总额趋势', ['reportHeader', 'lineChart']],
    ['比较各区域成交总额并展示渠道占比', ['reportHeader', 'barChart', 'pieChart']],
    ['展示区域成交总额 Top 5 排名', ['reportHeader', 'rankingCard']],
    ['给我区域经营明细表', ['reportHeader', 'table']],
    [
      '创建销售经营概览：展示成交总额和订单量、区域对比、成交趋势、渠道占比和区域明细',
      [
        'reportHeader',
        'metricCard',
        'metricCard',
        'barChart',
        'lineChart',
        'pieChart',
        'table'
      ]
    ]
  ])('诉求“%s”生成匹配的合法页面', async (intent, expectedTypes) => {
    const document = await generatedDocument(intent);
    const sections = document.sections as Array<{ components: Array<{ type: string }> }>;
    const dataSources = document.dataSources as Record<
      string,
      { source: Record<string, unknown> }
    >;

    expect(sections[0]?.components.map((component) => component.type)).toEqual(expectedTypes);
    expect(validate(document, catalog)).toEqual([]);
    expect(Object.values(dataSources).every(({ source }) => source.type === 'query')).toBe(true);
    for (const { source } of Object.values(dataSources)) {
      expect(source).not.toHaveProperty('rows');
    }
  });

  it('组件能力目录覆盖领域 DSL 的全部组件类型', () => {
    expect(componentCatalog.map(({ type }) => type)).toEqual([
      'reportHeader',
      'metricCard',
      'barChart',
      'lineChart',
      'pieChart',
      'table',
      'mapChart',
      'rankingCard',
      'text'
    ]);
  });
});

async function generatedDocument(intent: string): Promise<Record<string, unknown>> {
  const provider = createComponentSelectingScriptedProvider('selection');
  const messages: AgentMessage[] = [{ role: 'user', content: intent }];

  for (let turn = 0; turn < 4; turn += 1) {
    const response = await provider.complete({ messages, tools: [] });
    const call = response.toolCalls[0];
    if (!call) throw new Error('scripted provider 未生成工具调用');
    if (call.name === 'validate_page') {
      return (call.input as { document: Record<string, unknown> }).document;
    }
    if (call.name !== 'search_catalog') {
      throw new Error(`预期 search_catalog 或 validate_page，实际为 ${call.name}`);
    }
    messages.push(assistant(response));
    messages.push({
      role: 'tool',
      toolCallId: call.id,
      name: call.name,
      content: JSON.stringify({ ok: true, metadataVersion: 'catalog-v1', matches: [] }),
      isError: false
    });
  }
  throw new Error('scripted provider 未在限定轮次内生成页面');
}

function assistant(response: ModelResponse): Extract<AgentMessage, { role: 'assistant' }> {
  return { role: 'assistant', content: response.content, toolCalls: response.toolCalls };
}
