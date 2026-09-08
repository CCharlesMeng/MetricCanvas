import { createStaticPageRepository } from './page-repository';
import { createPlatformPageRepository } from './platform-page-repository';
import { createInjectedDqeGateway } from './runtime-config';
import type { AiSummaryConfig } from '@metriccanvas/engine/ui';

export const pageRepository = import.meta.env.VITE_PLATFORM_URL
  ? createPlatformPageRepository(import.meta.env.VITE_PLATFORM_URL)
  : createStaticPageRepository();

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
