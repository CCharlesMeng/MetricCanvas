<svelte:options css="injected" />
<script lang="ts">
  import { metricDefinitionMessages as text } from './messages';
  import type { MetricDefinitionTips } from './session';

  let { title, code, tips }: { title: string; code: string; tips: MetricDefinitionTips } = $props();
  let anchor = $state<HTMLButtonElement>();

  $effect(() => {
    const target = anchor;
    return () => { if (target) tips.remove(target); };
  });

  function open(node: HTMLButtonElement, keyboard: boolean) {
    tips.open({ anchor: node, title, code, keyboard });
  }
</script>

{#key code + '\u0000' + title}
  <button
    bind:this={anchor}
    class="metric-definition-trigger"
    type="button"
    data-metric-definition-trigger
    aria-label={text.trigger(title)}
    aria-haspopup="dialog"
    aria-controls={tips.expanded(anchor) ? tips.panelId : undefined}
    aria-expanded={tips.expanded(anchor)}
    onpointerenter={event => {
      if (event.pointerType === 'mouse') open(event.currentTarget, false);
    }}
    onpointerleave={tips.leave}
    onclick={event => open(event.currentTarget, event.detail === 0)}
  ><span aria-hidden="true">?</span></button>
{/key}

<style>
  .metric-definition-trigger {
    display: inline-grid;
    place-items: center;
    flex: none;
    min-height: 20px;
    font: inherit;
    padding: 0;
    border: 0;
    background: transparent;
    color: #575d6c;
    cursor: pointer;
  }
  .metric-definition-trigger:hover, .metric-definition-trigger[aria-expanded="true"] {
    color: var(--mc-color-primary, #2459bd);
  }
  .metric-definition-trigger:focus-visible {
    outline: 2px solid var(--mc-color-primary, #2459bd);
    outline-offset: 2px;
  }
  .metric-definition-trigger span {
    box-sizing: border-box;
    display: grid;
    place-items: center;
    width: 1.3em;
    height: 1.3em;
    border: 2px solid currentColor;
    border-radius: 50%;
    font-weight: 600;
    line-height: 1;
  }
</style>
