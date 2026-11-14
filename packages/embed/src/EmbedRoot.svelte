<script lang="ts">
  import { RuntimeView } from '@metriccanvas/engine/ui';
  import { untrack } from 'svelte';
  import type {
    RuntimeInput,
    RuntimeEvent
  } from './types';

  let {
    initialInput,
    onEvent
  }: {
    initialInput: RuntimeInput;
    onEvent?: (event: RuntimeEvent) => void;
  } = $props();

  let input = $state(untrack(() => initialInput));
  // Injected application session identity must survive Svelte's per-root deep proxies.
  let summaryConfig = $state.raw(untrack(() => initialInput.aiSummary));
  let gateway = $state.raw(untrack(() => initialInput.dataGateway));
  let facts = $state.raw(untrack(() => initialInput.displayInputs));
  let authHandler = $state.raw(untrack(() => initialInput.onAuthRequired));
  let previousInput = untrack(() => initialInput);

  function sameRenderInput(next: RuntimeInput, previous: RuntimeInput): boolean {
    return Object.keys({...previous,...next}).filter(key=>key!=='onAuthRequired')
      .every(key=>next[key as keyof RuntimeInput]===previous[key as keyof RuntimeInput]);
  }

  export function update(next: RuntimeInput) {
    authHandler = next.onAuthRequired;
    const onlyAuthChanged = next.onAuthRequired !== previousInput.onAuthRequired && sameRenderInput(next, previousInput);
    previousInput = next;
    if (onlyAuthChanged) return;
    summaryConfig = next.aiSummary;
    gateway = next.dataGateway;
    facts = next.displayInputs;
    input = next;
  }
</script>

<RuntimeView
  displayInputs={facts}
  document={input.document}
  execution={input.execution}
  dataGateway={gateway}
  aiSummary={summaryConfig}
  initialSearch={input.initialSearch}
  navigation={input.navigation}
  filterEditing={input.filterEditing}
  onevent={onEvent}
  onAuthRequired={authHandler}
/>
