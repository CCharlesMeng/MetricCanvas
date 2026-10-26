import { expect, it } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import fixture from '../../../page/fixtures/contract-valid/report-date-filters-page.json';
import { exportComponentData, exportComponentSnapshot, type ExportRenderState } from '../src/export-render-state';
import constants from '../../../../pages/capabilities/chart/chart-constant-values-page.json';
import { resolveComponentValue } from '../../widgets/src/shared/component-value';

it('preserves successful table slots when a secondary source fails during report export', () => {
  const parsed=parsePage(fixture);if(!parsed.ok)throw Error('fixture');
  const page=parsed.page,component=page.sections[1].components[0];
  if(component.type!=='table')throw Error('fixture');
  page.dataSources.failed=structuredClone(page.dataSources.sales);
  component.data.extra='failed';
  const state:ExportRenderState={page,currentYear:2026,filters:new Map(),tables:{},headerFilters:{},summaries:{},snapshots:new Map([
    ['sales',{status:'ready',rows:[{entry:'available',amount:7}],totalCount:1}],
    ['failed',{status:'error',error:{code:'DQE_FORBIDDEN',message:'unavailable'}}]
  ])};
  expect(exportComponentSnapshot(state,component)).toMatchObject({status:'ready'});
  expect(exportComponentData(state,component).main?.snapshot.rows).toEqual([{entry:'available',amount:7}]);
  expect(exportComponentData(state,component).extra?.snapshot.rows).toEqual([]);
});

it('preserves original empty/error states for constant values in static export', () => {
  const parsed = parsePage(constants);
  if (!parsed.ok) throw Error('fixture');
  const component = parsed.page.sections[0].components.find(c => c.id === 'gauge-empty-show');
  if (component?.type !== 'gauge') throw Error('fixture');
  const state: ExportRenderState = {page: parsed.page, currentYear: 2026, filters: new Map(), tables: {}, headerFilters: {}, summaries: {},
    snapshots: new Map([['empty', {status: 'empty'}]])};
  const empty = exportComponentData(state, component);
  expect(empty.main?.sourceStatus).toBe('empty');
  expect(resolveComponentValue(component.props, empty, component.props.emptyBehavior).read()).toBe(2);
  state.snapshots = new Map([['empty', {status: 'error', error: {code: 'DQE_FORBIDDEN', message: 'unavailable'}}]]);
  const failed = exportComponentData(state, component);
  expect(failed.main?.sourceStatus).toBe('error');
  expect(resolveComponentValue(component.props, failed, component.props.emptyBehavior).read()).toBeUndefined();
});
