export { createDataGateway } from '@metriccanvas/data-execution/dqe';
export type { DataGatewayAdapters } from '@metriccanvas/data-execution/dqe';
export {
  DEFAULT_DQE_ENDPOINT,
  DqeGatewayError,
  createDqeGateway,
  createInMemoryDqeDiagnostics,
  dimensionValuesDqeItem,
  effectiveDqeItem,
  isAbortError
} from '@metriccanvas/data-execution/dqe';
export type {
  DqeGatewayConfig,
  DqeDiagnostics,
  DqeDiagnosticRecord,
  DqeDiagnosticStatus,
  InMemoryDqeDiagnostics
} from '@metriccanvas/data-execution/dqe';
/** 只出接口:开发期明细的实现在平台侧,不随引擎发布(ADR-0071)。 */
export type { DqeDevDetail } from '@metriccanvas/data-execution/dqe';
