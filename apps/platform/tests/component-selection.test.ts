import { describe, expect, it } from 'vitest';
import type { AgentMessage } from '@metriccanvas/agent-runner';
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
});
