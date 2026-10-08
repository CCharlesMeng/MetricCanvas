<script lang="ts">
  import type { Page } from '@metriccanvas/page';
  import { resolveDataSourceFields, type Component, type DataSnapshot, type TableComponent } from '@metriccanvas/page/internal';
  import type { PageDataSnapshots } from '../../runtime/src';
  import { initialTableSort, type NamedDataSlots, type TableViewState } from '../../widgets/src';
  import type { TableRenderBinding } from './component-render';
  import { sortTableRows } from './table-state';
  import { hostRenderSnapshot, renderableDataSnapshot } from './widget-host-state';
  import ComponentRenderer from './ComponentRenderer.svelte';
  import RuntimeSection from './RuntimeSection.svelte';

  let { page, components, snapshots }: { page: Page; components: Component[]; snapshots: PageDataSnapshots } = $props();
  let views = $state<Record<string, TableViewState>>({});
  let sizes = $state<Record<string, number>>({});
  function view(component: TableComponent): TableViewState {
    return views[component.id] ?? { pageIndex: 0, sort: initialTableSort(undefined), headerFilters: {} };
  }
  function slots(component: Component): Map<string, DataSnapshot> {
    return new Map(Object.entries(component.data ?? {}).map(([slot, id]) => [slot, snapshots.get(id) ?? { status: 'loading' }]));
  }
  function data(component: Component): NamedDataSlots {
    const result: NamedDataSlots = {};
    for (const [slot, id] of Object.entries(component.data ?? {})) {
      const snapshot = snapshots.get(id);
      if (!snapshot) continue;
      let ready = renderableDataSnapshot(snapshot);
      if (!ready) continue;
      if (component.type === 'table' && slot === 'main') {
        const state = view(component);
        let rows = sortTableRows(ready.rows, state.sort);
        const pagination = component.props.pagination;
        if (pagination?.mode === 'local') {
          const size = sizes[component.id] ?? pagination.pageSize;
          rows = rows.slice(state.pageIndex * size, (state.pageIndex + 1) * size);
        }
        ready = { ...ready, rows };
      }
      result[slot] = { snapshot: ready, fields: resolveDataSourceFields(page.dataSources[id]) };
    }
    return result;
  }
  function table(component: Component): TableRenderBinding | undefined {
    if (component.type !== 'table') return undefined;
    const current = view(component);
    const source = snapshots.get(component.data.main);
    const pagination = component.props.pagination;
    return {
      view: current, filterOptions: {}, paginationConfig: pagination,
      pagination: pagination?.mode === 'local' ? {
        pageSize: sizes[component.id] ?? pagination.pageSize,
        totalCount: source?.status === 'ready' ? source.rows.length : 0
      } : undefined,
      onpage: pageIndex => { views[component.id] = { ...current, pageIndex }; },
      onpagesize: size => { sizes[component.id] = size; views[component.id] = { ...current, pageIndex: 0 }; },
      onsort: sort => { views[component.id] = { ...current, sort, pageIndex: 0 }; },
      onheaderfilter: () => {}, oncellselect: () => {}
    };
  }
</script>

<!-- Detail components use the same layout owner as main-page components,
     including declared span, chart drawing space and direct component boxes. -->
<div class="detail-layout">
  <RuntimeSection section={{ id: 'detail-view', container: 'plain', components }}>
    {#snippet componentContent(component: Component)}
      <ComponentRenderer {component} data={data(component)} snapshot={hostRenderSnapshot(component, slots(component))}
        pageSnapshots={snapshots} table={table(component)} />
    {/snippet}
  </RuntimeSection>
</div>

<style>
  .detail-layout {
    width: 100%;
    min-width: 0;
    flex: none;
    container: mc-runtime / inline-size;
  }
</style>
