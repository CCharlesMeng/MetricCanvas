import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EffectiveQuery } from '@metriccanvas/page/internal';
import { createDqeGateway } from '../src/dqe';

const query: EffectiveQuery = {
  language: 'dqe',
  body: { dsl_list: [{ output_dims: ['region'], output_metrics: ['amount'], filter: { dims: [], metrics: [] }, order: {} }] },
  fieldMappings: { amount: { queryField: 'amount', type: 'number', role: 'measure' } },
  filterValues: []
};

function controlledUpstream() {
  const requests: Array<{ signal: AbortSignal | null | undefined; count: number; respond(response: Response): void }> = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    const signal = init?.signal;
    return new Promise<Response>((resolve, reject) => {
      requests.push({ signal, count: JSON.parse(String(init?.body)).dsl_list.length, respond: resolve });
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
  };
  return {
    fetchImpl,
    aborted: () => requests.every(request => request.signal?.aborted),
    succeed() {
      for (const request of requests) request.respond(new Response(JSON.stringify({ retCode: 'CBC.0000', results: Array.from({ length: request.count }, () => (
        { code: 'SUCCESS', data: [{ region: 'east', amount: 7 }], total_count: 1 }
      )) })));
    }
  };
}

const operations = [
  { name: 'single query', start: (gateway: ReturnType<typeof createDqeGateway>) => gateway.fetchData(query) },
  { name: 'concurrent queries', start: (gateway: ReturnType<typeof createDqeGateway>) => Promise.all([gateway.fetchData(query), gateway.fetchData(query)]) },
  { name: 'dimension candidates', start: (gateway: ReturnType<typeof createDqeGateway>) => gateway.fetchDimensionValues('region') }
];

afterEach(() => vi.useRealTimers());

describe.each(operations)('DQE timeout: $name', ({ start }) => {
  it('waits past 120s and aborts at the default 180s boundary', async () => {
    vi.useFakeTimers();
    const upstream = controlledUpstream();
    const pending = start(createDqeGateway({ fetchImpl: upstream.fetchImpl })).catch(error => error);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(upstream.aborted()).toBe(false);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(upstream.aborted()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(upstream.aborted()).toBe(true);
    expect(await pending).toMatchObject({ code: 'DQE_TIMEOUT', detail: { timeoutMs: 180_000 } });
  });

  it('accepts a successful response after 150s', async () => {
    vi.useFakeTimers();
    const upstream = controlledUpstream();
    const pending = start(createDqeGateway({ fetchImpl: upstream.fetchImpl })).catch(error => error);
    await vi.advanceTimersByTimeAsync(150_000);
    upstream.succeed();
    expect(await pending).not.toBeInstanceOf(Error);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('honors an explicit timeout override', async () => {
    vi.useFakeTimers();
    const upstream = controlledUpstream();
    const pending = start(createDqeGateway({ fetchImpl: upstream.fetchImpl, timeoutMs: 10_000 })).catch(error => error);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(upstream.aborted()).toBe(true);
    expect(await pending).toMatchObject({ code: 'DQE_TIMEOUT', detail: { timeoutMs: 10_000 } });
  });
});
