import { expect, it } from 'vitest';
import type { Page } from '@metriccanvas/page';
import type { EffectiveQuery, DisplaySnapshot } from '@metriccanvas/page/internal';
import { orchestrate } from '../src/orchestrator';
import { createFilterState } from '../src/filter-state';
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
function fixture(): Page {
    return { schemaVersion: '6.62', id: 'column-query', dataSources: { records: {
                fields: { name: { type: 'string', role: 'dimension', queryField: 'name' }, amount: { type: 'number', role: 'measure', queryField: 'amount' } },
                source: { type: 'query', query: { language: 'dqe', body: { dsl_list: [{ output_dims: ['name'], output_metrics: ['amount'], order: { order_by_field: 'amount', type: 'desc' } }] } } }
            } }, sections: [{ id: 'main', components: [{ type: 'table', id: 'table', data: { main: 'records' }, layout: { span: 12 }, props: {
                            columns: [{ field: 'name' }, { field: 'amount', sortable: true, filterable: { mode: 'numberRange' }, visibleWhen: { fact: 'detail', op: 'eq', value: true } }]
                        } }] }] };
}
it('reconciles fact changes before query capture and sends one cleaned request', async () => {
    const page = fixture(), requests: EffectiveQuery[] = [];
    let snapshot: DisplaySnapshot = { permissionRevision: 'same', permissions: {}, values: { detail: { status: 'ready', value: true } } };
    const stream = orchestrate(page, { async fetchData(query) { requests.push(structuredClone(query)); return { rows: [{ name: 'A', amount: 1 }], totalCount: 1 }; } }, createFilterState(), undefined, undefined, { displayInputs: () => snapshot });
    const dispose = stream.subscribe(() => { });
    await flush();
    stream.setQuerySort('records', [{ field: 'amount', direction: 'asc' }]);
    await flush();
    stream.setQueryHeaderFilters('records', { amount: { mode: 'numberRange', from: 2 } });
    await flush();
    const count = requests.length;
    snapshot = { ...snapshot, values: { detail: { status: 'ready', value: false } } };
    stream.syncPresentation?.();
    await flush();
    expect(requests).toHaveLength(count + 1);
    expect(stream.captureViews().get('records')).toMatchObject({ sort: [], predicates: [], pageIndex: 0 });
    expect(requests.at(-1)?.sort).toBeUndefined();
    expect(requests.at(-1)?.body.dsl_list[0].order).toEqual({ order_by_field: 'amount', type: 'desc' });
    stream.syncPresentation?.();
    await flush();
    expect(requests).toHaveLength(count + 1);
    dispose();
});
