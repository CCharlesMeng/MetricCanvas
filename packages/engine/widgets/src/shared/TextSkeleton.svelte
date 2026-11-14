<svelte:options css="injected" />
<script lang="ts">
  import Skeleton from './Skeleton.svelte';
  let { lines = 3 }: { lines?: number } = $props();
</script>

<span class="text-skeleton" aria-hidden="true">
  {#each Array(lines) as _, index}<Skeleton width={index === lines - 1 ? '68%' : '100%'} />{/each}
</span>

<style>
  .text-skeleton { display: flex; width: 100%; min-width: 0; flex-direction: column; gap: 8px; padding-block: 4px; }
</style>
