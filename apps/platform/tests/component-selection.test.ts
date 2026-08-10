import { describe, expect, it } from 'vitest';
import type { AgentMessage } from '../src/lib/server/agent/types';
import { validate } from '@metriccanvas/page';
import { createComponentSelectingScriptedProvider } from '../src/lib/server/scripted-model.server';

describe('离线页面搭建模型', () => {
  it('静态诉求生成 v4 inline 页面并进入校验', async () => {
    const provider = createComponentSelectingScriptedProvider('test');
    const first = await provider.complete({
      messages: [{ role: 'user', content: '创建一张静态经营概览' }],
      tools: []
    });
    expect(first.toolCalls?.[0]?.name).toBe('validate_page');
    const document = (first.toolCalls?.[0]?.input as Record<string, unknown>)?.document;
    expect(validate(document)).toEqual([]);
    expect(document).toMatchObject({ schemaVersion: '4.0' });
  });

  it('动态诉求先检索数据上下文', async () => {
    const provider = createComponentSelectingScriptedProvider('test');
    const response = await provider.complete({
      messages: [
        { role: 'system', content: 'METRICCANVAS_AUTHORING_MODE' },
        { role: 'user', content: '创建动态 DQE 客户分析' }
      ] satisfies AgentMessage[],
      tools: []
    });
    expect(response.toolCalls?.[0]?.name).toBe('search_data_context');
  });

  it('动态诉求只使用数据上下文返回的已验证查询生成页面', async () => {
    const provider = createComponentSelectingScriptedProvider('test');
    const response = await provider.complete({
      messages: [
        { role: 'system', content: 'METRICCANVAS_AUTHORING_MODE' },
        { role: 'user', content: '创建动态 DQE 库存分析' },
        {
          role: 'tool',
          toolCallId: 'search-data-context-1',
          name: 'search_data_context',
          isError: false,
          content: JSON.stringify({
            ok: true,
            dataContextVersion: 'inventory-v1',
            matches: [
              {
                kind: 'verifiedQuery',
                environmentId: 'inventory-dqe',
                schemaId: 'inventory',
                query: {
                  id: 'stock-by-warehouse',
                  question: '按仓库查看库存数量',
                  description: '仓库库存汇总',
                  language: 'dqe',
                  body: {
                    dsl_list: [
                      {
                        output_dims: ['仓库名称'],
                        output_metrics: ['库存数量'],
                        filter: { dims: [], metrics: [] },
                        order: {}
                      }
                    ]
                  },
                  resultFields: [
                    {
                      name: '仓库名称',
                      type: 'string',
                      role: 'dimension',
                      nullable: false
                    },
                    {
                      name: '库存数量',
                      type: 'number',
                      role: 'measure',
                      unit: '件',
                      nullable: false
                    }
                  ]
                }
              }
            ]
          })
        }
      ] satisfies AgentMessage[],
      tools: []
    });

    expect(response.toolCalls?.[0]?.name).toBe('validate_page');
    const document = (response.toolCalls?.[0]?.input as Record<string, unknown>)
      ?.document;
    expect(validate(document)).toEqual([]);
    expect(JSON.stringify(document)).toContain('仓库名称');
    expect(JSON.stringify(document)).toContain('库存数量');
    expect(JSON.stringify(document)).not.toContain('NA客户数');
  });

  it('数据上下文没有已验证查询时不猜测 DQE 页面', async () => {
    const provider = createComponentSelectingScriptedProvider('test');
    const response = await provider.complete({
      messages: [
        { role: 'system', content: 'METRICCANVAS_AUTHORING_MODE' },
        { role: 'user', content: '创建动态 DQE 库存分析' },
        {
          role: 'tool',
          toolCallId: 'search-data-context-1',
          name: 'search_data_context',
          isError: false,
          content: JSON.stringify({
            ok: true,
            dataContextVersion: 'inventory-v1',
            matches: []
          })
        }
      ] satisfies AgentMessage[],
      tools: []
    });

    expect(response.toolCalls).toEqual([]);
    expect(response.content).toContain('没有返回可执行的已验证查询');
  });
});
