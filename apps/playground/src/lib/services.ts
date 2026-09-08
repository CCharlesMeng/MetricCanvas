import { createStaticPageRepository } from './page-repository';
import { createInjectedDqeGateway } from './runtime-config';
import type { AiSummaryConfig } from '@metriccanvas/engine/ui';

// 开发工具只读取仓库页面；页面资产服务由平台消费。
export const pageRepository = createStaticPageRepository();

/** inline 页面不会访问网关；query 页面经注入面直连 DQE（ADR-0073）。 */
export const dataGateway = createInjectedDqeGateway();

/** AI 总结未配置时由组件局部显示配置错误，不影响页面其他组件。 */
export const aiSummary: AiSummaryConfig | undefined = import.meta.env.VITE_AI_SUMMARY_ENDPOINT
  ? {
      conversationBaseUrl: import.meta.env.VITE_AI_SUMMARY_ENDPOINT,
      ...(import.meta.env.VITE_AI_SUMMARY_ENV
        ? { env: import.meta.env.VITE_AI_SUMMARY_ENV }
        : {})
    }
  : undefined;
