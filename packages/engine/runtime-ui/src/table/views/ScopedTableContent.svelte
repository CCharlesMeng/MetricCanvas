<svelte:options css="injected" />
<script lang="ts">
  import { onDestroy, tick, untrack } from 'svelte';
  import { resolveDataSourceFields, type Row } from '@metriccanvas/page/internal';
  import type { RowTableInstance } from '../../../../runtime/src/table/expansion';
  import { createTableController } from '../controller';
  import Table from '../../../../widgets/src/components/table/Table.svelte';
  import { createRetainedScreenData } from '../../retained-screen-data';
  import { usableTableProgress } from '../screen-progress';
  const retainedData = createRetainedScreenData();
  let content = $state<HTMLDivElement>();
  let pageRequested = false;

  let { instance, readRevision, onretry }: { instance: RowTableInstance; readRevision(): number; onretry(): void } = $props();
  let localRevision = $state(0);
  const controller = untrack(() => createTableController(instance.page, () => instance.stream ?? null, () => localRevision++,()=>instance.filters,()=>({displayInputs:instance.displaySnapshot,filterRevision:instance.filterRevision})));
  onDestroy(() => controller.dispose());
  // An explicit call retains dependency tracking when consumers compress with pure_getters.
  const snapshot = $derived.by(() => { readRevision(); return instance.snapshots.get(instance.table.data.main); });
  const table = $derived.by(()=>{readRevision();return controller.project(instance.table);});
  $effect(()=>{readRevision();untrack(()=>{controller.syncColumns(instance.table);localRevision++;});});
  const remote = $derived(table.props.pagination?.mode === 'query');
  const view = $derived.by(() => { readRevision(); void localRevision; return controller.render(table); });
  const progress = $derived.by(() => { readRevision(); return usableTableProgress(table, instance.stream?.getScreenProgress?.(table.data.main), view); });
  const rows = $derived.by(() => {
    void localRevision;
    const raw: Row[] = progress?.snapshot.rows ?? (snapshot?.status === 'ready' ? snapshot.rows : []);
    return remote ? raw : controller.present(table, raw, table.props.pagination?.mode !== 'local').rows;
  });
  const pagination = $derived.by(() => {
    void localRevision; readRevision();
    const raw = snapshot?.status === 'ready' ? snapshot.rows : [];
    return remote ? { pageSize: instance.stream?.getQueryPageSize(table.data.main) ?? 20, totalCount: snapshot && 'totalCount' in snapshot ? snapshot.totalCount ?? 0 : 0 }
      : { pageSize: controller.view(table).pageSize, totalCount: controller.present(table, raw, true).totalCount };
  });
  const binding = $derived.by(() => { void localRevision; readRevision(); return controller.binding(table, { filterOptions: {}, paginationConfig: table.props.pagination, pagination, oncellselect() {} }); });
  const screen = $derived(retainedData.read(table, { main: {
    fields: resolveDataSourceFields(instance.page.dataSources[table.data.main]!),
    sourceStatus: snapshot?.status ?? 'loading', snapshot: { status: 'ready', rows }, ...(progress ? {progress:{pendingFields:progress.pendingFields}} : {}),
    diagnostics: { snapshot: snapshot ?? { status: 'loading' } }
  } }, snapshot ?? { status: 'loading' }, binding));
  function changePage(index: number) { pageRequested = true; binding.onpage?.(index); }
  function changePageSize(size: number) { pageRequested = true; binding.onpagesize?.(size); }
  $effect(() => {
    const pending = screen.retained || snapshot?.status === 'loading';
    if (pending || !pageRequested) return;
    pageRequested = false;
    void tick().then(() => content?.querySelector('tbody tr')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  });
</script>

{#if table.props.columns.length===0}
  <Table nested view={{pageIndex:0,sort:[],headerFilters:{}}} props={table.props} data={{main:{fields:{},snapshot:{status:'ready',rows:[]}}}} />
{:else if snapshot?.status === 'error' && !progress}
  <div class="content-state" role="status">明细暂不可用{#if instance.stream}<button type="button" onclick={onretry}>重试</button>{/if}</div>
{:else}
  <div bind:this={content} style="display:contents" inert={screen.retained}>
  <Table nested data={screen.data as import('../../../../widgets/src/shared/component-data').MainDataSlots}
    props={table.props} view={screen.table?.view ?? view} pagination={screen.table?.pagination ?? pagination}
    searchOption={binding.searchOption} onsearchoption={binding.onsearchoption}
    searchDraft={binding.searchDraft} onsearchdraft={binding.onsearchdraft} onsearch={binding.onsearch}
    onpage={changePage} onpagesize={changePageSize} onsort={binding.onsort} />
  </div>
{/if}

<style>
  .content-state { min-height:72px; display:flex; align-items:center; justify-content:center; gap:12px; background:#fff; color:var(--mc-color-muted,#71717a); }
  button { font:inherit; cursor:pointer; }
</style>
