import { describe, expect, it } from 'vitest';
import type { AgentRunStreamEvent } from '../../src/lib/server/session/step-event';
import {
  applyOutcome,
  applyStreamEvent,
  applyTransportFailure,
  awaitingScopeConfirmation,
  createRunView,
  scopeCards,
  type WorkbenchRunView
} from '../../src/lib/workbench/run-state';
import type { AgentRunOutcomeFrame } from '../../src/lib/workbench/stream-consumer';

/** 用构造的事件序列驱动状态机(生产者 #66 未接上前的确定性验证)。 */
function replay(
  view: WorkbenchRunView,
  events: AgentRunStreamEvent[]
): WorkbenchRunView {
  return events.reduce(applyStreamEvent, view);
}

const SCOPE_CARD_BLOCKED: AgentRunStreamEvent = {
  type: 'scope_card_presented',
  businessDomain: '运营分析',
  metricName: null,
  adHocDefinition: { formula: '消耗量 / 总量', description: '占比,现场生成' },
  timeRange: '2026-07',
  granularity: '月',
  filters: [{ dimension: '区域', values: ['华东'] }],
  blockedOnConfirmation: true
};

const SCOPE_CARD_DIRECT: AgentRunStreamEvent = {
  type: 'scope_card_presented',
  businessDomain: '运营分析',
  metricName: 'Tokens消耗量',
  adHocDefinition: null,
  timeRange: '2026-07',
  granularity: '月',
  filters: [],
  blockedOnConfirmation: false
};

describe('工作台运行状态机:工具调用状态流转', () => {
  it('tool_call_started 呈现进行中,finished 更新为成功', () => {
    let view = createRunView({ runId: 'run-1', question: '各区域消耗' });
    view = applyStreamEvent(view, {
      type: 'tool_call_started',
      toolCallId: 'call-1',
      toolName: 'search_data_context'
    });
    expect(view.steps).toEqual([
      {
        kind: 'tool_call',
        toolCallId: 'call-1',
        toolName: 'search_data_context',
        status: 'running',
        errorCode: null
      }
    ]);

    view = applyStreamEvent(view, {
      type: 'tool_call_finished',
      toolCallId: 'call-1',
      toolName: 'search_data_context',
      status: 'succeeded',
      errorCode: null
    });
    expect(view.steps[0]).toMatchObject({ status: 'succeeded', errorCode: null });
  });

  it('失败的工具调用携带稳定错误码', () => {
    const view = replay(createRunView({ runId: 'run-1', question: null }), [
      { type: 'tool_call_started', toolCallId: 'call-1', toolName: 'validate_page' },
      {
        type: 'tool_call_finished',
        toolCallId: 'call-1',
        toolName: 'validate_page',
        status: 'failed',
        errorCode: 'TOOL_CALL_LIMIT_EXCEEDED'
      }
    ]);
    expect(view.steps[0]).toMatchObject({
      kind: 'tool_call',
      status: 'failed',
      errorCode: 'TOOL_CALL_LIMIT_EXCEEDED'
    });
  });

  it('缺失开始帧的结束事件仍呈现工具结果,不丢状态', () => {
    const view = applyStreamEvent(createRunView({ runId: 'run-1', question: null }), {
      type: 'tool_call_finished',
      toolCallId: 'call-9',
      toolName: 'save_page',
      status: 'succeeded',
      errorCode: null
    });
    expect(view.steps).toHaveLength(1);
    expect(view.steps[0]).toMatchObject({ kind: 'tool_call', status: 'succeeded' });
  });

  it('同名工具的多次调用按 toolCallId 各自流转', () => {
    const view = replay(createRunView({ runId: 'run-1', question: null }), [
      { type: 'tool_call_started', toolCallId: 'a', toolName: 'validate_page' },
      { type: 'tool_call_started', toolCallId: 'b', toolName: 'validate_page' },
      {
        type: 'tool_call_finished',
        toolCallId: 'a',
        toolName: 'validate_page',
        status: 'failed',
        errorCode: 'PAGE_INVALID'
      }
    ]);
    expect(view.steps[0]).toMatchObject({ toolCallId: 'a', status: 'failed' });
    expect(view.steps[1]).toMatchObject({ toolCallId: 'b', status: 'running' });
  });
});

