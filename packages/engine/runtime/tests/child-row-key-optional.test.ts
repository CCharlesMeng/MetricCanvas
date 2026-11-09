import { expect, it } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import type { TableComponent } from '@metriccanvas/page/internal';
import raw from '../../../../pages/capabilities/table/table-child-keyless.json';
import { createKeylessChildPreview } from '../../../../apps/playground/fixtures/child-keyless';
import { initialFilterValues } from '../src/filter-state';
import { createRowExpansionController } from '../src/table/expansion';

function setup(declared = false) {
  const document = structuredClone(raw);
  const parsed = parsePage(document);
  if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const page = parsed.page, table = page.sections[0]!.components.find((component): component is TableComponent => component.type === 'table')!;
  if (declared) table.props.rowExpansion!.table.rowKey = 'office-id';
  const filters = initialFilterValues(page.filters ?? []), params = new Map();
  const controller = createRowExpansionController(page, table, createKeylessChildPreview().dataGateway, filters, params, () => {});
  const row = { 'row-id': 1, 'region-id': 'R01', 'region-name': '华东', amount: 1200 };
  controller.sync([row], { filters, params }, { status: 'unrestricted', identity: 'empty' });
  return { controller, row };
}
it('keeps repeated child keys as independent rows and resumes the folded page', async () => {
  const { controller, row } = setup();
  try {
    controller.toggle(row);
    await expect.poll(() => controller.get(row)?.snapshots.get('office-detail')?.status).toBe('ready');
    const instance = controller.get(row)!;
    expect(instance.snapshots.get('office-detail')).toMatchObject({ status: 'ready', totalCount: 6, rows: [{ 'office-id': 'O101', amount: 360 }, { 'office-id': 'O101', amount: 999 }] });
    instance.stream!.setQueryPage('office-detail', 1);
    await expect.poll(() => instance.snapshots.get('office-detail')).toMatchObject({ status: 'ready', rows: [{ 'office-id': 'O102' }, { 'office-id': 'O103' }] });
    controller.toggle(row); controller.toggle(row);
    expect(controller.get(row)).toBe(instance);
    expect(instance.stream!.getQueryView('office-detail')!.pageIndex).toBe(1);
  } finally { controller.dispose(); }
});
it('still rejects duplicated values when a child key is explicitly declared', async () => {
  const { controller, row } = setup(true);
  try {
    controller.toggle(row);
    await expect.poll(() => controller.get(row)?.snapshots.get('office-detail')?.status).toBe('error');
  } finally { controller.dispose(); }
});
