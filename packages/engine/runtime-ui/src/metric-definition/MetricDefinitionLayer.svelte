<script lang="ts">
  import { setContext, type Snippet } from 'svelte';
  import type { MetricDefinitionsGateway } from '../../../runtime/src';
  import MetricDefinitionPopover from './MetricDefinitionPopover.svelte';
  import { createMetricDefinitionTip, METRIC_DEFINITION_TIPS, type MetricDefinitionTips, type MetricDefinitionTipState } from './session';

  interface Props {
    fetchDefinitions?: MetricDefinitionsGateway['fetchMetricDefinitions'];
    tabs: Readonly<Record<string, string>>;
    children: Snippet;
  }
  let { fetchDefinitions, tabs, children }: Props = $props();
  let active = $state.raw<MetricDefinitionTipState>();
  let panel = $state<HTMLElement>();
  const panelId = $props.id();
  const tip = createMetricDefinitionTip(next => active = next);
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  function close() {
    clearTimeout(closeTimer);
    tip.close();
  }

  function closeWhenOutside() {
    if (!active || active.anchor.matches(':hover') || panel?.matches(':hover')) return;
    const root = panel?.getRootNode() as Document | ShadowRoot | undefined;
    if (active.keyboard && panel?.contains(root?.activeElement ?? null)) return;
    close();
  }

  function leave(event: PointerEvent | FocusEvent) {
    const next = event.relatedTarget;
    if (next instanceof Node && (active?.anchor.contains(next) || panel?.contains(next))) return;
    clearTimeout(closeTimer);
    // The anchor and top-layer panel have a small visual gap.
    closeTimer = setTimeout(closeWhenOutside, 160);
  }

  setContext<MetricDefinitionTips>(METRIC_DEFINITION_TIPS, {
    available: () => fetchDefinitions !== undefined,
    expanded: anchor => active !== undefined && active.anchor === anchor,
    open(target) {
      clearTimeout(closeTimer);
      if (fetchDefinitions) tip.open(target, fetchDefinitions);
    },
    leave,
    remove(anchor) { if (active?.anchor === anchor) close(); },
    panelId
  });

  $effect(() => tip.setFetch(fetchDefinitions));

  $effect(() => {
    tabs;
    return close;
  });
</script>

{@render children()}

{#if active}
  <MetricDefinitionPopover state={active} {panelId} bind:panel
    onenter={() => clearTimeout(closeTimer)} onleave={leave} onclose={close} onretry={tip.retry} />
{/if}
