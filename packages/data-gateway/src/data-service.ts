import type { DataGateway } from '@metriccanvas/runtime';

/**
 * 数据服务(旧称表服务)适配器:生效查询 → apiQuery 方言翻译、响应归一化、
 * @where 白名单、批量上限分批、超时重试。切片2(#3)实现,对接事实见《中间层分析.md》。
 */
export function createDataServiceGateway(): DataGateway {
  throw new Error('数据服务适配器在切片2(#3)实现,开发期请使用 createMockGateway');
}
