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

  export function update(next: RuntimeInput) {
    input = next;
  }
</script>

<RuntimeView
  document={input.document}
  dataGateway={input.dataGateway}
  aiSummary={input.aiSummary}
  initialSearch={input.initialSearch}
  navigation={input.navigation}
  onevent={onEvent}
/>
