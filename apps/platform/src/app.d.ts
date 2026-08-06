import type { LifecycleContext } from '@metriccanvas/page-lifecycle';

declare global {
  namespace App {
    interface Locals {
      identity: LifecycleContext;
    }
  }
}

export {};
