<script lang="ts">
  import type { DataSnapshot, TableComponent } from '@metriccanvas/page/internal';

  let { pageId, table, snapshot }: { pageId: string; table: TableComponent; snapshot?: DataSnapshot } = $props();
  const sourceId = $derived(table.data.main);
  const componentId = $derived(table.id);
  const code = $derived(snapshot?.status === 'error' ? snapshot.error.code : undefined);
  const message = $derived(snapshot?.status === 'error' ? snapshot.error.message : undefined);

  $effect(() => {
    if (code && code !== 'DQE_CANCELLED') {
      console.error(`[MetricCanvas][${code}] ${message}`, { pageId, componentId, dataSourceId: sourceId });
    }
  });
</script>
