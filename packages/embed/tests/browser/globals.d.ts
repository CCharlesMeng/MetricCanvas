import type {
  MountOptions,
  RuntimeEvent,
  RuntimeHandle
} from '../../src/types';

declare global {
  const MetricCanvas: {
    mount(target: string | HTMLElement, options: MountOptions): RuntimeHandle;
  };

  interface Window {
    pageDocument: any;
    runtime: RuntimeHandle;
    queryPageDocument: any;
    queryEvents: RuntimeEvent[];
    queryCalls: Array<{ pagination?: { offset: number; limit: number } }>;
    queryRuntime: RuntimeHandle;
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
