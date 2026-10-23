export { default as RuntimeView } from './RuntimeView.svelte';
export {
  configurationError,
  isDataGateway
} from './types';
export type {
  AiSummaryConfig,
  RuntimeConfigurationError,
  RuntimeConfigurationErrorCode,
  NavigationInputContract,
  RuntimeNavigation,
  RuntimeNavigationTarget,
  RuntimeViewEvent
} from './types';

export type {DisplayInputsSource,DisplayInputsSnapshot,DataPeriodFact} from '@metriccanvas/page/internal';

export { createAiSummaryTaskSession, aiSummaryInputKey } from './ai-summary';
export type { AiSummaryGenerate, AiSummaryContextInfo, AiSummaryDataSource } from './ai-summary';
