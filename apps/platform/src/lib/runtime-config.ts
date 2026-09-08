// 平台与 Canvas 复用同一读取器；注入源仅由参考实现模块读写（ADR-0073）。
export {
  createInjectedDqeGateway,
  installLocalDevRuntimeConfig,
  installRuntimeConfig,
  readRuntimeConfig,
  readPageAssetsBaseUrl,
  MISSING_RUNTIME_CONFIG_MESSAGE,
  type InjectedRuntimeConfig
} from '../../../canvas/src/lib/runtime-config';
