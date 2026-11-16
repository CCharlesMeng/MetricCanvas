<script lang="ts">
  import { debugWarn } from '@metriccanvas/data-execution/runtime';
  import type { DataWarning } from '@metriccanvas/page/internal';
  let { warnings }: { warnings: DataWarning[] } = $props();

  $effect(() => {
    if (warnings.length) debugWarn('[MetricCanvas][TABLE_DATA_WARNING]', { warnings });
  });
</script>
