import type { DisplaySnapshot } from '@metriccanvas/page/internal';
/** Stable source per page instance; permissions/identity revisions require a new instance. */
export interface DisplayInputs {
  getSnapshot(): DisplaySnapshot;
  subscribe(run:(snapshot:DisplaySnapshot)=>void):()=>void;
}
export type { DisplaySnapshot } from '@metriccanvas/page/internal';
export function isDisplayInputs(value:unknown):value is DisplayInputs {
  return !!value&&typeof value==='object'&&'getSnapshot' in value&&typeof value.getSnapshot==='function'&&'subscribe' in value&&typeof value.subscribe==='function';
}
