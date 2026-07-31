import {
  createDqeGateway,
  createInMemoryDqeDiagnostics
} from '@metriccanvas/data-gateway';
import { createStaticPageRepository } from './page-repository';
import { createPlatformPageRepository } from './platform-page-repository';

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
