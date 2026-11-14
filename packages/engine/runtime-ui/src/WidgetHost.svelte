<svelte:options css="injected" />
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { DataSnapshot } from '@metriccanvas/page/internal';
  import { displayDataSnapshot } from './widget-host-state';

  interface Props {
    snapshot: DataSnapshot;
    notices?: string[];
    retained?: boolean;
    ready: Snippet<[Extract<DataSnapshot, { status: 'ready' }>]>;
  }

  let { snapshot, ready, notices = [], retained = false }: Props = $props();
  const renderable = $derived(displayDataSnapshot(snapshot));

  $effect(() => {
    if (notices.length) console.warn('[MetricCanvas][DATA_NOTICE]', ...notices);
  });
</script>

<div class="widget-content" aria-busy={snapshot.status === 'loading'} inert={retained} data-retained={retained || undefined}>
  {@render ready(renderable)}
</div>

<style>
  .widget-content {
    position: relative;
    display: flex;
    flex: 1;
    width: 100%;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
  }
</style>
