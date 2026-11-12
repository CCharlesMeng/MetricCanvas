import { expect, it } from 'vitest';
import type { EffectiveQuery } from '@metriccanvas/page/internal';
import { createDqeGateway } from '../src/dqe';

const query = (id: string): EffectiveQuery => ({
  language: 'dqe', body: { dsl_list: [{ output_dims: [id], output_metrics: [], order: {} }] },
  fieldMappings: { value: { queryField: id, type: 'string', role: 'dimension' } }, filterValues: []
});
const turn = () => new Promise(resolve => setTimeout(resolve, 0));

it('releases a fast query while an independent slow query is still pending', async () => {
  const pending: { fields: string[]; resolve(response: Response): void }[] = [];
  const gateway = createDqeGateway({ fetchImpl: async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    return new Promise<Response>(resolve => pending.push({ fields: body.dsl_list.map((item: { output_dims: string[] }) => item.output_dims[0]), resolve }));
  } });
  let completed = false;
  const slow = gateway.fetchData(query('slow'));
  const fast = gateway.fetchData(query('fast')).then(result => { completed = true; return result; });
  await turn();
  expect(pending.map(call => call.fields)).toEqual([['slow'], ['fast']]);
  pending[1].resolve(Response.json({ retCode: 'CBC.0000', results: [{ code: 'SUCCESS', data: [{ fast: 'fast' }], total_count: 1 }] }));
  await expect(fast).resolves.toMatchObject({ rows: [{ value: 'fast' }] });
  expect(completed).toBe(true);
  pending[0].resolve(Response.json({ retCode: 'CBC.0000', results: [{ code: 'SUCCESS', data: [{ slow: 'slow' }], total_count: 1 }] }));
  await slow;
});

it('limits independent HTTP requests and skips a cancelled queued request', async () => {
  const pending: { field: string; resolve(response: Response): void }[] = [];
  const gateway = createDqeGateway({ maxConcurrentBatches: 2, fetchImpl: async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    expect(body.dsl_list).toHaveLength(1);
    return new Promise<Response>(resolve => pending.push({ field: body.dsl_list[0].output_dims[0], resolve }));
  } });
  const cancelled = new AbortController();
  const first = gateway.fetchData(query('a'));
  const second = gateway.fetchData(query('b'));
  const third = gateway.fetchData(query('c'), undefined, cancelled.signal).catch(cause => cause.code);
  const fourth = gateway.fetchData(query('d'));
  await turn();
  expect(pending.map(call => call.field)).toEqual(['a', 'b']);
  cancelled.abort();
  const settle = (index: number) => pending[index].resolve(Response.json({ retCode: 'CBC.0000', results: [{ code: 'SUCCESS', data: [{ [pending[index].field]: 'value' }], total_count: 1 }] }));
  settle(0); await first; await turn();
  expect(pending.map(call => call.field)).toEqual(['a', 'b', 'd']);
  settle(1); settle(2);
  await Promise.all([second, fourth]);
  expect(await third).toBe('DQE_CANCELLED');
});
