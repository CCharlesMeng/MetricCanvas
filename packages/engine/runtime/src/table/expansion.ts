import { expansionRowKey, rowExpansionPage, resolveDataSourceFields, validateContractRows, stableRowQuery, type Page, type TableComponent, type Row, type DataSnapshot, type EffectiveQuery } from '@metriccanvas/page/internal';
import type { DataGateway } from '../ports';
import type { FilterValues } from '../filter-state';
import { createFilterState } from '../filter-state';
import type { PageParamValues } from '../page-params';
import { rowExpansionFilters, type HierarchySelection, type HierarchyContext } from './hierarchy-selection';
import {createFoldedTableCache} from './folded-cache';
import { canonicalizeJson, sourceFilterIds, type TableQueryView } from '@metriccanvas/page/internal';
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
    return { ...gateway, fetchData(query, context, signal) {
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
/** Each parent owns an isolated query session; successful folds can be resumed. */
export function createRowExpansionController(page: Page, parent: TableComponent, gateway: DataGateway, filters: FilterValues, params: PageParamValues, changed: () => void, displaySnapshot?: import('@metriccanvas/page/internal').DisplaySnapshot, filterRevision?: number) {
    let selection:HierarchySelection|undefined;
    let autoAttempted=false;
    let childIntent=false;
    let selectedParentValue:string|undefined;
    let presentationKey = JSON.stringify([displaySnapshot, filterRevision]);
    const instances = new Map<string, RowTableInstance>();
    const folded=createFoldedTableCache();
    const foldContext=()=>canonicalizeJson({filters:[...filters],params:[...params],selection,displaySnapshot,filterRevision});
    const limited = limitedGateway(gateway);
    const keyOf = (row: Row) => ['subtotal', 'total'].includes(String(row[parent.props.rowKindField ?? ''])) ? undefined : parent.props.rowKey ? expansionRowKey(row[parent.props.rowKey]) : undefined;
    function close(key: string, cache=false) {
        const instance=instances.get(key);
        if(!instance)return;
        instances.delete(key);
        if(!cache||!folded.keep(instance,foldContext()))instance.dispose();
    }
    function open(row: Row, key: string,views?:ReadonlyMap<string,TableQueryView>) {
        const cached=folded.take(key,row,foldContext());
        if(cached){instances.set(key,cached);changed();return;}
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
                startQuery(instance,views);
            }
        }
        catch {
            instance.snapshots = new Map([[sourceId, unavailable()]]);
        }
        changed();
    }
    function startQuery(instance:RowTableInstance,views?:ReadonlyMap<string,TableQueryView>){
        const expansion=parent.props.rowExpansion!;
        if(expansion.data.type!=='query')return;
        instance.filters=rowExpansionFilters(page,parent,instance.row,{filters,params},selection);
        const scopedGateway:DataGateway={...(parent.props.rowExpansion?.selection?limited:{}),fetchData(query,context,signal){return limited.fetchData(stableRowQuery(query,expansion.table.rowKey),context,signal);}};
        const stream=orchestrate(instance.page,scopedGateway,createFilterState(instance.filters,instance.page.filters??[]),undefined,undefined,
            {displayInputs:()=>displaySnapshot,filterRevision:()=>filterRevision??0},{},views);
        instance.stream=stream;
        instance.dispose=stream.subscribe(snapshots=>{
            if(instances.get(instance.key)!==instance)return;
            instance.snapshots=new Map([...snapshots].map(([id,snapshot])=>[id,checkedRows(snapshot,instance.table)]));changed();
        });
    }
    function refresh(instance:RowTableInstance,row:Row){
        const values=rowExpansionFilters(page,parent,row,{filters,params},selection);
        const ids=new Set(sourceFilterIds(instance.page.dataSources[instance.table.data.main]));
        const signature=(values:FilterValues)=>JSON.stringify([...values].filter(([id])=>ids.has(id)));
        instance.row=row;
        if(signature(values)===signature(instance.filters))return;
        const views=new Map([...instance.stream?.captureViews()??[]].map(([id,view])=>[id,{...view,pageIndex:0}]));
        instance.dispose();instance.snapshots=new Map();startQuery(instance,views);
    }
    function selectionMove(next:HierarchySelection|undefined){
        const moved=next?.status==='selected'&&selectedParentValue!==undefined&&selectedParentValue!==next.parentValue;
        if(!moved)return {moved:false,views:undefined};
        const instance=[...instances.values()][0];
        return {moved:true,views:instance?.stream?.captureViews()};
    }
    function syncSelectedRow(rows:readonly Row[],next:HierarchySelection|undefined,move:ReturnType<typeof selectionMove>){
        if(next?.status!=='selected'||!next.childValue)return;
        selectedParentValue=next.parentValue;
        if(autoAttempted&&!move.moved)return;
        if(!autoAttempted)childIntent=true;
        autoAttempted=true;
        if(!childIntent||rows.length!==1)return;
        const row=rows[0]!,key=keyOf(row);
        if(key===undefined||instances.has(key))return;
        const views=move.views&&new Map([...move.views].map(([id,view])=>[id,{...view,pageIndex:0}]));
        open(row,key,views);
    }
    return {
        keyOf,
        sync(rows:readonly Row[],context:HierarchyContext,next?:HierarchySelection){
            filters=context.filters;params=context.params;selection=next;
            this.updatePresentation(context.displaySnapshot,context.filterRevision);
            const move=selectionMove(next);
            this.retain(rows);
            syncSelectedRow(rows,next,move);
        },
        updatePresentation(snapshot: typeof displaySnapshot, revision: typeof filterRevision) {
            const key = JSON.stringify([snapshot, revision]);
            if (key === presentationKey)
                return;
            presentationKey = key;
            folded.clear();
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
            if(selection?.childValue)childIntent=!instances.has(key);
            if (instances.has(key)) {
                close(key,true);
                changed();
                return;
            }
            if (parent.props.rowExpansion?.mode === 'single')
                for (const id of instances.keys())
                    close(id,true);
            open(row, key);
        },
        retain(rows: readonly Row[]) {
            folded.retain(rows,keyOf,foldContext());
            const counts = new Map<string, number>();
            for (const row of rows) {
                const key = keyOf(row);
                if (key !== undefined)
                    counts.set(key, (counts.get(key) ?? 0) + 1);
            }
            let removed = false;
            for (const [key, instance] of instances) {
                const row = rows.find(row => keyOf(row) === key);
                if (counts.get(key) !== 1 || !row || (!parent.props.rowExpansion?.selection && JSON.stringify(row) !== JSON.stringify(instance.row))) {
                    close(key);
                    removed = true;
                }else if(parent.props.rowExpansion?.selection){
                    try{refresh(instance,row);}catch{instance.dispose();instance.snapshots=new Map([[instance.table.data.main,unavailable()]]);}
                }
            }
            if (removed)
                changed();
        },
        invalidateCache(){folded.clear();},
        clear() { folded.clear();const had = instances.size > 0; for (const key of instances.keys())
            close(key); if (had)
            changed(); },
        retry(row: Row) { const instance = this.get(row); if (instance?.stream)
            instance.stream.refreshQuery(instance.table.data.main); },
        dispose() { folded.clear();for (const key of instances.keys())
            close(key); }
    };
}
