import { expect, it } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import example from '../../../../pages/capabilities/query/dqe-independent-requests.json';
import { createDqeGateway } from '../../data-gateway/src/dqe';
import { createFilterState } from '../src/filter-state';
import { orchestrate } from '../src/orchestrator';

const turn = () => new Promise(resolve => setTimeout(resolve, 0));

function fixture() {
  const document = structuredClone(example);
  const parsed = parsePage(document);
  if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const page = parsed.page;
  const cards = page.sections[0].components;
  page.sections = [0, 5, 10].map(start => ({ id: `section-${start}`, components: cards.slice(start, start + 5) }));
  page.dataSources = Object.fromEntries(Object.entries(page.dataSources).reverse());
  page.filters = [{ id: 'scope', type: 'dimension', dimension: 'scope', default: ['A'] }];
  for (const source of Object.values(page.dataSources)) {
    if (source.source.type !== 'query') throw Error('Expected ordinary query');
    source.source.query.filterBindings = { scope: { target: 'dimension', queryField: 'scope' } };
  }
  const first = page.sections[0].components[0];
  if (first.type !== 'metricCard') throw Error('Expected first metric card');
  page.sections[0].components[0] = {
    id: 'first-tabs', type: 'tabContainer', layout: first.layout,
    props: { defaultTab: 'shown', tabs: [
      { id: 'hidden', label: '未激活', components: [{ ...first, id: 'hidden-card', data: { main: 'query-15' } }] },
      { id: 'shown', label: '当前', components: [first] }
    ] }
  };
  return page;
}

it('submits ready queries in section/component order on mount and filter refresh without waiting for responses', async () => {
  const pending: Array<{ field: string; resolve(response: Response): void }> = [];
  const gateway = createDqeGateway({ fetchImpl: async (_url, init) => {
    const { dsl_list: [item] } = JSON.parse(String(init?.body));
    return new Promise<Response>(resolve => pending.push({ field: item.output_metrics[0], resolve }));
  } });
  const filters = createFilterState();
  filters.write('scope', { type: 'dimension', dimension: 'scope', values: ['A'] });
  const dispose = orchestrate(fixture(), gateway, filters).subscribe(() => {});
  const expected = Array.from({ length: 15 }, (_, index) => `合成数值${String(index + 1).padStart(2, '0')}`);
  function settle() {
    pending.splice(0).forEach(call => call.resolve(Response.json({ retCode: 'CBC.0000', results: [
      { code: 'SUCCESS', data: [{ [call.field]: 1 }], total_count: 1 }
    ] })));
  }
  try {
    await turn();
    expect(pending.map(call => call.field)).toEqual(expected);
    settle();
    await turn();
    filters.write('scope', { type: 'dimension', dimension: 'scope', values: ['B'] });
    await turn();
    expect(pending.map(call => call.field)).toEqual(expected);
  } finally {
    dispose();
    settle();
  }
});
