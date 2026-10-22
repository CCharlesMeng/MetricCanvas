import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage } from '../../../packages/page/src';
import type { Row, TableComponent } from '../../../packages/page/src/internal';
import { createDqeGateway } from '../../../packages/engine/data-gateway/src/dqe';
import { createRowExpansionController } from '../../../packages/engine/runtime/src/row-expansion';
import { createDqeSimServer, DQE_EXECUTE_PATH } from '../src/server';
import { executeRowExpansion } from '../src/row-expansion';

it('executes the registered query page through the real gateway and Sim with isolated windows', async () => {
  const parsed = parsePage(JSON.parse(readFileSync(new URL('../../../pages/capabilities/table/table-row-expansion-query.json', import.meta.url), 'utf8')));
  if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const server = createDqeSimServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw Error('server');
  const table = parsed.page.sections[0]!.components[0] as TableComponent;
  const gateway = createDqeGateway({ endpoint: `http://127.0.0.1:${address.port}${DQE_EXECUTE_PATH}` });
  const controller = createRowExpansionController(parsed.page, table, gateway, new Map(), new Map(), () => {});
  const row = (id: string): Row => ({ 'customer-id': id });
  const ids = (id: string) => { const scope = controller.get(row(id))!, snapshot = scope.snapshots.get(scope.table.data.main); return snapshot?.status === 'ready' ? snapshot.rows.map(item => item['order-id']) : snapshot?.status; };
  try {
    controller.toggle(row('C01')); controller.toggle(row('C02'));
    await expect.poll(() => ids('C01')).toEqual(Array.from({ length: 10 }, (_, i) => `C01-${String(i + 1).padStart(3, '0')}`));
    await expect.poll(() => ids('C02')).toEqual(Array.from({ length: 10 }, (_, i) => `C02-${String(i + 1).padStart(3, '0')}`));
    const first = controller.get(row('C01'))!;
    first.stream!.setQueryPage(first.table.data.main, 2);
    await expect.poll(() => ids('C01')).toEqual(['C01-021', 'C01-022', 'C01-023', 'C01-024', 'C01-025']);
    expect(first.snapshots.get(first.table.data.main)).toMatchObject({ totalCount: 25 });
    expect(ids('C02')).toHaveLength(10);
    first.stream!.setQueryPageSize(first.table.data.main, 20);
    await expect.poll(() => ids('C01')).toHaveLength(20);
  } finally {
    controller.dispose(); server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

it.each([{ values: [] }, { values: ['UNKNOWN'] }, { values: ['C01', 'C02'] }])('rejects missing or ambiguous synthetic parents: $values', ({ values }) => {
  const query = { output_dims: ['row_customer', 'row_order_id', 'row_product'], output_metrics: ['row_amount'], filter: { dims: [{ dim_name: 'row_customer', dim_value_list: values }], metrics: [] }, order: { offset: 0, limit: 10, by: [{ field: 'row_order_id', type: 'asc', priority: 1 }] } };
  expect(executeRowExpansion(query)?.code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
});