describe('工作台运行状态机:编排步骤时间线', () => {
  it('按 ADR-0037 编排顺序累积步骤并以完成收尾', () => {
    const view = replay(createRunView({ runId: 'run-1', question: '各区域消耗' }), [
      { type: 'run_started', runId: 'run-1', sessionId: 'session-1' },
      {
        type: 'domain_routed',
        question: '各区域消耗',
        routedDomains: ['运营分析'],
        overriddenByUser: false
      },
      {
        type: 'candidates_retrieved',
        candidates: [
          {
            metricName: 'Tokens消耗量',
            businessDomain: '运营分析',
            definitionDifference: '含推理与训练'
          },
          {
            metricName: '计费Tokens量',
            businessDomain: '运营分析',
            definitionDifference: '仅计费部分'
          }
        ],
        selectedMetric: 'Tokens消耗量',
        adHocDefinition: null
      },
      SCOPE_CARD_DIRECT,
      { type: 'execution_started', effectiveQuery: { dsl_list: [] } },
      {
        type: 'rows_ready',
        summary: { rowCount: 7, totalCount: 7, outputFields: ['区域', '消耗量'] }
      },
      {
        type: 'document_ready',
        intent: 'composition',
        components: [{ componentType: 'barChart', pinnedByUser: false }],
        transientPageId: 'ask-transient-8f2c3a1b'
      },
      { type: 'run_completed' }
    ]);

    expect(view.sessionId).toBe('session-1');
    expect(view.status).toBe('completed');
    expect(view.steps.map((step) => step.kind)).toEqual([
      'domain_routed',
      'candidates_retrieved',
      'scope_card',
      'execution_started',
      'rows_ready',
      'document_ready'
    ]);
    expect(awaitingScopeConfirmation(view)).toBe(false);
  });

  it('assistant_replied 追加为对话回复', () => {
    const view = replay(createRunView({ runId: 'run-1', question: null }), [
      { type: 'assistant_replied', content: '已生成页面。' },
      { type: 'assistant_replied', content: '请确认页面 id。' }
    ]);
    expect(view.replies).toEqual(['已生成页面。', '请确认页面 id。']);
  });
});

describe('工作台运行状态机:口径卡与阻塞确认', () => {
  it('未命中阻塞条件的口径卡直接呈现,不等待确认', () => {
    const view = replay(createRunView({ runId: 'run-1', question: null }), [
      SCOPE_CARD_DIRECT,
      { type: 'execution_started', effectiveQuery: {} },
      { type: 'run_completed' }
    ]);
    expect(scopeCards(view)).toHaveLength(1);
    expect(scopeCards(view)[0]).toMatchObject({
      blockedOnConfirmation: false,
      awaitingConfirmation: false
    });
    expect(awaitingScopeConfirmation(view)).toBe(false);
  });

  it('口径卡完整回显生效范围:业务域、临时口径、时间与粒度、筛选', () => {
    const view = applyStreamEvent(
      createRunView({ runId: 'run-1', question: null }),
      SCOPE_CARD_BLOCKED
    );
    expect(scopeCards(view)[0]).toMatchObject({
      businessDomain: '运营分析',
      metricName: null,
      adHocDefinition: { formula: '消耗量 / 总量', description: '占比,现场生成' },
      timeRange: '2026-07',
      granularity: '月',
      filters: [{ dimension: '区域', values: ['华东'] }]
    });
  });

  it('阻塞口径卡后运行停在人工交互:该卡进入等待确认', () => {
    const view = replay(createRunView({ runId: 'run-1', question: null }), [
      SCOPE_CARD_BLOCKED,
      {
        type: 'run_interaction_required',
        interactionId: 'confirm-scope:1',
        kind: 'confirm_scope',
        payload: {}
      }
    ]);
    expect(view.pendingInteraction).toEqual({
      id: 'confirm-scope:1',
      kind: 'confirm_scope',
      payload: {}
    });
    expect(awaitingScopeConfirmation(view)).toBe(true);
    expect(scopeCards(view)[0]?.awaitingConfirmation).toBe(true);
  });

  it('口径卡之后已真实执行时,后续交互不再指向该卡', () => {
    const view = replay(createRunView({ runId: 'run-1', question: null }), [
      SCOPE_CARD_BLOCKED,
      { type: 'execution_started', effectiveQuery: {} },
      {
        type: 'run_interaction_required',
        interactionId: 'confirm-page-id:x',
        kind: 'confirm_page_id',
        payload: { pageId: 'x' }
      }
    ]);
    expect(awaitingScopeConfirmation(view)).toBe(false);
    expect(view.pendingInteraction?.kind).toBe('confirm_page_id');
  });

  it('outcome 帧补齐交互载荷时同样标记阻塞卡等待确认', () => {
    let view = applyStreamEvent(
      createRunView({ runId: 'run-1', question: null }),
      SCOPE_CARD_BLOCKED
    );
    view = applyOutcome(view, {
      status: 'interaction_required',
      messages: [],
      document: null,
      interaction: { id: 'confirm-scope:1', kind: 'confirm_scope', payload: {} },
      error: null
    });
    expect(awaitingScopeConfirmation(view)).toBe(true);
  });
});

