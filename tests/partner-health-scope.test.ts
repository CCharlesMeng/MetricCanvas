import {expect, it} from 'vitest';
import {parsePage} from '../packages/page/src';
import {flattenPageComponents, resolveDataSourceFields, type DataSnapshot} from '../packages/page/src/internal';
import {createSourceProgram, initialFilterValues} from '../packages/data-execution/src/runtime';
import {compilePresentation} from '../packages/engine/runtime/src/presentation';
import {fieldValue} from '../packages/engine/widgets/src/shared/component-data';
import {createPartnerHealthUnionPreview} from '../apps/playground/fixtures/organization-union/gateway';
import document from '../pages/temporary/partner-health.json';

const parsed = parsePage(document);
if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
const page = parsed.page;

it.each([
  {label: '全球', level: 'region-dept', values: [], source: 'health-overview', total: 35, tabs: ['region', 'representative'], buttons: true},
  {label: '地区部', level: 'region-dept', values: ['ORG-06'], source: 'health-scores-region', total: 6, tabs: ['representative'], buttons: false},
  {label: '代表处', level: 'representative', values: ['REP-06'], source: 'health-scores-representative', total: 3, tabs: ['representative'], buttons: false}
])('$label 的指标卡、图表页签和表格页签符合组织视角', async scope => {
  const filters = initialFilterValues(page.filters ?? []);
  filters.set('region', {type: 'dimension', dimension: scope.level, level: scope.level, values: scope.values});
  const presentation = compilePresentation(page).evaluate({filters});
  const visible = flattenPageComponents({...page, sections: presentation.sections});
  const cards = visible.filter(component => component.type === 'metricCard');
  expect(cards).toHaveLength(5);
  expect(cards.map(card => card.data?.main)).toEqual(Array(5).fill(scope.source));
  expect(presentation.component('china-overseas-buttons').eligible).toBe(scope.buttons);
  const chart = visible.find(component => component.id === 'regional-comparison-tabs');
  const table = visible.find(component => component.id === 'detail-tabs');
  if (chart?.type !== 'tabContainer' || table?.type !== 'tabContainer') throw Error('缺少页签区域');
  expect(chart.props.tabs.map(tab => tab.id)).toEqual(scope.tabs);
  expect(table.props.tabs.map(tab => tab.id)).toEqual(['region', 'representative']);
  const total = cards[0];
  if (total?.type !== 'metricCard' || total.props.variant !== 'compactStack') throw Error('缺少总分卡');
  const program = createSourceProgram(page, {gateway: createPartnerHealthUnionPreview('zeroTotal').dataGateway});
  let snapshot: DataSnapshot | undefined;
  try {
    for await (const update of program.read({roots: [scope.source], conditions: filters})) {
      if (update.sourceId === scope.source) snapshot = update.snapshot;
    }
    expect(snapshot?.status).toBe('ready');
    if (snapshot?.status !== 'ready') throw Error(JSON.stringify(snapshot));
    expect(snapshot.rows).toHaveLength(1);
    const data = {main: {fields: resolveDataSourceFields(page.dataSources[scope.source]), snapshot}};
    expect(fieldValue(total.props.rows[0].valueField, data)).toBe(scope.total);
    expect(snapshot.rows[0]['contribution-score']).toBe(scope.buttons ? 17 : null);
    expect(snapshot.rows[0]['risk-score']).toBe(scope.buttons ? -2 : null);
  } finally { program.dispose(); }
});

it('清空代表处选择回到全球，仍保留两套图表与表格页签', () => {
  const filters = initialFilterValues(page.filters ?? []);
  filters.set('region', {type: 'dimension', dimension: 'representative', level: 'representative', values: []});
  const presentation = compilePresentation(page).evaluate({filters});
  expect(presentation.component('china-overseas-buttons').eligible).toBe(true);
  expect(presentation.component('total-score-card').eligible).toBe(true);
  const tabs = presentation.sections[1].components[0];
  if (tabs.type !== 'tabContainer') throw Error('缺少图表页签');
  expect(tabs.props.tabs).toHaveLength(2);
});
