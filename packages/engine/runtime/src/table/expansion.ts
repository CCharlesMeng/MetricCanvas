import { expansionRowKey, rowExpansionPage, resolveDataSourceFields, validateContractRows, stableRowQuery, type Page, type TableComponent, type Row, type DataSnapshot, type EffectiveQuery } from '@metriccanvas/page/internal';
import type { DataGateway } from '../ports';
import type { FilterValues } from '../filter-state';
import { createFilterState } from '../filter-state';
import type { PageParamValues } from '../page-params';
import { scopedFilterValues } from '../detail-view';
import { orchestrate, type PageSnapshotStream, type PageDataSnapshots } from '../orchestrator';
export interface RowTableInstance {
    key: string;
    row: Row;
    page: Page;
    table: TableComponent;
    stream?: PageSnapshotStream;
    snapshots: PageDataSnapshots;
    filters: FilterValues;
    displaySnapshot?: import('@metriccanvas/page/internal').DisplaySnapshot;
    filterRevision?: number;
    dispose(): void;
}
const unavailable = (): DataSnapshot => ({ status: 'error', error: { code: 'DQE_ROW_CONTRACT_ERROR', message: '子表格字段或行键不可用' } });
function checkedRows(snapshot: DataSnapshot, table: TableComponent): DataSnapshot {
    if (snapshot.status !== 'ready')
        return snapshot;
    const keys = snapshot.rows.map(row => expansionRowKey(row[table.props.rowKey!]));
    return keys.some(key => key === undefined) || new Set(keys).size !== keys.length ? unavailable() : snapshot;
}
/** Limit expanded-row requests across this parent table; queued cancellation is immediate. */
function limitedGateway(gateway: DataGateway): DataGateway {
    let active = 0;
    const queue: Array<() => void> = [];
    return { fetchData(query, context, signal) {
            return new Promise((resolve, reject) => {
                let started = false;
                const abort = () => {
                    if (started)
                        return;
                    const index = queue.indexOf(start);
                    if (index >= 0)
                        queue.splice(index, 1);
                    reject(Object.assign(new Error('查询已取消'), { code: 'DQE_CANCELLED' }));
                };
                const start = () => {
                    signal?.removeEventListener('abort', abort);
                    if (signal?.aborted) {
                        abort();
                        return;
                    }
                    started = true;
                    active++;
                    void Promise.resolve().then(() => gateway.fetchData(query, context, signal)).then(resolve, reject).finally(() => {
                        active--;
                        while (active < 4 && queue.length)
                            queue.shift()!();
                    });
                };
                if (signal?.aborted) {
                    abort();
                    return;
                }
                signal?.addEventListener('abort', abort, { once: true });
                if (active < 4)
                    start();
                else
                    queue.push(start);
            });
        } };
}
/** Each expansion owns an ordinary source program and table view, with no cross-fold cache. */
export function createRowExpansionController(page: Page, parent: TableComponent, gateway: DataGateway, filters: FilterValues, params: PageParamValues, changed: () => void, displaySnapshot?: import('@metriccanvas/page/internal').DisplaySnapshot, filterRevision?: number) {
    let presentationKey = JSON.stringify([displaySnapshot, filterRevision]);
    const instances = new Map<string, RowTableInstance>();
    const limited = limitedGateway(gateway);
    const keyOf = (row: Row) => ['subtotal', 'total'].includes(String(row[parent.props.rowKindField ?? ''])) ? undefined : parent.props.rowKey ? expansionRowKey(row[parent.props.rowKey]) : undefined;
    function close(key: string) { const instance = instances.get(key); if (!instance)
        return; instances.delete(key); instance.dispose(); }
    function open(row: Row, key: string) {
        const expansion = parent.props.rowExpansion!;
        let scope: ReturnType<typeof rowExpansionPage>;
        try {
            scope = rowExpansionPage(page, parent);
        }
        catch {
            return;
        }
        const instance: RowTableInstance = { ...scope, key, row, filters, displaySnapshot, filterRevision, snapshots: new Map(), dispose() { } };
        instances.set(key, instance);
        const sourceId = scope.table.data.main;
        try {
            if (expansion.data.type === 'recordList') {
                const rows = row[expansion.data.field];
                const fields = resolveDataSourceFields(scope.page.dataSources[sourceId]!);
                const snapshot: DataSnapshot = Array.isArray(rows) && validateContractRows(rows, fields).ok
                    ? checkedRows({ status: 'ready', rows }, scope.table) : unavailable();
                instance.snapshots = new Map([[sourceId, snapshot]]);
            }
            else {
                const values = scopedFilterValues(page, expansion.data.filters, expansion.data.bindings, row, filters, params);
                instance.filters = values;
                const scopedGateway: DataGateway = { fetchData(query, context, signal) {
                        return limited.fetchData(stableRowQuery(query, expansion.table.rowKey), context, signal);
                    } };
                const stream = orchestrate(scope.page, scopedGateway, createFilterState(values, scope.page.filters ?? []), undefined, undefined, { displayInputs: () => displaySnapshot, filterRevision: () => filterRevision ?? 0 });
                instance.stream = stream;
                const unsubscribe = stream.subscribe(snapshots => {
                    if (instances.get(key) !== instance)
                        return;
                    instance.snapshots = new Map([...snapshots].map(([id, snapshot]) => [id, checkedRows(snapshot, scope.table)]));
                    changed();
                });
                instance.dispose = unsubscribe;
            }
        }
        catch {
            instance.snapshots = new Map([[sourceId, unavailable()]]);
        }
        changed();
    }
    return {
        keyOf,
        updatePresentation(snapshot: typeof displaySnapshot, revision: typeof filterRevision) {
            const key = JSON.stringify([snapshot, revision]);
            if (key === presentationKey)
                return;
            presentationKey = key;
            displaySnapshot = snapshot;
            filterRevision = revision;
            for (const instance of instances.values()) {
                instance.displaySnapshot = snapshot;
                instance.filterRevision = revision;
                instance.stream?.syncPresentation?.();
            }
            changed();
        },
        get(row: Row) { const key = keyOf(row); return key === undefined ? undefined : instances.get(key); },
        toggle(row: Row) {
            const key = keyOf(row);
            if (key === undefined)
                return;
            if (instances.has(key)) {
                close(key);
                changed();
                return;
            }
            if (parent.props.rowExpansion?.mode === 'single')
                for (const id of instances.keys())
                    close(id);
            open(row, key);
        },
        retain(rows: readonly Row[]) {
            const counts = new Map<string, number>();
            for (const row of rows) {
                const key = keyOf(row);
                if (key !== undefined)
                    counts.set(key, (counts.get(key) ?? 0) + 1);
            }
            let removed = false;
            for (const [key, instance] of instances) {
                const row = rows.find(row => keyOf(row) === key);
                if (counts.get(key) !== 1 || !row || JSON.stringify(row) !== JSON.stringify(instance.row)) {
                    close(key);
                    removed = true;
                }
            }
            if (removed)
                changed();
        },
        clear() { const had = instances.size > 0; for (const key of instances.keys())
            close(key); if (had)
            changed(); },
        retry(row: Row) { const instance = this.get(row); if (instance?.stream)
            instance.stream.refreshQuery(instance.table.data.main); },
        dispose() { for (const key of instances.keys())
            close(key); }
    };
}
