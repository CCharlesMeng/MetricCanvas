import {
  createDqeGateway,
  createInMemoryDqeDiagnostics
} from '@metriccanvas/data-gateway';
import { createStaticPageRepository } from './page-repository';
import { createPlatformPageRepository } from './platform-page-repository';
import type { AiSummaryConfig } from '@metriccanvas/runtime-ui';

export const pageRepository = import.meta.env.VITE_PLATFORM_URL
  ? createPlatformPageRepository(import.meta.env.VITE_PLATFORM_URL)
  : createStaticPageRepository();

export const dqeDiagnostics = createInMemoryDqeDiagnostics();

/** inline 页面不会访问网关；query 页面统一进入当前 DQE 执行环境。 */
export const dataGateway = createDqeGateway({
  endpoint:
    import.meta.env.VITE_DQE_ENDPOINT ??
    '/rest/cdi/cdinl2databuilderservice/v1/dsl/execute',
  diagnostics: dqeDiagnostics
});

/** AI 总结未配置时由组件局部显示配置错误，不影响页面其他组件。 */
export const aiSummary: AiSummaryConfig | undefined = import.meta.env.VITE_AI_SUMMARY_ENDPOINT
  ? {
      conversationBaseUrl: import.meta.env.VITE_AI_SUMMARY_ENDPOINT,
      ...(import.meta.env.VITE_AI_SUMMARY_ENV
        ? { env: import.meta.env.VITE_AI_SUMMARY_ENV }
        : {})
    }
  : undefined;
