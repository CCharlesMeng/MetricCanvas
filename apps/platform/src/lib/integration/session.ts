import { readPageAssetsRuntimeConfig, type RuntimeConfigSource } from '@metriccanvas/application-runtime';

import type {PlatformEvent} from './contract';
export type {PlatformEvent} from './contract';
/** Credentials are refreshed per request; only identity and service targets bind a session. */
export function createPlatformSession(options: {
  readConfig: RuntimeConfigSource;
  subscribeConfig?: (changed: () => void) => () => void;
  onEvent?: (event: PlatformEvent) => void;
  fetchImpl?: typeof fetch;
}) {
  const lifetime = new AbortController();
  const listeners = new Set<() => void>();
  const key = (value: ReturnType<typeof readPageAssetsRuntimeConfig>) => JSON.stringify(value && [
    value.operatorId, value.workspaceId, value.pageMetadataBaseUrl, value.dqeEndpoint
  ]);
  const initial = key(readPageAssetsRuntimeConfig(options.readConfig));
  let active = true;
  let unsubscribe: (() => void) | undefined;
  function invalidate(notify = true) {
    if (!active) return;
    active = false;
    lifetime.abort();
    try {unsubscribe?.();} finally {
      try {for (const listener of listeners) listener();} finally {listeners.clear();}
    }
    if (notify) options.onEvent?.({code:'session-invalidated',message:'身份或服务目标已变化，请重新打开平台。'});
  }
  function readConfig() {
    if (!active) return null;
    const value = readPageAssetsRuntimeConfig(options.readConfig);
    if (key(value) !== initial) { invalidate(); return null; }
    return value;
  }
  const fetchImpl: typeof fetch = async (input, init) => {
    if (!readConfig() || !active) throw new Error('平台会话不可用，未发送请求。');
    const signals = [lifetime.signal, ...(init?.signal ? [init.signal] : [])];
    const response = await (options.fetchImpl ?? fetch)(input, {...init, signal: AbortSignal.any(signals)});
    if (response.status === 401) options.onEvent?.({code:'login-required',message:'需要重新登录。'});
    const body = await response.arrayBuffer();
    if (!readConfig() || !active) throw new Error('平台会话已失效，旧请求结果不可用。');
    return new Response([204,205,304].includes(response.status) ? null : body, {status:response.status,statusText:response.statusText,headers:response.headers});
  };
  try { unsubscribe = options.subscribeConfig?.(() => { readConfig(); }); }
  catch (error) { invalidate(false); throw error; }
  if (!active) unsubscribe?.();
  return {readConfig, fetchImpl, signal:lifetime.signal,
    isActive: () => active,
    onInvalidate(listener: () => void) { if (!active) {listener(); return () => {};} listeners.add(listener);return () => {listeners.delete(listener);}; },
    destroy: () => invalidate(false)};
}
