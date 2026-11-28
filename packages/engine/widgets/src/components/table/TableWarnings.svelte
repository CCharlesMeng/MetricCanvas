<script lang="ts">
  import { debugWarn } from '../../shared/debug-warnings';
  import type { DataWarning } from '@metriccanvas/page/internal';
  let { warnings }: { warnings: DataWarning[] } = $props();

  $effect(() => {
    if (warnings.length) debugWarn('[MetricCanvas][TABLE_DATA_WARNING]', { warnings });
  });
</script>
