import { canonicalizeJson, type DataSnapshot, type EffectiveQuery } from '@metriccanvas/page/internal';
import type { DataGateway, QueryDiagnosticContext, ColumnCandidatesQuery, ColumnCandidatesPage } from './ports';
import { executeQuery } from './effective-query';
import { validateCandidatePage } from './column-candidates';

type Result = DataSnapshot | ColumnCandidatesPage;
type Consumer = { resolve(value: Result): void; reject(cause: unknown): void; detach(): void };
type Request = { key: string; query: EffectiveQuery; candidates?: ColumnCandidatesQuery; diagnostics: QueryDiagnosticContext;
  controller: AbortController; consumers: Set<Consumer> };
const cancelled = (): DataSnapshot => ({ status: 'error', error: { code: 'DQE_CANCELLED', message: '查询已取消' } });

/** Request resources only. Data and candidate operations share concurrency and consumer cancellation. */
export function createQueryRunner({ gateway, maxConcurrent = 5 }: { gateway: DataGateway; maxConcurrent?: number }) {
  const pending = new Map<string, Request>(), cache = new Map<string, Result>(), queue: Request[] = [];
  let active = 0, disposed = false;
  async function execute(request: Request): Promise<Result> {
    if (!request.candidates) return executeQuery(request.query, gateway, request.diagnostics, request.controller.signal);
    const page = await gateway.fetchColumnCandidates?.(request.candidates, request.diagnostics, request.controller.signal) ?? { kind: 'unavailable' as const };
    return validateCandidatePage(page, request.candidates.offset, request.candidates.limit);
  }
  function pump() {
    while (!disposed && active < maxConcurrent && queue.length) {
      const request = queue.shift()!;
      if (!request.consumers.size || request.controller.signal.aborted) continue;
      active++;
      void execute(request).then(result => {
        if (!request.controller.signal.aborted && ('kind' in result || result.status === 'ready' || result.status === 'empty')) cache.set(request.key, result);
        for (const consumer of [...request.consumers]) { consumer.detach(); consumer.resolve(result); }
      }, cause => {
        for (const consumer of [...request.consumers]) { consumer.detach(); consumer.reject(cause); }
      }).finally(() => {
        if (pending.get(request.key) === request) pending.delete(request.key);
        active--; pump();
      });
    }
  }
  function run(query: EffectiveQuery, diagnostics: QueryDiagnosticContext, scope: string, signal?: AbortSignal, candidates?: ColumnCandidatesQuery): Promise<Result> {
    if (disposed || signal?.aborted) return Promise.resolve(cancelled());
    const normalize = (values: EffectiveQuery['filterValues']) => values.map(value => value.target === 'dimension' ? { ...value, values: [...new Map(value.values.map(item => [JSON.stringify([typeof item, item]), item])).entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, item]) => item) } : value);
    const normalized = { ...query, filterValues: normalize(query.filterValues), ...(query.bindingValues ? { bindingValues: normalize(query.bindingValues) } : {}), ...(query.tableFilters ? { tableFilters: normalize(query.tableFilters) } : {}) };
    const key = scope + ':' + canonicalizeJson({ query: normalized, ...(candidates ? { candidates: { ...candidates, query: normalized } } : {}) });
    const hit = cache.get(key);
    if (hit) return Promise.resolve(hit);
    let request = pending.get(key);
    if (!request) {
      request = { key, query, ...(candidates ? { candidates: structuredClone(candidates) } : {}), diagnostics: { ...diagnostics }, controller: new AbortController(), consumers: new Set() };
      pending.set(key, request); queue.push(request);
    }
    request.diagnostics.dataSourceIds = [...new Set([...(request.diagnostics.dataSourceIds ?? []), ...(diagnostics.dataSourceIds ?? [])])];
    const current = request;
    return new Promise((resolve, reject) => {
      const consumer: Consumer = { resolve, reject, detach() { signal?.removeEventListener('abort', abort); current.consumers.delete(consumer); } };
      const abort = () => {
        consumer.detach(); resolve(cancelled());
        if (!current.consumers.size) { current.controller.abort(); if (pending.get(key) === current) pending.delete(key); }
      };
      current.consumers.add(consumer); signal?.addEventListener('abort', abort, { once: true }); pump();
    });
  }
  return {
    async run(query: EffectiveQuery, diagnostics: QueryDiagnosticContext, scope: string, signal?: AbortSignal): Promise<DataSnapshot> {
      const result = await run(query, diagnostics, scope, signal);
      if ('status' in result) return result;
      throw new Error('查询结果类型不匹配');
    },
    async runCandidates(request: ColumnCandidatesQuery, diagnostics: QueryDiagnosticContext, scope: string, signal?: AbortSignal): Promise<ColumnCandidatesPage> {
      const result = await run(request.query, diagnostics, scope, signal, request);
      if ('kind' in result) return result;
      throw Object.assign(new Error('候选读取已取消'), { code: 'DQE_CANCELLED' });
    },
    forgetScope(scope: string) { for (const key of cache.keys()) if (key.startsWith(scope + ':')) cache.delete(key); },
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
