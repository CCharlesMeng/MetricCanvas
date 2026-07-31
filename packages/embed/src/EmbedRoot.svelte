<script lang="ts">
  import { RuntimeView } from '@metriccanvas/runtime-ui';
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
  initialSearch={input.initialSearch}
  onevent={onEvent}
/>
