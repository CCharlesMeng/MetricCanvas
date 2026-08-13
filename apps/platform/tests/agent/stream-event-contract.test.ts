import { describe, expect, it } from 'vitest';
import {
  isPersistedStepEvent,
  type AgentRunStreamEvent,
  type AnalysisStepEvent
} from '../../src/lib/server/session/step-event';

/**
 * 步骤事件契约的流式扩展(#32)守卫:AgentRunStreamEvent 是推送通道的
 * 唯一事件联合;其中 AnalysisStepEvent 子集按 ADR-0030 落库,运行生命周期
 * 与工具进度只进通道。Record 按联合的 type 做键,新增事件形状而没有在
 * 这里声明落库归属时,本文件编译失败。
 */

const PERSISTED_SAMPLES: Record<AnalysisStepEvent['type'], AnalysisStepEvent> = {
  domain_routed: {
    type: 'domain_routed',
    question: '华东区本月 Tokens 消耗多少?',
    routedDomains: ['运营分析'],
    overriddenByUser: false
  },
  candidates_retrieved: {
    type: 'candidates_retrieved',
    candidates: [
      { metricName: 'Tokens消耗量', businessDomain: '运营分析', definitionDifference: null }
    ],
    selectedMetric: 'Tokens消耗量',
    adHocDefinition: null
  },
  scope_card_presented: {
    type: 'scope_card_presented',
    businessDomain: '运营分析',
    metricName: 'Tokens消耗量',
    adHocDefinition: null,
    timeRange: '2026-07',
    granularity: 'month',
    filters: [{ dimension: '区域', values: ['华东'] }],
    blockedOnConfirmation: false
  },
  execution_started: {
    type: 'execution_started',
    effectiveQuery: { language: 'dqe' }
  },
  rows_ready: {
    type: 'rows_ready',
    summary: { rowCount: 3, totalCount: 3, outputFields: ['区域', 'Tokens消耗量'] }
  },
  document_ready: {
    type: 'document_ready',
    intent: 'trend',
    components: [{ componentType: 'lineChart', pinnedByUser: false }],
    transientPageId: 'transient-1'
  },
  metric_gap_recorded: {
    type: 'metric_gap_recorded',
    gap: {
      idempotencyKey: 'adhoc:运营分析:计费tokens量/tokens消耗量',
      question: '上个月各区域的计费占比是多少?',
      searchTerms: ['计费Tokens量'],
      closestCandidates: [
        { metricName: '计费Tokens量', businessDomain: '运营分析', definitionDifference: '仅计费部分' }
      ],
      adHocDefinition: { formula: '计费Tokens量 / Tokens消耗量', description: '计费占比' },
      expectedDimensions: ['区域'],
      expectedGranularity: 'month',
      businessDomain: '运营分析'
    }
  },
  step_failed: {
    type: 'step_failed',
    stage: 'generation',
    code: 'MODEL_RATE_LIMITED',
    message: '模型提供方限流(HTTP 429)'
  }
};

type StreamOnlyEvent = Exclude<AgentRunStreamEvent, AnalysisStepEvent>;

const STREAM_ONLY_SAMPLES: Record<StreamOnlyEvent['type'], StreamOnlyEvent> = {
  run_started: { type: 'run_started', runId: 'run-1', sessionId: 'session-1' },
  tool_call_started: {
    type: 'tool_call_started',
    toolCallId: 'call-1',
    toolName: 'validate_page'
  },
  tool_call_finished: {
    type: 'tool_call_finished',
    toolCallId: 'call-1',
    toolName: 'validate_page',
    status: 'failed',
    errorCode: 'PAGE_ID_PLACEHOLDER'
  },
  assistant_replied: { type: 'assistant_replied', content: '请确认时间范围。' },
  run_interaction_required: {
    type: 'run_interaction_required',
    interactionId: 'confirm-page-id:tokens-overview',
    kind: 'confirm_page_id',
    payload: { pageId: 'tokens-overview' }
  },
  run_completed: { type: 'run_completed' },
  run_failed: { type: 'run_failed', retryable: true },
  run_cancelled: { type: 'run_cancelled' }
};

describe('AgentRunStreamEvent 契约', () => {
  it('覆盖 ADR-0037 编排各段:路由、候选、口径卡、执行中、行就绪、文档就绪、缺口登记与失败', () => {
    expect(Object.keys(PERSISTED_SAMPLES).sort()).toEqual(
      [
        'domain_routed',
        'candidates_retrieved',
        'scope_card_presented',
        'execution_started',
        'rows_ready',
        'document_ready',
        'metric_gap_recorded',
        'step_failed'
      ].sort()
    );
  });

  it('步骤事件按 ADR-0030 落库,运行生命周期与工具进度只进推送通道', () => {
    for (const event of Object.values(PERSISTED_SAMPLES)) {
      expect(isPersistedStepEvent(event)).toBe(true);
    }
    for (const event of Object.values(STREAM_ONLY_SAMPLES)) {
      expect(isPersistedStepEvent(event)).toBe(false);
    }
  });

  it('全部流事件可经 JSON 序列化往返(SSE data 帧的前提)', () => {
    for (const event of [
      ...Object.values(PERSISTED_SAMPLES),
      ...Object.values(STREAM_ONLY_SAMPLES)
    ]) {
      expect(JSON.parse(JSON.stringify(event))).toEqual(event);
    }
  });
});