describe('工作台运行状态机:终态', () => {
  it('run_failed 以紧邻的 step_failed 呈现四段分类', () => {
    const view = replay(createRunView({ runId: 'run-1', question: null }), [
      {
        type: 'step_failed',
        stage: 'execution',
        code: 'DQE_EXECUTION_FAILED',
        message: '真实执行失败'
      },
      { type: 'run_failed', retryable: true }
    ]);
    expect(view.status).toBe('failed');
    expect(view.failure).toEqual({
      code: 'DQE_EXECUTION_FAILED',
      message: '真实执行失败',
      stage: 'execution',
      retryable: true
    });
    expect(view.steps.map((step) => step.kind)).toEqual(['step_failed']);
  });

  it('run_cancelled 是取消终态,不是失败', () => {
    const view = applyStreamEvent(createRunView({ runId: 'run-1', question: null }), {
      type: 'run_cancelled'
    });
    expect(view.status).toBe('cancelled');
    expect(view.failure).toBeNull();
  });

  it('outcome 帧是终态与续跑基线的最终真源', () => {
    let view = createRunView({ runId: 'run-1', question: null });
    view = applyStreamEvent(view, { type: 'run_completed' });
    const outcome: AgentRunOutcomeFrame = {
      status: 'completed',
      messages: [
        { role: 'user', content: '创建销售概览' },
        { role: 'assistant', content: '已完成', toolCalls: [] }
      ],
      document: { schemaVersion: '5.0', id: 'sales-overview' },
      interaction: null,
      error: null
    };
    view = applyOutcome(view, outcome);
    expect(view.status).toBe('completed');
    expect(view.document).toEqual({ schemaVersion: '5.0', id: 'sales-overview' });
    expect(view.baselineMessages).toEqual(outcome.messages);
  });

  it('outcome 的归一化错误覆盖失败呈现', () => {
    let view = createRunView({ runId: 'run-1', question: null });
    view = applyOutcome(view, {
      status: 'failed',
      messages: [],
      document: null,
      interaction: null,
      error: {
        code: 'USAGE_LIMIT_EXCEEDED',
        message: '用量超限',
        stage: 'generation',
        retryable: false
      }
    });
    expect(view.status).toBe('failed');
    expect(view.failure).toEqual({
      code: 'USAGE_LIMIT_EXCEEDED',
      message: '用量超限',
      stage: 'generation',
      retryable: false
    });
  });

  it('推送连接断开按可重试失败呈现,已到终态的运行不被改写', () => {
    const running = applyTransportFailure(
      createRunView({ runId: 'run-1', question: null }),
      '连接中断'
    );
    expect(running.status).toBe('failed');
    expect(running.failure).toMatchObject({
      code: 'STREAM_DISCONNECTED',
      retryable: true
    });

    const completed = applyStreamEvent(
      createRunView({ runId: 'run-2', question: null }),
      { type: 'run_completed' }
    );
    expect(applyTransportFailure(completed, '连接中断').status).toBe('completed');
  });
});
