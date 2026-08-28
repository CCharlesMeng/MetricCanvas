import { describe, expect, it } from 'vitest';
import { ASK_STATE_PREFIX, initialAskState } from '../../src/lib/ask/conversation';
import {
  sessionReplayView,
  type RecordedSessionPayload
} from '../../src/lib/workbench/session-replay';

/**
 * 会话回放视图(#69):落库事件流经 run-state 同一状态机物化为
 * 时间线;新会话再用最新检查点恢复临时页面态与续跑基线。
 */

const SESSION: RecordedSessionPayload = {
  sessionId: 'session-1',
  question: '上个月各行业的新增客户数是多少?',
  events: [
    {
      sequence: 1,
      occurredAt: '2026-08-13T08:00:00.000Z',
      event: {
        type: 'domain_routed',
        question: '上个月各行业的新增客户数是多少?',
        routedDomains: ['客户经营'],
        overriddenByUser: false
      }
    },
    {
      sequence: 2,
      occurredAt: '2026-08-13T08:00:01.000Z',
      event: {
        type: 'scope_card_presented',
        businessDomain: '客户经营',
        metricName: '新增客户数',
        adHocDefinition: null,
        timeRange: '2026-07 ~ 2026-07',
        granularity: 'month',
        filters: [],
        blockedOnConfirmation: false
      }
    },
    {
      sequence: 3,
      occurredAt: '2026-08-13T08:00:02.000Z',
      event: {
        type: 'rows_ready',
        summary: { rowCount: 5, totalCount: 5, outputFields: ['行业', '新增客户数'] }
      }
    },
    {
      sequence: 4,
      occurredAt: '2026-08-13T08:00:03.000Z',
      event: {
        type: 'document_ready',
        intent: 'comparison',
        components: [{ componentType: 'barChart', pinnedByUser: false }],
        transientPageId: 'ask-transient-12345678'
      }
    }
  ]
};

describe('会话回放视图', () => {
  it('全部落库步骤按顺序物化为时间线,状态为已完成', () => {
    const view = sessionReplayView(SESSION);
    expect(view.sessionId).toBe('session-1');
    expect(view.question).toBe('上个月各行业的新增客户数是多少?');
    expect(view.status).toBe('completed');
    expect(view.steps.map((step) => step.kind)).toEqual([
      'domain_routed',
      'scope_card',
      'rows_ready',
      'document_ready'
    ]);
  });

  it('历史会话没有检查点时仍兼容只读步骤回放', () => {
    const view = sessionReplayView(SESSION);
    expect(view.baselineMessages).toBeNull();
    expect(view.document).toBeNull();
    expect(view.pendingInteraction).toBeNull();
  });

  it('检查点恢复最新临时页面态、结构化续跑基线与待确认交互', () => {
    const askState = {
      ...initialAskState(),
      transientPageId: 'ask-transient-12345678'
    };
    const view = sessionReplayView({
      ...SESSION,
      checkpoint: {
        formatVersion: 1,
        version: 3,
        basedOnEventSequence: 4,
        runId: 'run-3',
        status: 'interaction_required',
        document: { schemaVersion: '5.3', id: 'ask-transient-12345678' },
        contentHash: 'hash',
        askState,
        pinnedComponents: [{ dataSourceId: 'result', componentType: 'barChart' }],
        interaction: {
          id: 'confirm-scope:1',
          kind: 'confirm_scope_card',
          payload: { interactionId: 'confirm-scope:1' }
        },
        failure: null,
        updatedAt: '2026-08-13T08:00:04.000Z'
      }
    });
    expect(view.status).toBe('interaction_required');
    expect(view.document).toEqual({
      schemaVersion: '5.3',
      id: 'ask-transient-12345678'
    });
    expect(view.baselineMessages).toEqual([
      { role: 'system', content: ASK_STATE_PREFIX + JSON.stringify(askState) }
    ]);
    expect(view.pendingInteraction?.kind).toBe('confirm_scope_card');
  });

  it('含失败步骤的会话同样可回放,四段分类原样呈现', () => {
    const view = sessionReplayView({
      sessionId: 'session-2',
      question: '上个月的平均客单价是多少?',
      events: [
        {
          sequence: 1,
          occurredAt: '2026-08-13T08:00:00.000Z',
          event: {
            type: 'step_failed',
            stage: 'discovery',
            code: 'OUT_OF_SEMANTIC_SURFACE',
            message: '语义面内没有价格或金额类指标'
          }
        }
      ],
      checkpoint: {
        formatVersion: 1,
        version: 1,
        basedOnEventSequence: 1,
        runId: 'run-failed',
        status: 'failed',
        document: null,
        contentHash: 'hash',
        askState: initialAskState(),
        pinnedComponents: [],
        interaction: null,
        failure: {
          code: 'OUT_OF_SEMANTIC_SURFACE',
          message: '语义面内没有价格或金额类指标',
          stage: 'discovery',
          retryable: false
        },
        updatedAt: '2026-08-13T08:00:01.000Z'
      }
    });
    expect(view.status).toBe('failed');
    expect(view.failure).toEqual({
      code: 'OUT_OF_SEMANTIC_SURFACE',
      message: '语义面内没有价格或金额类指标',
      stage: 'discovery',
      retryable: false
    });
    expect(view.steps).toEqual([
      {
        kind: 'step_failed',
        stage: 'discovery',
        code: 'OUT_OF_SEMANTIC_SURFACE',
        message: '语义面内没有价格或金额类指标'
      }
    ]);
  });
});
