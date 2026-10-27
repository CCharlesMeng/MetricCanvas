import {readFileSync} from 'node:fs';
import {describe, expect, it, vi} from 'vitest';
import {normalizeQueryTime} from '../packages/page/src/query-time';
import {createDqeGateway, effectiveDqeItem} from '../packages/data-execution/src/dqe/dqe';
import type {EffectiveQuery, JsonObject} from '../packages/page/src/internal';

const cases = JSON.parse(readFileSync('tools/fixtures/query-time-contract.json', 'utf8')) as Array<{
  input: {period: string; start: string; end: string}; expected?: {period: string; start: string; end: string}; error?: string
}>;
function query(time: JsonObject): EffectiveQuery {
  return {language: 'dqe', body: {dsl_list: [{output_metrics: ['amount'], output_dims: [], filter: {time}}]},
    fieldMappings: {amount: {type: 'number', role: 'measure'}}, filterValues: []};
}
describe('authoring and runtime query time contract', () => {
  for (const entry of cases) {
    it(JSON.stringify(entry.input), () => {
      if (entry.expected) expect(normalizeQueryTime(entry.input)).toEqual(entry.expected);
      else expect(() => normalizeQueryTime(entry.input)).toThrow(entry.error);
    });
  }
  it('normalizes the saved definition and browser requery identically without mutating scope', () => {
    const first = query({period: 'M', start: '202604', end: '202609', is_aggregate: true});
    const original = structuredClone(first);
    const repeated = query({period: 'month', start: '2026-01', end: '2026-02', is_aggregate: true});
    repeated.filterValues = [{target: 'time', value: {from: '2026-04', to: '2026-09'}}];
    expect(effectiveDqeItem(first)).toEqual(effectiveDqeItem(repeated));
    expect(first).toEqual(original);
  });
  it('rejects a day range under month before transport, including browser requery', async () => {
    const fetchImpl = vi.fn();
    const gateway = createDqeGateway({fetchImpl});
    const first = query({period: 'month', start: '20260401', end: '20260930'});
    await expect(gateway.fetchData(first)).rejects.toMatchObject({code: 'DQE_QUERY_REJECTED'});
    const repeated = query({period: 'month', start: '2026-04', end: '2026-09'});
    repeated.filterValues = [{target: 'time', value: {from: '2026-04-01', to: '2026-09-30'}}];
    await expect(gateway.fetchData(repeated)).rejects.toMatchObject({code: 'DQE_QUERY_REJECTED'});
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

it('executes the exact Playground rejection fixture before transport', async () => {
  const page = JSON.parse(readFileSync('pages/capabilities/query/authoring-contract-reliability.json', 'utf8'));
  const source = page.dataSources['invalid-time'];
  const fetchImpl = vi.fn();
  await expect(createDqeGateway({fetchImpl}).fetchData({language: 'dqe', body: source.source.query.body,
    fieldMappings: source.fields, filterValues: []})).rejects.toMatchObject({code: 'DQE_QUERY_REJECTED'});
  expect(fetchImpl).not.toHaveBeenCalled();
});
