import type { AnalysisIntent as VisualizeIntent } from '@metriccanvas/mcp';
import type { AnalysisIntent } from '../session/step-event';

/** 步骤事件意图词汇 → 组件推荐意图词汇的唯一映射。 */
export const ANALYSIS_INTENT_TO_VISUALIZE = {
  comparison: 'comparison',
  trend: 'trend',
  composition: 'proportion',
  ranking: 'ranking',
  detail: 'detail',
  single_value: 'summary'
} as const satisfies Record<AnalysisIntent, VisualizeIntent>;
