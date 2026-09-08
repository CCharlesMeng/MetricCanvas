// 平台与参考应用共用私有配置模块；每次请求读取同一注入源（ADR-0073）。
export {
  createInjectedDqeGateway,
  installLocalDevRuntimeConfig,
  installRuntimeConfig,
  readRuntimeConfig,
  readPageAssetsBaseUrl,
  MISSING_RUNTIME_CONFIG_MESSAGE,
  type InjectedRuntimeConfig
} from '@metriccanvas/application-runtime';
