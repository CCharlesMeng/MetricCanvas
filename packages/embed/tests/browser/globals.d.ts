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
    queryRuntime: RuntimeHandle;
    missingRuntime: RuntimeHandle;
  }
}

export {};
