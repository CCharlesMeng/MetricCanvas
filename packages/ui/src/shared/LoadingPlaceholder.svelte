<svelte:options css="injected" />
<script lang="ts">
  let { lines = 3 }: { lines?: number } = $props();
</script>
<span class="loading-placeholder" aria-hidden="true">
  {#each Array(lines) as _}<span class="skeleton"></span>{/each}
</span>
<style>
  .loading-placeholder { display: flex; min-width: 80px; width: 100%; flex-direction: column; gap: 12px; padding-block: 8px; }
  .skeleton { display: block; height: 12px; border-radius: 4px; background: var(--mc-color-border, #e4e4e7); opacity: 0.55; }
  .skeleton:last-child { width: 68%; }
</style>
