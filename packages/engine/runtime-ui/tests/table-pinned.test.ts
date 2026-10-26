import { expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import fixture from '../../../../pages/capabilities/table/table-pinned-summary.json';
import { parsePage, versionPolicy, type PageDocument } from '@metriccanvas/page';
import { normalizeQueryRows, type DataSnapshot, type EffectiveQuery, type TableComponent } from '@metriccanvas/page/internal';
import { createSourceProgram, initialFilterValues } from '@metriccanvas/data-execution/runtime';
import { executeTableEnhancements } from '../../../../tools/dqe-sim/src/table-enhancements';
import { projectTableRows, tableRowColumn, alignedCellText } from '../../widgets/src/components/table/rows';
import { hostRenderSnapshot } from '../src/widget-host-state';
import { encodeTableWorkbook } from '../src/table-workbook';
import { prepareTableExport } from '../src/table-export';

function setup() {
  const parsed = parsePage({ ...fixture, schemaVersion: versionPolicy.current });
  if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const component = parsed.page.sections[0].components[0] as TableComponent;
  return { page: parsed.page, component };
}
function gateway(calls: string[]) {
  return { async fetchData(query: EffectiveQuery, context?: { dataSourceIds?: readonly string[] }) {
    calls.push(context?.dataSourceIds?.[0] ?? '');
    const item = structuredClone(query.body.dsl_list[0]) as Record<string, unknown>;
    const filter = item.filter as Record<string, unknown>;
    filter.dims = query.filterValues.filter(v => v.target === 'dimension').map(v => ({ dim_name: v.queryField, dim_value_list: v.values }));
    if (query.pagination) item.order = { offset: query.pagination.offset, limit: query.pagination.limit };
    const receipt = executeTableEnhancements(item)!;
    const normalized = normalizeQueryRows(receipt.data, query.fieldMappings);
    if (!normalized.ok) throw Error('normalization failed');
    return { rows: normalized.rows, totalCount: receipt.total_count, cellFallbacks: normalized.cellFallbacks };
  } };
}
it('keeps two query roots independent: region/page changes reuse summary; common business inputs refresh it', async () => {
  const { page, component } = setup(), calls: string[] = [];
  const conditions = initialFilterValues(page.filters ?? []);
  const program = createSourceProgram(page, { gateway: gateway(calls) });
  const snapshots = new Map<string, DataSnapshot>();
  const read = async () => {
    for await (const update of program.read({ roots: Object.values(component.data), conditions, useInitial: false })) snapshots.set(update.sourceId, update.snapshot);
  };
  try {
    await read();
    expect(calls.filter(id => id === 'summary')).toHaveLength(1);
    conditions.set('region', { type: 'dimension', dimension: 'region_code', values: ['region-1'] });
    await read();
    expect(calls.filter(id => id === 'summary')).toHaveLength(1);
    expect(snapshots.get('regions')).toMatchObject({ status: 'ready', totalCount: 1 });
    conditions.set('product', { type: 'dimension', dimension: 'product_code', values: ['premium'] });
    await read();
    expect(calls.filter(id => id === 'summary')).toHaveLength(2);
  } finally { program.dispose(); }
});
it('does not gate body on optional pinned loading/errors and leaves its sequence cell empty in Excel', async () => {
  const { component, page } = setup();
  expect(hostRenderSnapshot(component, new Map([['main', { status: 'ready', rows: [] }], ['china', { status: 'loading' }]]))).toMatchObject({ status: 'ready' });
  const data = {
    main: { fields: page.dataSources.regions.fields, snapshot: { status: 'ready' as const, rows: [{ 'region-id': 'x', 'region-name': '华东', target: 100, actual: 80, rate: 80 }] } },
    china: { fields: page.dataSources.summary.fields, snapshot: { status: 'ready' as const, rows: [{ 'scope-name': '中国区', 'summary-target': 1000, 'summary-actual': 800, 'summary-rate': 80 }], totalCount: 1 } }
  };
  const rows = projectTableRows(data, component.props);
  expect(rows).toHaveLength(2);
  expect(rows[0].kind).toBe('pinnedTop');
  const column = tableRowColumn(component.props.columns[0] as import('@metriccanvas/page/internal').TableColumn, rows[0], data);
  expect(alignedCellText(column.field, data, rows[0])).toBe('中国区');
  const bytes = await encodeTableWorkbook(component, data, new AbortController().signal);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes.buffer);
  const sheet = book.worksheets[0];
  expect(sheet.getCell('A2').value).toBeNull();
  expect(sheet.getCell('B2').value).toBe('中国区');
  expect(sheet.getCell('A3').value).toBe(1);
  data.china.snapshot.rows.push({ ...data.china.snapshot.rows[0] });
  expect(projectTableRows(data, component.props)).toHaveLength(1);
});
it('fails the complete table export for invalid pinned cardinality without discarding valid body rendering', async () => {
  const { page, component } = setup(), conditions = initialFilterValues(page.filters ?? []);
  conditions.set('summary-mode', { type: 'dimension', dimension: 'summary_mode', values: ['multiple'] });
  await expect(prepareTableExport({ page, component, queries: new Map(), controller: new AbortController(),
    state: { currentYear: 2026, filters: conditions, tables: {}, headerFilters: {} }, gateway: gateway([]) })).rejects.toMatchObject({ code: 'EXPORT_INCOMPLETE_DATA' });
});
it('rejects shared main sources, truncated summaries and unsupported schema declarations', () => {
  const original: PageDocument = JSON.parse(JSON.stringify(fixture));
  const versioned = { ...original, schemaVersion: '6.58' };
  expect(parsePage(versioned).ok).toBe(false);
  for (const mutate of [
    (doc: typeof fixture) => { doc.sections[0].components[0].data.china = 'regions'; },
    (doc: typeof fixture) => { Object.assign(doc.dataSources.summary.source.query.body.dsl_list[0].order, { limit: 1 }); }
  ]) {
    const document = structuredClone(fixture); mutate(document);
    expect(parsePage(document).ok).toBe(false);
  }
});
