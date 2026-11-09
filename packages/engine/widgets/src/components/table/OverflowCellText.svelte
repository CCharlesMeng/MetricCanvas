<svelte:options css="injected" />
<script lang="ts">
  import { overflowTooltip } from './overflow-tooltip';
  let { text, enabled }: { text: string; enabled: boolean } = $props();
  const tooltipId = $props.id();
</script>

{#if enabled}
  <span class="overflow-cell-text" use:overflowTooltip={text}>
    <!-- Keyboard users need a focusable tooltip trigger without a click action. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <span class="cell-text" tabindex="0" aria-describedby={tooltipId}>{text}</span>
    <span id={tooltipId} class="cell-tooltip" role="tooltip" popover="manual"></span>
  </span>
{:else}
  {text}
{/if}

<style>
  .overflow-cell-text { display: block; width: 100%; min-width: 0; }
  .cell-text {
    display: block;
    width: 0;
    min-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cell-text:focus-visible { outline: 2px solid #1476ff; outline-offset: -2px; }
  .cell-tooltip {
    position: fixed;
    inset: auto;
    margin: 0;
    box-sizing: border-box;
    width: max-content;
    max-width: min(480px, calc(100vw - 16px));
    max-height: min(320px, calc(100vh - 16px));
    overflow: auto;
    padding: 8px 12px;
    border: 1px solid #dbdbdb;
    border-radius: 4px;
    background: #fff;
    color: #191919;
    box-shadow: 0 2px 8px #0003;
    font: inherit;
    line-height: 1.5;
    text-align: left;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
