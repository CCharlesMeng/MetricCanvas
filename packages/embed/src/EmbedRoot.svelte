<script lang="ts">
  import { RuntimeView } from '@metriccanvas/engine/ui';
  import type { ExportViewConsumer, ExportViewOptions } from '@metriccanvas/engine/ui';
  let runtime: RuntimeView;
  export function withExportView<T>(consume:ExportViewConsumer<T>,options?:ExportViewOptions):Promise<T> {return runtime.withExportView(consume,options);}
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

<RuntimeView bind:this={runtime}
  document={input.document}
  execution={input.execution}
  dataGateway={input.dataGateway}
  aiSummary={input.aiSummary}
  initialSearch={input.initialSearch}
  navigation={input.navigation}
  onevent={onEvent}
/>
