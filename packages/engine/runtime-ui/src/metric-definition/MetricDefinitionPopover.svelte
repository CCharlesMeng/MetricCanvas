<svelte:options css="injected" />
<script lang="ts">
  import { observePopover, popoverPosition } from '@metriccanvas/ui';
  import { metricDefinitionMessages } from './messages';
  import { metricDefinitionHref, type MetricDefinitionTipState } from './session';

  interface Props {
    state: MetricDefinitionTipState;
    panelId: string;
    panel?: HTMLElement;
    onenter: () => void;
    onleave: (event: PointerEvent | FocusEvent) => void;
    onclose: () => void;
    onretry: () => void;
  }
  let { state, panelId, panel = $bindable(), onenter, onleave, onclose, onretry }: Props = $props();
  const anchor = $derived(state.anchor);
  const keyboard = $derived(state.keyboard);
  const messages = $derived(metricDefinitionMessages(anchor));
  const definition = $derived(state.phase === 'loaded' ? state.definition : undefined);
  const href = $derived(metricDefinitionHref(definition?.url ?? null));

  function place(trigger: HTMLElement, element: HTMLElement) {
    if (!trigger.isConnected || !trigger.getClientRects().length || trigger.closest('[inert]')) {
      onclose();
      return;
    }
    const rect = popoverPosition(trigger, element);
    if (!rect.visible) {
      onclose();
      return;
    }
    element.style.left = `${rect.left}px`;
    element.style.top = `${rect.top}px`;
  }

  $effect(() => {
    const element = panel;
    const trigger = anchor;
    if (!element) return;
    const doc = trigger.ownerDocument;
    const root = trigger.getRootNode();
    const reposition = () => place(trigger, element);
    function outside(event: PointerEvent) {
      const path = event.composedPath();
      if (!path.includes(trigger) && !path.includes(element!)) onclose();
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      onclose();
      trigger.focus({ preventScroll: true });
    }
    element.showPopover();
    reposition();
    const stop = observePopover(trigger, reposition, element);
    root.addEventListener('scroll', reposition, true);
    doc.addEventListener('pointerdown', outside, true);
    doc.addEventListener('keydown', escape);
    return () => {
      stop();
      root.removeEventListener('scroll', reposition, true);
      doc.removeEventListener('pointerdown', outside, true);
      doc.removeEventListener('keydown', escape);
      element.hidePopover();
    };
  });

  $effect(() => {
    if (!panel?.matches(':popover-open')) return;
    if (state.phase !== 'loading') panel.style.removeProperty('min-height');
    // Recompute even when the box is already viewport-constrained.
    place(anchor, panel);
  });

  $effect(() => {
    anchor;
    if (keyboard) panel?.focus({ preventScroll: true });
  });

  function retry() {
    if (panel) {
      panel.style.minHeight = `${panel.getBoundingClientRect().height}px`;
      panel.focus({ preventScroll: true });
    }
    onretry();
  }
</script>

<div bind:this={panel} id={panelId} class="metric-definition-panel" data-metric-definition-panel
  popover="manual" role="dialog" aria-labelledby={panelId + '-title'} tabindex="-1"
  onpointerenter={onenter} onpointerleave={onleave} onfocusout={onleave}>
  <h2 id={panelId + '-title'}>{state.title}</h2>
  {#if state.phase === 'loading'}
    <p class="notice" role="status"><span class="spinner" aria-hidden="true"></span>{messages.loading}</p>
  {:else if state.phase === 'error'}
    <p class="notice" role="status"><span class="error-icon" aria-hidden="true">!</span>{messages.error}</p>
    <footer><button type="button" onclick={retry}>{messages.retry}</button></footer>
  {:else if definition}
    <dl>
      <div><dt>{messages.name}</dt><dd>{definition.name}（{definition.code}）</dd></div>
      <div><dt>{messages.definition}</dt><dd>{definition.definition}</dd></div>
      <div><dt>{messages.formula}</dt><dd>{definition.formula}</dd></div>
      <div><dt>{messages.manager}</dt><dd>{definition.manager}</dd></div>
    </dl>
    {#if definition.latestUpdateTime}
      <p class="update"><span aria-hidden="true">*</span>{messages.updated(definition.latestUpdateTime)}</p>
    {/if}
    {#if href}
      <footer><a {href} target="_blank" rel="noopener noreferrer">{definition.latestUpdateTime ? messages.latest : messages.more}</a></footer>
    {/if}
  {/if}
</div>

<style>
  .metric-definition-panel {
    position: fixed;
    inset: auto;
    width: min(400px, calc(100vw - 24px));
    max-height: min(660px, calc(100dvh - 24px));
    margin: 0;
    overflow: auto;
    padding: 16px;
    border: 0;
    border-radius: 8px;
    background: #fff;
    color: #191919;
    box-shadow: 0 3px 12px #0000001a;
  }
  h2, dl, dd, p { margin: 0; }
  h2 {
    margin-bottom: 16px;
    font-size: 16px;
    font-weight: 600;
    line-height: 20px;
  }
  dt { font-size: 14px; font-weight: 600; line-height: 20px; }
  dd, p { color: #595959; font-size: 12px; line-height: 18px; overflow-wrap: anywhere; }
  dd { margin-top: 5px; white-space: pre-wrap; }
  dl > div + div { margin-top: 16px; }
  .update { margin-top: 16px; }
  .update span { margin-right: 4px; color: #d53641; font-weight: 600; }
  .notice { display: flex; align-items: flex-start; gap: 8px; }
  .spinner, .error-icon { box-sizing: border-box; flex: none; width: 16px; height: 16px; border-radius: 50%; }
  .spinner { border: 2px solid #dce7fb; border-top-color: #3065ca; animation: spin .8s linear infinite; }
  .error-icon { display: grid; place-items: center; background: #fff0d9; color: #a64404; font-weight: 600; line-height: 1; }
  @keyframes spin { to { transform: rotate(1turn); } }
  @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
  footer { margin-top: 10px; text-align: right; }
  footer a, footer button { font-size: 12px; line-height: 20px; }
  footer a { color: #191919; font-weight: 700; text-decoration: none; }
  footer button { border: 0; padding: 0; background: none; color: #2458bb; font-weight: 600; cursor: pointer; }
  footer button:hover { text-decoration: underline; }
  footer :is(a, button):focus-visible { outline: 2px solid var(--mc-color-primary, #2459bd); outline-offset: 2px; }
</style>
