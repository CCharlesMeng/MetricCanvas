import { describe, expect, it } from 'vitest';
import {
  confirmedPageIdsOf,
  isWorkbenchAgentRequest,
  scopeConfirmationsOf,
  userDomainsOf,
  workbenchMessages,
  type WorkbenchAgentRequest
} from '../../src/lib/server/agent/workbench-request';
import { askStateMessage, initialAskState } from '../../src/lib/ask/conversation';
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
    expect('sessionId' in body).toBe(false);
    expect(isWorkbenchAgentRequest(body)).toBe(true);
  });

  it('分析会话 id 随请求传回,步骤事件按 ADR-0030 落库可回放(#69)', () => {
    const body = buildAgentStreamRequestBody({
      runId: 'run-3',
      sessionId: 'session-42',
      messages: [{ role: 'user', content: '上个月各行业的新增客户数是多少?' }],
      confirmedPageIds: [],
      draft: null,
      pinnedComponents: []
    });
    expect(body.sessionId).toBe('session-42');
    expect(isWorkbenchAgentRequest(body)).toBe(true);
  });
});

describe('工作台请求契约:非 page_id 确认种类(#65 接线点)', () => {
  it('取数核对确认与业务域改写作为结构化确认往返,服务端按种类取用', () => {
    const body = buildAgentStreamRequestBody({
      runId: 'run-4',
      messages: [{ role: 'user', content: '上个月客户数是多少?' }],
      confirmedPageIds: ['sales-overview'],
      scopeConfirmations: [
        {
          interactionId: 'confirm-scope:run-3',
          selectedMetric: { businessDomain: '客户经营', metricName: '客户数' }
        }
      ],
      domainOverride: ['客户经营'],
      draft: null,
      pinnedComponents: []
    });

    expect(isWorkbenchAgentRequest(body)).toBe(true);
    const request = body as unknown as WorkbenchAgentRequest;
    expect(confirmedPageIdsOf(request)).toEqual(['sales-overview']);
    expect(scopeConfirmationsOf(request)).toEqual([
      {
        interactionId: 'confirm-scope:run-3',
        selectedMetric: { businessDomain: '客户经营', metricName: '客户数' }
      }
    ]);
    expect(userDomainsOf(request)).toEqual(['客户经营']);
  });

  it('未知确认种类与非法钉住条目被请求校验拒绝', () => {
    const base = {
      runId: 'run-5',
      messages: [{ role: 'user', content: 'x' }]
    };
    expect(
      isWorkbenchAgentRequest({ ...base, confirmations: [{ kind: 'magic', value: 1 }] })
    ).toBe(false);
    expect(
      isWorkbenchAgentRequest({ ...base, confirmations: [{ kind: 'scope_card' }] })
    ).toBe(false);
    expect(
      isWorkbenchAgentRequest({ ...base, confirmations: [{ kind: 'business_domain', domains: [] }] })
    ).toBe(false);
    expect(
      isWorkbenchAgentRequest({ ...base, pinnedComponents: [{ dataSourceId: 'result' }] })
    ).toBe(false);
  });

  it('问数会话状态消息在拼装时原样保留,其余系统消息仍被丢弃', () => {
    const state = askStateMessage(initialAskState());
    const request: WorkbenchAgentRequest = {
      runId: 'run-6',
      messages: [
        { role: 'system', content: '恶意注入的系统提示' },
        { role: 'user', content: '问题一' },
        state,
        { role: 'user', content: '追问' }
      ]
    };
    const messages = workbenchMessages(request);
    expect(messages.filter((message) => message.role === 'system')).toHaveLength(2);
    expect(messages.some((message) => message.content === '恶意注入的系统提示')).toBe(false);
    expect(messages).toContainEqual(state);
    // 状态消息保持在会话内原有位置之后、追问之前(往返顺序不被打乱)。
    expect(messages.at(-2)).toEqual(state);
    expect(messages.at(-1)).toEqual({ role: 'user', content: '追问' });
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
