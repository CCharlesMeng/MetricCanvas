import { createMockClient } from '@metriccanvas/table-service-client';
import { createStaticSpecProvider } from './spec-provider.js';

/** 应用壳的依赖注入点:切片2(#3)在此按环境切换真实表服务实现 */
export const specProvider = createStaticSpecProvider();
export const tableService = createMockClient();
