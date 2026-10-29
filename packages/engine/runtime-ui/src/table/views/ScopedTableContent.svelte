<svelte:options css="injected" />
<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { resolveDataSourceFields, type Row } from '@metriccanvas/page/internal';
  import type { RowTableInstance } from '../../../../runtime/src/table/expansion';
  import { createTableController } from '../controller';
  import Table from '../../../../widgets/src/components/table/Table.svelte';

  let { instance, revision, onretry }: { instance: RowTableInstance; revision: number; onretry(): void } = $props();
  let localRevision = $state(0);
  const controller = untrack(() => createTableController(instance.page, () => instance.stream ?? null, () => localRevision++,()=>instance.filters,()=>({displayInputs:instance.displaySnapshot,filterRevision:instance.filterRevision})));
  onDestroy(() => controller.dispose());
  const snapshot = $derived.by(() => { void revision; return instance.snapshots.get(instance.table.data.main); });
  const table = $derived.by(()=>{void revision;return controller.project(instance.table);});
  $effect(()=>{void revision;untrack(()=>{controller.syncColumns(instance.table);localRevision++;});});
  const remote = $derived(table.props.pagination?.mode === 'query');
  const view = $derived.by(() => { void revision; void localRevision; return controller.render(table); });
  const rows = $derived.by(() => {
    void localRevision;
    const raw: Row[] = snapshot?.status === 'ready' ? snapshot.rows : [];
    return remote ? raw : controller.present(table, raw, table.props.pagination?.mode !== 'local').rows;
  });
  const pagination = $derived.by(() => {
    void localRevision; void revision;
    const raw = snapshot?.status === 'ready' ? snapshot.rows : [];
    return remote ? { pageSize: instance.stream?.getQueryPageSize(table.data.main) ?? 20, totalCount: snapshot && 'totalCount' in snapshot ? snapshot.totalCount ?? 0 : 0 }
      : { pageSize: controller.view(table).pageSize, totalCount: controller.present(table, raw, true).totalCount };
  });
  const binding = $derived.by(() => { void localRevision; void revision; return controller.binding(table, { filterOptions: {}, paginationConfig: table.props.pagination, pagination, oncellselect() {} }); });
</script>

{#if table.props.columns.length===0}
  <Table nested view={{pageIndex:0,sort:[],headerFilters:{}}} props={table.props} data={{main:{fields:{},snapshot:{status:'ready',rows:[]}}}} />
{:else if !snapshot || snapshot.status === 'loading'}
  <div class="content-state" role="status">正在加载明细…</div>
{:else if snapshot.status === 'error'}
  <div class="content-state" role="status">明细暂不可用{#if instance.stream}<button type="button" onclick={onretry}>重试</button>{/if}</div>
{:else}
  <Table nested data={{ main: { fields: resolveDataSourceFields(instance.page.dataSources[table.data.main]!), snapshot: { status: 'ready', rows }, diagnostics: {snapshot} } }}
    props={table.props} {view} {pagination}
    searchOption={binding.searchOption} onsearchoption={binding.onsearchoption}
    searchDraft={binding.searchDraft} onsearchdraft={binding.onsearchdraft} onsearch={binding.onsearch}
    onpage={binding.onpage} onpagesize={binding.onpagesize} onsort={binding.onsort} />
{/if}

<style>
  .content-state { min-height:72px; display:flex; align-items:center; justify-content:center; gap:12px; background:#fff; color:var(--mc-color-muted,#71717a); }
  button { font:inherit; cursor:pointer; }
</style>
