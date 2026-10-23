/** AI Summary Module 的统一引擎内入口；云宝 Adapter 通过独立入口按需注入。 */
export { default as AiSummary } from './AiSummary.svelte';
export { default as AiSummaryView } from './view/AiSummaryView.svelte';
export { exportSummarySnapshot } from './view/content';
export { AI_SUMMARY_RUNTIME_CONTEXT, aiSummaryInputKey } from './runtime/input';
export type { AiSummaryRuntimeReader } from './runtime/input';
export { createAiSummaryTaskSession } from './runtime/session';
export type { AiSummaryConfig, AiSummaryContextInfo, AiSummaryDataSource, AiSummaryGenerate, AiSummarySnapshot } from './types';
