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

/** Preserve the host snapshot and give the explicit mount permission precedence. */
export function withExportPermission(snapshot: DisplaySnapshot | undefined, canExport: boolean | undefined): DisplaySnapshot | undefined {
  if (canExport === undefined) return snapshot;
  return {
    ...snapshot,
    permissionRevision: snapshot?.permissionRevision ?? 'embed-export',
    values: snapshot?.values ?? {},
    permissions: { ...snapshot?.permissions, canExport: { status: 'ready', value: canExport } }
  };
}
