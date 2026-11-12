<svelte:options css="injected" />
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { DataSnapshot } from '@metriccanvas/page/internal';
  import { displayDataSnapshot } from './widget-host-state';
  import LoadingSpinner from '../../widgets/src/shared/LoadingSpinner.svelte';

  interface Props {
    snapshot: DataSnapshot;
    notices?: string[];
    showLoadingIndicator?: boolean;
    retained?: boolean;
    ready: Snippet<[Extract<DataSnapshot, { status: 'ready' }>]>;
  }

  let { snapshot, ready, notices = [], showLoadingIndicator = true, retained = false }: Props = $props();
  const renderable = $derived(displayDataSnapshot(snapshot));

  $effect(() => {
    if (notices.length) console.warn('[MetricCanvas][DATA_NOTICE]', ...notices);
  });
</script>

<div class="widget-content" aria-busy={snapshot.status === 'loading'} inert={retained} data-retained={retained || undefined}>
  {#if snapshot.status === 'loading' && showLoadingIndicator && !retained}
    <span class="loading-indicator"><LoadingSpinner /></span>
  {/if}
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
  .loading-indicator {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    line-height: 0;
    pointer-events: none;
  }
</style>
