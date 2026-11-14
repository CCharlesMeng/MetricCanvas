<svelte:options css="injected" />
<script lang="ts">
  let { width = '100%' }: { width?: string } = $props();
</script>

<span class="skeleton" style:width aria-hidden="true"></span>

<style>
  .skeleton {
    display: block;
    max-width: 100%;
    height: 12px;
    margin-block: 4px;
    border-radius: 4px;
    background: var(--mc-color-border, #e4e4e7);
    opacity: 0.55;
  }
</style>
