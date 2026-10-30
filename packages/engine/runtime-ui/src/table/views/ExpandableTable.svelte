<svelte:options css="injected" />
<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { expansionRowKey, resolveDataSourceFields, type DataSnapshot, type TableComponent } from '@metriccanvas/page/internal';
  import type { NamedDataSlots } from '../../../../widgets/src/shared/component-data';
  import type { TableRenderBinding } from '../../component-render';
  import { createRowExpansionController } from '../../../../runtime/src/table/expansion';
  import Table from '../../../../widgets/src/components/table/Table.svelte';
  import ScopedTableContent from './ScopedTableContent.svelte';

  let { component, data, binding, snapshot }: { snapshot: DataSnapshot; component: TableComponent; data: NamedDataSlots & { main: NonNullable<NamedDataSlots['main']> }; binding: TableRenderBinding } = $props();
  let revision = $state(0);
  let controller = $state.raw<ReturnType<typeof createRowExpansionController>>();
  const contextPage = $derived(binding.expansion!.page);
  const contextGateway = $derived(binding.expansion!.gateway);
  const scopeKey = $derived(JSON.stringify(component.props.rowExpansion?.selection ? [component.id,component.data,component.props.rowKey,component.props.rowExpansion,binding.expansion!.selection?.identity,[...binding.expansion!.params]] : [component,[...binding.expansion!.filters],[...binding.expansion!.params]]));
  const parentViewKey = $derived(JSON.stringify([binding.view.pageIndex, binding.view.searchQuery, binding.view.headerFilters, binding.pagination?.pageSize]));
  const safeData = $derived(data.main ? data : { main: { fields: resolveDataSourceFields(contextPage.dataSources[component.data.main]!), snapshot: { status: 'ready' as const, rows: [] } } });
  let previousView: string | undefined;
  $effect(() => {
    void scopeKey;
    const next = untrack(() => createRowExpansionController(contextPage, component, contextGateway, binding.expansion!.filters, binding.expansion!.params, () => revision++,binding.expansion!.displaySnapshot,binding.expansion!.filterRevision));
    controller = next; previousView = undefined;
    return () => next.dispose();
  });
  $effect(() => {
    const current = controller, key = parentViewKey, rows = safeData.main.snapshot.rows, loading = snapshot.status === 'loading';
    untrack(() => {
      if (previousView !== undefined && previousView !== key) {
        if(component.props.rowExpansion?.selection)current?.invalidateCache();
        else current?.clear();
      }
      previousView = key; if(loading)current?.invalidateCache();
      if (!loading) {
        if(component.props.rowExpansion?.selection)current?.sync(rows,binding.expansion!,binding.expansion!.selection);
        else current?.retain(rows);
      }
    });
  });
  $effect(()=>{const snapshot=binding.expansion!.displaySnapshot,revision=binding.expansion!.filterRevision,current=controller;untrack(()=>current?.updatePresentation(snapshot,revision));});
  onDestroy(() => controller?.dispose());
  const expansion = $derived.by(() => { void revision; return {
    id: `${binding.expansion!.instanceId}-${component.id}-row`,
    key: (row: import('@metriccanvas/page/internal').Row) => expansionRowKey(row[component.props.rowKey!]),
    expanded: (row: import('@metriccanvas/page/internal').Row) => Boolean(controller?.get(row)),
    toggle: (row: import('@metriccanvas/page/internal').Row) => controller?.toggle(row)
  }; });
</script>

<div aria-busy={snapshot.status === 'loading'} hidden={Boolean(component.props.rowExpansion?.selection && snapshot.status === 'error')}>
<Table data={safeData} props={{ ...component.props, pagination: binding.paginationConfig }} view={binding.view}
  columnCandidates={binding.columnCandidates} oncandidatepreloadvisible={binding.oncandidatepreloadvisible}
  oncandidateopen={binding.oncandidateopen} oncandidatesearch={binding.oncandidatesearch} oncandidatemore={binding.oncandidatemore} oncandidateretry={binding.oncandidateretry}
  interactionGate={binding.interactionGate} toolbarEnabled={binding.toolbarEnabled} searchOption={binding.searchOption} onsearchoption={binding.onsearchoption}
  selectedCell={binding.selectedCell} sortReset={binding.sortReset} filterOptions={binding.filterOptions} filterOptionsStatus={binding.filterOptionsStatus}
  pagination={binding.pagination} searchDraft={binding.searchDraft} exporting={binding.exporting} exportError={binding.exportError}
  onsearchdraft={binding.onsearchdraft} onsearch={binding.onsearch} onexport={binding.onexport} oncancelexport={binding.oncancelexport}
  onpage={binding.onpage} onpagesize={binding.onpagesize} onsort={binding.onsort} onheaderfilter={binding.onheaderfilter}
  oncellselect={binding.oncellselect} onlink={binding.onlink} linkHref={binding.linkHref} {expansion}>
  {#snippet expandedRow(row)}
    {@const instance = controller?.get(row)}
    {#if instance}<ScopedTableContent {instance} {revision} onretry={() => controller?.retry(row)} />{/if}
  {/snippet}
</Table>
</div>
{#if snapshot.status==='error' && component.props.rowExpansion?.selection}<div role="alert">{snapshot.error.message}</div>{/if}
