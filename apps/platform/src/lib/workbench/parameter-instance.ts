import { resolvePageParams, type PageDocument } from '@metriccanvas/page';

export interface ParameterInstancePort {
  /** Host rechecks current identity, turn, record integrity and expiry before returning. */
  read(contextRef: string, instanceRef: string, signal: AbortSignal): Promise<{
    ref: string; kind: 'instance'; expiresAt: number;
    binding: { contextRef: string; actorId: string; workspaceId: string; pageId: string };
    payload: { document: PageDocument };
  }>;
}
export interface ParameterInstanceScope {
  contextRef: string; actorId: string; workspaceId: string; pageId: string; sourceKey: string;
}

/** Temporary presentation only: deliberately has no coordinator/save dependency. */
export function createParameterInstanceSession(options: {
  port: ParameterInstancePort; scope(): ParameterInstanceScope; clock?: () => number;
}) {
  const clock = options.clock ?? (() => Date.now() / 1000);
  let generation = 0, key = '', controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let state: { document: PageDocument | null; error: string; loading: boolean } = { document: null, error: '', loading: false };
  const listeners = new Set<(value: typeof state) => void>();
  const emit = (next: typeof state) => { state = next; listeners.forEach(fn => fn(state)); };
  const clear = () => { generation++; controller?.abort(); clearTimeout(timer); };
  const scopeKey = () => JSON.stringify(options.scope());
  const api = {
    subscribe(fn: (value: typeof state) => void) { listeners.add(fn); fn(state); return () => { listeners.delete(fn); }; },
    async open(instanceRef: string) {
      clear(); const turn = generation; controller = new AbortController();
      emit({ document: null, error: '', loading: true });
      try {
        const scope = options.scope(); key = scopeKey();
        if (!scope.contextRef || !scope.actorId || !scope.workspaceId || !scope.pageId) throw Error('运行上下文不可用');
        const record = await options.port.read(scope.contextRef, instanceRef, controller.signal);
        if (turn !== generation) return;
        if (key !== scopeKey() || record.ref !== instanceRef || record.kind !== 'instance' ||
            !Number.isFinite(record.expiresAt) || record.expiresAt <= clock() ||
            ['contextRef', 'actorId', 'workspaceId', 'pageId'].some(k => record.binding[k as keyof typeof record.binding] !== scope[k as keyof typeof scope]) ||
            record.payload.document.id !== scope.pageId) throw Error('运行产物已失效或与当前页面不匹配');
        const result = resolvePageParams(record.payload.document);
        if (!result.ok) throw Error('运行产物参数不完整或非法');
        emit({ document: result.document, error: '', loading: false });
        timer = setTimeout(() => { clear(); emit({ document: null, error: '运行产物已过期，请重新赋值运行', loading: false }); },
          Math.min(2147483647, (record.expiresAt - clock()) * 1000));
      } catch (cause) {
        if (turn === generation) emit({ document: null, error: '无法打开运行产物，请核对当前上下文或重新赋值', loading: false });
      }
    },
    invalidate() {
      if (!key) return;
      try { if (key === scopeKey()) return; } catch { /* unavailable scope invalidates */ }
      clear(); emit({ document: null, error: '来源已改变，请重新赋值运行', loading: false });
    },
    close() { clear(); key = ''; emit({ document: null, error: '', loading: false }); },
    dispose() { clear(); listeners.clear(); }
  };
  return api;
}
