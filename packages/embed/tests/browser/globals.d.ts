import type {
  MountOptions,
  RuntimeEvent,
  RuntimeHandle
} from '../../src/types';
import type { DqeGatewayConfig, RuntimeDataGateway } from '../../src';

declare global {
  const MetricCanvas: {
    mount(target: string | HTMLElement, options: MountOptions): RuntimeHandle;
    createDqeGateway(config?: DqeGatewayConfig): RuntimeDataGateway;
  };

  /** 由 addInitScript 注入到页面里；只在 page.evaluate 的函数体内可用。 */
  function iocGateway(): RuntimeDataGateway;

  interface Window {
    pageDocument: any;
    runtime: RuntimeHandle;
    queryPageDocument: any;
    queryEvents: RuntimeEvent[];
    queryCalls: Array<{ pagination?: { offset: number; limit: number } }>;
    queryRuntime: RuntimeHandle;
    /** IOC 页面在 query.html 宿主里改走内容服务的 DQE 端点。 */
    iocGateway?: () => RuntimeDataGateway;
    __iocGateway?: RuntimeDataGateway;
    missingRuntime: RuntimeHandle;
    failingRuntime: RuntimeHandle;
    aiSummaryRuntime: RuntimeHandle;
    aiSummaryRequests: Array<{
      url: string;
      credentials: RequestCredentials;
      headers: Record<string, string>;
      body: any;
    }>;
  }
}

export {};
