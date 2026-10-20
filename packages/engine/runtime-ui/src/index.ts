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
