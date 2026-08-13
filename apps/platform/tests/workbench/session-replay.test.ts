import { describe, expect, it } from 'vitest';
import {
  sessionReplayView,
  type RecordedSessionPayload
} from '../../src/lib/workbench/session-replay';

/**
 * 会话回放视图(#69):落库事件流经 run-state 同一状态机物化为
 * 只读已完成时间线,刷新后按会话 id 复看全部步骤。
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

  it('回放是只读视图:没有续跑基线与页面文档(outcome 帧不落库,ADR-0030)', () => {
    const view = sessionReplayView(SESSION);
    expect(view.baselineMessages).toBeNull();
    expect(view.document).toBeNull();
    expect(view.pendingInteraction).toBeNull();
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
      ]
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
