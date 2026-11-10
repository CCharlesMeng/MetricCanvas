import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage } from '../packages/page/src';
import { flattenPageComponents } from '../packages/page/src/internal';
import { initialFilterValues } from '../packages/data-execution/src/runtime';
import { compilePresentation } from '../packages/engine/runtime/src/presentation';
import { createTableController } from '../packages/engine/runtime-ui/src/table/controller';

const document = JSON.parse(readFileSync('pages/partner-health.json', 'utf8'));
const parsed = parsePage(document);
if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
const page = parsed.page;

it.each(['region-table', 'representative-table'])('%s defaults to descending computed health score before pagination', id => {
  const table = flattenPageComponents(page).find(component => component.id === id);
  if (table?.type !== 'table') throw Error(`missing ${id}`);
  const controller = createTableController(page, () => null, () => {});
  try {
    const rows = [8, 2, 12, 4, 10, 6, 1, 9, 3, 11, 5, 7].map(score => ({ region: `R${score}`, 'total-score': score }));
    expect(controller.present(table, rows).rows.map(row => row['total-score'])).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
    controller.page(table, 1);
    expect(controller.present(table, rows).rows.map(row => row['total-score'])).toEqual([2, 1]);
    controller.sort(table, [{ field: 'total-score', direction: 'asc' }]);
    expect(controller.present(table, rows).rows[0]['total-score']).toBe(1);
  } finally { controller.dispose(); }
});

it.each(['geo', 'region-dept', 'office'])('explicit global selection at %s keeps regional comparison and overall cards', level => {
  const filters = initialFilterValues(page.filters ?? []);
  filters.set('region', { type: 'dimension', dimension: 'geo-pc-code', level, values: ['全球'] });
  const projection = compilePresentation(page).evaluate({ filters });
  const components = flattenPageComponents({ ...page, sections: projection.sections });
  const tabs = components.find(component => component.id === 'regional-comparison-tabs');
  if (tabs?.type !== 'tabContainer') throw Error('missing comparison tabs');
  expect(tabs.props.tabs.map(tab => tab.id)).toEqual(['region', 'representative']);
  expect(components.filter(component => component.type === 'metricCard').map(card => card.data?.main)).toEqual(Array(5).fill('health-overview'));
});

it.each(['国内', '海外'])('global cards use the %s overall score rather than the first organization', async scope => {
  const { createDqeGateway } = await import('../packages/data-execution/src/dqe/dqe');
  const { createSourceProgram } = await import('../packages/data-execution/src/runtime');
  const { currentHealthResult } = await import('./fixtures/partner-health/current-responses');
  const filters = initialFilterValues(page.filters ?? []);
  filters.set('region', {type:'dimension', dimension:'region-dept-code', level:'region-dept', values:['全球']});
  filters.set('china-overseas', {type:'dimension', dimension:'china-overseas', values:[scope]});
  const bodies: unknown[] = [];
  const gateway = createDqeGateway({ fetchImpl: async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    bodies.push(body);
    return Response.json({retCode:'CBC.0000', results:body.dsl_list.map(currentHealthResult)});
  }});
  const program = createSourceProgram(page, {gateway:{...gateway, async fetchFilterCandidates() { return {kind:'values' as const, candidates:[{level:'region-dept',value:'全球',label:'全球'}]}; }}});
  const snapshots = new Map();
  try {
    for await (const update of program.read({roots:['health-overview','health-scores-region','health-scores-representative'], conditions:filters})) snapshots.set(update.sourceId, update.snapshot);
    expect(snapshots.get('health-overview')).toMatchObject({status:'ready', rows:[expect.objectContaining({'total-score':scope === '国内' ? 8 : 17})]});
    expect(snapshots.get('health-scores-region')).toMatchObject({status:'ready', rows:expect.arrayContaining([expect.objectContaining({region:'合成地区部08', 'total-score':88})])});
    expect(JSON.stringify(bodies)).not.toContain('全球');
  } finally {program.dispose();}
});

it.each([
  {level:'region-dept',values:['合成地区部01'],source:'health-scores-region',tabs:['representative']},
  {level:'office',values:['合成代表处01'],source:'health-scores-representative',tabs:['representative']},
  {level:'office',values:[],source:'health-overview',tabs:['region','representative']}
])('preserves actual organization and clear behavior: $level $values', scope => {
  const filters = initialFilterValues(page.filters ?? []);
  filters.set('region', {type:'dimension',dimension:'geo-pc-code',level:scope.level,values:scope.values});
  const projection = compilePresentation(page).evaluate({filters});
  const components = flattenPageComponents({...page,sections:projection.sections});
  expect(components.filter(component => component.type === 'metricCard').map(card => card.data?.main)).toEqual(Array(5).fill(scope.source));
  const tabs = components.find(component => component.id === 'regional-comparison-tabs');
  if (tabs?.type !== 'tabContainer') throw Error('missing comparison tabs');
  expect(tabs.props.tabs.map(tab => tab.id)).toEqual(scope.tabs);
});
