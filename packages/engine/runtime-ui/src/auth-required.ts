import type { RuntimeDataGateway } from '../../runtime/src';
import {observeQueryHttpError} from '@metriccanvas/data-execution/runtime';

export interface AuthRequiredEvent {
  type: 'auth-required';
  status: 401 | 403 | 419;
}

/** Only structured HTTP failures qualify; query rejection/permission results do not. */
function authStatus(cause: unknown): AuthRequiredEvent['status'] | undefined {
  if (!cause || typeof cause !== 'object' || !('detail' in cause)) return;
  const detail = cause.detail;
  if (!detail || typeof detail !== 'object' || !('status' in detail)) return;
  return requiredStatus(detail.status);
}

function requiredStatus(status: unknown): AuthRequiredEvent['status'] | undefined {
  if (status === 401 || status === 403 || status === 419) return status;
}

function cancelled(): Error {
  return Object.assign(new Error('页面请求已结束'), { code: 'DQE_CANCELLED' });
}

/** Reject immediately on cancellation even if an injected Adapter ignores its signal. */
async function abortable<T>(operation: (signal: AbortSignal) => Promise<T>, signal: AbortSignal): Promise<T> {
  let release = () => {};
  try {
    return await new Promise<T>((resolve, reject) => {
      const abort = () => reject(cancelled());
      release = () => signal.removeEventListener('abort', abort);
      signal.addEventListener('abort', abort, { once: true });
      void Promise.resolve().then(() => {
        if (signal.aborted) throw cancelled();
        return operation(signal);
      }).then(resolve, reject);
    });
  } finally { release(); }
}

/** A page-owned wrapper: never mutates the supplied gateway or its optional capabilities. */
export function createAuthRequiredGateway(base: RuntimeDataGateway, observe: (event: AuthRequiredEvent) => void) {
  const lifetime = new AbortController();
  function receiveStatus(value: unknown) {
    const status=requiredStatus(value);
    if(status!==undefined)observe({type:'auth-required',status});
  }
  async function execute<T>(operation: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
    const combined = AbortSignal.any(signal ? [signal, lifetime.signal] : [lifetime.signal]);
    if (combined.aborted) throw cancelled();
    let httpObserved=false;
    const stopObserving=observeQueryHttpError(combined,status=>{httpObserved=true;receiveStatus(status);});
    try {
      return await abortable(operation, combined);
    } catch (cause) {
      if (combined.aborted) throw cancelled();
      if(!httpObserved)receiveStatus(authStatus(cause));
      throw cause;
    } finally { stopObserving(); }
  }
  const dimensions = base.fetchDimensionValues;
  const filters = base.fetchFilterCandidates;
  const columns = base.fetchColumnCandidates;
  const gateway: RuntimeDataGateway = {
    get finalizationSource() { return base.finalizationSource; },
    fetchData: (query, context, signal) => execute(next => base.fetchData(query, context, next), signal),
    ...(dimensions ? { fetchDimensionValues: ((dimension, options) => execute(next => dimensions.call(base, dimension, { ...options, signal: next }), options?.signal)) as NonNullable<RuntimeDataGateway['fetchDimensionValues']> } : {}),
    ...(filters ? { fetchFilterCandidates: ((request, options) => execute(next => filters.call(base, request, { signal: next }), options.signal)) as NonNullable<RuntimeDataGateway['fetchFilterCandidates']> } : {}),
    ...(columns ? { fetchColumnCandidates: ((request, context, signal) => execute(next => columns.call(base, request, context, next), signal)) as NonNullable<RuntimeDataGateway['fetchColumnCandidates']> } : {})
  };
  return { gateway, dispose() { lifetime.abort(); } };
}

/** Application observers cannot interrupt cleanup or create unhandled rejections. */
export function notifyAuthRequired(callback: ((event: AuthRequiredEvent) => void) | undefined, event: AuthRequiredEvent): void {
  try { void Promise.resolve(callback?.({ ...event })).catch(() => {}); }
  catch { /* Application callback failure does not revive a terminated page. */ }
}
