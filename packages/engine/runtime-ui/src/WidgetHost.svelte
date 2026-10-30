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
    ready: Snippet<[Extract<DataSnapshot, { status: 'ready' }>]>;
  }

  let { snapshot, ready, notices = [], showLoadingIndicator = true }: Props = $props();
  const renderable = $derived(displayDataSnapshot(snapshot));
</script>

<div class="widget-content" aria-busy={snapshot.status === 'loading'}>
  {#if snapshot.status === 'loading' && showLoadingIndicator}
    <span class="loading-indicator"><LoadingSpinner /></span>
  {/if}
  {#each notices as notice}
    <div class="data-notice" role="status">{notice}</div>
  {/each}
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
  .data-notice {
    padding: 4px 8px;
    color: var(--mc-color-muted, #71717a);
    font-size: 12px;
    flex: none;
  }
</style>
