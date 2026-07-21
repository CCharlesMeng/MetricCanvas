import type { CatalogSnapshot } from '@metriccanvas/page';
import { createDataServiceGateway, createMockGateway } from '@metriccanvas/data-gateway';
import { createStaticPageRepository } from './page-repository';
import { createPlatformPageRepository } from './platform-page-repository';
import snapshot from '../../../../catalog/snapshot.json';

export const pageRepository = import.meta.env.VITE_PLATFORM_URL
  ? createPlatformPageRepository(import.meta.env.VITE_PLATFORM_URL)
  : createStaticPageRepository();

/**
 * 应用壳的依赖注入点。数据网关按环境切换:
 * - 默认 mock(离线造数);
 * - `VITE_DATA_GATEWAY=sim` 走数据服务仿真(先 `pnpm sim` 起本地服务),
 *   真实适配器全链路;#3 真实联调时同一开关指向真实地址并注入真实鉴权头。
 */
export const dataGateway =
  import.meta.env.VITE_DATA_GATEWAY === 'sim'
    ? createDataServiceGateway({
        baseUrl: import.meta.env.VITE_DATA_SERVICE_URL ?? 'http://localhost:18226',
        serviceCode: 'P001_ADS_T_IOC_SPD_METRIC_ACC_D',
        // 占位鉴权头:仿真接受;真实值 #3/#11 联调注入
        headers: { 'x-operator-id': 'dev', tenantId: 'dev', appId: 'metriccanvas', cftk: 'dev' }
      })
    : createMockGateway({ catalog: snapshot as CatalogSnapshot });
