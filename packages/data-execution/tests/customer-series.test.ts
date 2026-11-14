import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import type {DataSnapshot} from '@metriccanvas/page/internal';
import {initialFilterValues} from '../src/filter-values';
import {createSourceProgram} from '../src/source-program/session';
import {createCustomerSeriesPreview} from '../../../apps/playground/fixtures/customer-series';

const document = JSON.parse(readFileSync('pages/capabilities/chart/chart-customer-series.json', 'utf8'));
const cases = [
  {selection: [], na: [200, 160, 120, 70], commercial: [80, 120, 100, 60]},
  {selection: ['战略'], na: [40, 30, 20, 0], commercial: [null, null, null, null]},
  {selection: ['卓越', '核心'], na: [160, 130, 100, 70], commercial: [null, null, null, null]},
  {selection: ['战略', '商业客户'], na: [40, 30, 20, 0], commercial: [80, 120, 100, 60]},
  {selection: ['商业客户'], na: [null, null, null, null], commercial: [80, 120, 100, 60]}
];

it.each(cases)('queries selected categories and computes two independent series: $selection', async ({selection, na, commercial}) => {
  const parsed = parsePage(document);
  if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const preview = createCustomerSeriesPreview();
  const conditions = initialFilterValues(parsed.page.filters!);
  conditions.set('customer-category', {type: 'dimension', dimension: 'customer-level', values: selection});
  const program = createSourceProgram(parsed.page, {gateway: preview.dataGateway});
  let snapshot: DataSnapshot | undefined;
  try {
    for await (const update of program.read({roots: ['customer-sales'], conditions, purpose: 'complete'})) snapshot = update.snapshot;
    expect(snapshot?.status).toBe('ready');
    if (snapshot?.status !== 'ready') throw Error('Expected computed rows');
    expect(snapshot.rows.map(row => row.region)).toEqual(['华东', '华南', '华北', '西部']);
    expect(snapshot.rows.map(row => row['huawei-na'])).toEqual(na);
    expect(snapshot.rows.map(row => row.commercial)).toEqual(commercial);
    expect(preview.requests).toHaveLength(1);
    expect(preview.requests[0]).toMatchObject({
      output_dims: ['大区', '客户级别'],
      filter: {dims: selection.length ? [{dim_name: '客户级别', dim_value_list: selection}] : []}
    });
  } finally {
    program.dispose();
  }
});

it.each(['empty', 'error'])('keeps synthetic %s distinct from zero-valued series', async state => {
  const parsed = parsePage(document);
  if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const preview = createCustomerSeriesPreview(state);
  const program = createSourceProgram(parsed.page, {gateway: preview.dataGateway});
  let snapshot: DataSnapshot | undefined;
  try {
    for await (const update of program.read({roots: ['customer-sales'], conditions: initialFilterValues(parsed.page.filters!), purpose: 'complete'})) snapshot = update.snapshot;
    expect(snapshot?.status).toBe(state);
    expect(preview.requests).toHaveLength(1);
  } finally {
    program.dispose();
  }
});
