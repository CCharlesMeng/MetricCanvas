import { createStaticPageRepository } from './page-repository';
import { createPlaygroundDqeGateway } from './runtime-config';

// 开发工具只读取仓库页面；页面资产服务由平台消费。
export const pageRepository = createStaticPageRepository();

/** inline 页面不会访问网关；query 页面经注入面直连 DQE（ADR-0073）。 */
export const dataGateway = createPlaygroundDqeGateway();

/** 云宝助手单文件注入；当前实现明确标记为本地 mock。 */
export { aiSummary } from '@metriccanvas/engine/ui/ai-summary/yunbao-assistant';
