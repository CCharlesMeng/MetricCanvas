<svelte:options css="injected" />
<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { resolveDataSourceFields, type DataSnapshot, type Row, type TableComponent } from '@metriccanvas/page/internal';
  import { Table, type NamedDataSlots } from '../../../../widgets/src';
  import type { TableRenderBinding } from '../../component-render';
  import { createRowExpansionController } from '../../../../runtime/src/internal';
  import TableDataDiagnostic from './TableDataDiagnostic.svelte';
  import ScopedTableContent from './ScopedTableContent.svelte';

  let { component, data, binding, snapshot }: { snapshot: DataSnapshot; component: TableComponent; data: NamedDataSlots & { main: NonNullable<NamedDataSlots['main']> }; binding: TableRenderBinding } = $props();
  let revision = $state(0);
  const readRevision = () => revision;
  let controller = $state.raw<ReturnType<typeof createRowExpansionController>>();
  const contextPage = $derived(binding.expansion!.page);
  const contextGateway = $derived(binding.expansion!.gateway);
  const scopeKey = $derived(JSON.stringify(component.props.rowExpansion?.selection ? [component.id,component.data,component.props.rowKey,component.props.rowExpansion,binding.expansion!.selection?.identity,[...binding.expansion!.params]] : [component,[...binding.expansion!.filters],[...binding.expansion!.params]]));
  const parentViewKey = $derived(JSON.stringify([binding.view.pageIndex, binding.view.searchQuery, binding.view.headerFilters, binding.pagination?.pageSize]));
  const safeData = $derived(data.main ? data : { main: { fields: resolveDataSourceFields(contextPage.dataSources[component.data.main]!), snapshot: { status: 'ready' as const, rows: [] } } });
  let previousView: string | undefined;
  let previousDefault: NonNullable<TableRenderBinding['expansion']>['defaultExpansion'];
  $effect(() => {
    void scopeKey;
    const next = untrack(() => createRowExpansionController(contextPage, component, contextGateway, binding.expansion!.filters, binding.expansion!.params, () => revision++,binding.expansion!.displaySnapshot,binding.expansion!.filterRevision));
    controller = next; previousView = undefined; previousDefault = undefined;
    return () => next.dispose();
  });
  $effect(() => {
    const current = controller, key = parentViewKey, rows = safeData.main.snapshot.rows, loading = snapshot.status === 'loading';
    const context = binding.expansion!, defaultExpansion = context.defaultExpansion;
    untrack(() => {
      if (!current) return;
      const viewChanged = previousView !== undefined && previousView !== key;
      if (viewChanged) {
        if (component.props.rowExpansion?.selection) current.invalidateCache();
        else current.clear();
      }
      previousView = key;
      if (loading) {
        previousDefault = undefined;
        current.invalidateCache();
        return;
      }
      const newDefault = defaultExpansion && (viewChanged || previousDefault?.snapshot !== defaultExpansion.snapshot ||
        previousDefault.row !== defaultExpansion.row);
      previousDefault = defaultExpansion;
      current.sync(rows, context, context.selection, newDefault ? defaultExpansion.row : undefined);
    });
  });
  $effect(()=>{const snapshot=binding.expansion!.displaySnapshot,revision=binding.expansion!.filterRevision,current=controller;untrack(()=>current?.updatePresentation(snapshot,revision));});
  onDestroy(() => controller?.dispose());
  const expansion = $derived.by(() => { void revision; return {
    id: `${binding.expansion!.instanceId}-${component.id}-row`,
    key: (row: Row) => controller?.keyOf(row),
    expanded: (row: Row) => Boolean(controller?.get(row)),
    toggle: (row: Row) => controller?.toggle(row)
  }; });
</script>

<TableDataDiagnostic pageId={contextPage.id} table={component} {snapshot} />
<div aria-busy={snapshot.status === 'loading'} inert={snapshot.status === 'loading' && !data.main.progress}>
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
    {#if instance}<ScopedTableContent {instance} {readRevision} onretry={() => controller?.retry(row)} />{/if}
  {/snippet}
</Table>
</div>
