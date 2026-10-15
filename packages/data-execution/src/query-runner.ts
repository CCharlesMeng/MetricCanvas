import { canonicalizeJson, type DataSnapshot, type EffectiveQuery } from '@metriccanvas/page/internal';
import type { DataGateway, QueryDiagnosticContext } from './ports';
import { executeQuery } from './effective-query';

type Consumer = { resolve(value: DataSnapshot): void; detach(): void };
type Request = { key: string; query: EffectiveQuery; diagnostics: QueryDiagnosticContext;
  controller: AbortController; consumers: Set<Consumer>; started: boolean };
const cancelled = (): DataSnapshot => ({ status: 'error', error: { code: 'DQE_CANCELLED', message: '查询已取消' } });

/** Request resources only. No source, table, initial or completeness policy. */
export function createQueryRunner({ gateway, maxConcurrent = 5 }: { gateway: DataGateway; maxConcurrent?: number }) {
  const pending = new Map<string, Request>();
  const cache = new Map<string, DataSnapshot>();
  const queue: Request[] = [];
  let active = 0, disposed = false;
  function pump() {
    while (!disposed && active < maxConcurrent && queue.length) {
      const request = queue.shift()!;
      if (!request.consumers.size || request.controller.signal.aborted) continue;
      request.started = true; active++;
      void executeQuery(request.query, gateway, request.diagnostics, request.controller.signal).then(snapshot => {
        if (!request.controller.signal.aborted && (snapshot.status === 'ready' || snapshot.status === 'empty')) cache.set(request.key, snapshot);
        for (const consumer of [...request.consumers]) { consumer.detach(); consumer.resolve(snapshot); }
      }).finally(() => {
        if (pending.get(request.key) === request) pending.delete(request.key);
        active--; pump();
      });
    }
  }
  return {
    run(query: EffectiveQuery, diagnostics: QueryDiagnosticContext, scope: string, signal?: AbortSignal): Promise<DataSnapshot> {
      if (disposed || signal?.aborted) return Promise.resolve(cancelled());
      const normalized={...query,filterValues:query.filterValues.map(value=>value.target==='dimension'?{...value,values:[...new Map(value.values.map(item=>[JSON.stringify([typeof item,item]),item])).entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,item])=>item)}:value)};
      const key = `${scope}:${canonicalizeJson(normalized)}`;
      const hit = cache.get(key);
      if (hit) return Promise.resolve(hit);
      let request = pending.get(key);
      if (!request) {
        request = { key, query, diagnostics, controller: new AbortController(), consumers: new Set(), started: false };
        pending.set(key, request); queue.push(request);
      }
      request.diagnostics.dataSourceIds = [...new Set([...(request.diagnostics.dataSourceIds ?? []), ...(diagnostics.dataSourceIds ?? [])])];
      const current = request;
      return new Promise(resolve => {
        const consumer: Consumer = { resolve, detach() { signal?.removeEventListener('abort', abort); current.consumers.delete(consumer); } };
        const abort = () => {
          consumer.detach(); resolve(cancelled());
          if (!current.consumers.size) {
            current.controller.abort();
            if (pending.get(key) === current) pending.delete(key);
          }
        };
        current.consumers.add(consumer);
        signal?.addEventListener('abort', abort, { once: true });
        pump();
      });
    },
    forgetScope(scope:string) { for(const key of cache.keys())if(key.startsWith(`${scope}:`))cache.delete(key); },
    dispose() {
      disposed = true;
      for (const request of pending.values()) {
        request.controller.abort();
        for (const consumer of [...request.consumers]) { consumer.detach(); consumer.resolve(cancelled()); }
      }
      queue.length = 0; pending.clear(); cache.clear();
    }
  };
}
export type QueryRunner = ReturnType<typeof createQueryRunner>;
