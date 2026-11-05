<script lang="ts">
  import type { DataWarning } from '@metriccanvas/page/internal';
  let { warnings }: { warnings: DataWarning[] } = $props();

  $effect(() => {
    if (warnings.length) console.warn('[MetricCanvas][TABLE_DATA_WARNING]', { warnings });
  });
</script>
