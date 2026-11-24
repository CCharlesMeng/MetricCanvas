<svelte:options css="injected" />
<script lang="ts">
  let { expanded, onclick }: { expanded: boolean; onclick: () => void } = $props();
  const label = $derived(expanded ? '还原表格' : '放大表格');
</script>

<button type="button" aria-expanded={expanded} aria-label={label} title={label} {onclick}>
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none"
    stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <rect x="1.75" y="1.75" width="16.5" height="16.5" rx="2.75" />
    {#if expanded}
      <path d="m5.75 14.25 3.5-3.5H6.6m2.65 2.65v-2.65m5-5-3.5 3.5h2.65M10.75 6.6v2.65" />
    {:else}
      <path d="m6 14 8-8m-3.5 0H14v3.5m-8 1V14h3.5" />
    {/if}
  </svg>
</button>

<style>
  button {
    display: grid;
    place-items: center;
    inline-size: 30px;
    block-size: 30px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--mc-color-text, #191919);
    cursor: pointer;
  }
  button:hover { background: var(--mc-color-surface-subtle, #f5f5f5); }
  button:focus-visible { outline: 2px solid var(--mc-color-primary, #1768e3); outline-offset: 2px; }
  @container mc-runtime (max-width: 760px) {
    button[aria-expanded="false"] { display: none; }
  }
</style>
