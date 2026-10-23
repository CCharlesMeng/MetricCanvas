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

  export function update(next: RuntimeInput) {
    summaryConfig = next.aiSummary;
    input = next;
  }
</script>

<RuntimeView
  displayInputs={input.displayInputs}
  document={input.document}
  execution={input.execution}
  dataGateway={input.dataGateway}
  aiSummary={summaryConfig}
  initialSearch={input.initialSearch}
  navigation={input.navigation}
  filterEditing={input.filterEditing}
  onevent={onEvent}
/>
