import { describe, expect, it } from 'vitest';
import { isWorkbenchAgentRequest } from '../../src/lib/server/agent/workbench-request';
import {
  buildAgentStreamRequestBody,
  pinComponent,
  pinnedComponentType,
  unpinComponent,
  type PinnedComponentChoice
} from '../../src/lib/workbench/agent-request';

describe('工作台 Agent 流式请求构造', () => {
  it('构造出的请求体通过服务端工作台请求契约校验', () => {
    const body = buildAgentStreamRequestBody({
      runId: 'run-1',
      messages: [{ role: 'user', content: '创建销售概览' }],
      confirmedPageIds: ['sales-overview'],
      draft: { schemaVersion: '5.0', id: 'sales-overview' },
      pinnedComponents: [{ dataSourceId: 'region-consumption', componentType: 'barChart' }]
    });

    expect(isWorkbenchAgentRequest(body)).toBe(true);
    expect(body).toMatchObject({
      runId: 'run-1',
      confirmations: [{ kind: 'page_id', pageId: 'sales-overview' }],
      draft: { schemaVersion: '5.0', id: 'sales-overview' }
    });
  });

  it('钉住状态随请求传回,取数单元维度一条一形态', () => {
    const body = buildAgentStreamRequestBody({
      runId: 'run-2',
      messages: [{ role: 'user', content: '改成折线' }],
      confirmedPageIds: [],
      draft: null,
      pinnedComponents: [
        { dataSourceId: 'trend', componentType: 'lineChart' },
        { dataSourceId: 'region', componentType: 'table' }
      ]
    });
    expect(body.pinnedComponents).toEqual([
      { dataSourceId: 'trend', componentType: 'lineChart' },
      { dataSourceId: 'region', componentType: 'table' }
    ]);
  });

  it('无钉住、无工作副本时不携带空字段', () => {
    const body = buildAgentStreamRequestBody({
      runId: 'run-3',
      messages: [{ role: 'user', content: '你好' }],
      confirmedPageIds: [],
      draft: null,
      pinnedComponents: []
    });
    expect('pinnedComponents' in body).toBe(false);
    expect('draft' in body).toBe(false);
    expect(isWorkbenchAgentRequest(body)).toBe(true);
  });
});

describe('组件形态钉住状态', () => {
  const pinned: PinnedComponentChoice[] = [
    { dataSourceId: 'trend', componentType: 'lineChart' }
  ];

  it('钉住后可查询;同一取数单元重复钉住覆盖为最新选择', () => {
    expect(pinnedComponentType(pinned, 'trend')).toBe('lineChart');
    const repinned = pinComponent(pinned, {
      dataSourceId: 'trend',
      componentType: 'barChart'
    });
    expect(repinned).toEqual([{ dataSourceId: 'trend', componentType: 'barChart' }]);
  });

  it('不同取数单元的钉住互不影响', () => {
    const both = pinComponent(pinned, {
      dataSourceId: 'region',
      componentType: 'table'
    });
    expect(pinnedComponentType(both, 'trend')).toBe('lineChart');
    expect(pinnedComponentType(both, 'region')).toBe('table');
  });

  it('取消钉住只移除对应单元', () => {
    const both = pinComponent(pinned, {
      dataSourceId: 'region',
      componentType: 'table'
    });
    expect(unpinComponent(both, 'trend')).toEqual([
      { dataSourceId: 'region', componentType: 'table' }
    ]);
    expect(pinnedComponentType(unpinComponent(both, 'trend'), 'trend')).toBeNull();
  });
});
