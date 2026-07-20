import { createMockGateway } from '@metriccanvas/data-gateway';
import { createStaticPageRepository } from './page-repository';

/** 应用壳的依赖注入点:切片2(#3)在此按环境切换数据服务真实适配器 */
export const pageRepository = createStaticPageRepository();
export const dataGateway = createMockGateway();
