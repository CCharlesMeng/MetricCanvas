export { createDataGateway } from './dispatch';
export type { DataGatewayAdapters } from './dispatch';
export {
  DEFAULT_DQE_ENDPOINT,
  DqeGatewayError,
  createDqeGateway,
  createInMemoryDqeDiagnostics,
  dimensionValuesDqeItem,
  effectiveDqeItem,
  isAbortError
} from './dqe';
export type {
  DqeGatewayConfig,
  DqeDiagnostics,
  DqeDiagnosticRecord,
  DqeDiagnosticStatus,
  InMemoryDqeDiagnostics
} from './dqe';
/** 只出接口:开发期明细的实现在平台侧,不随引擎发布(ADR-0071)。 */
export type { DqeDevDetail } from './dev-detail';
