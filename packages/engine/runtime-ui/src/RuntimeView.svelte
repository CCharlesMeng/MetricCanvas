<script lang="ts">
  import RuntimeSurface from './RuntimeSurface.svelte';
  import type { ExportViewConsumer, ExportViewOptions } from './export-types';
  let surface: RuntimeSurface;
  export function withExportView<T>(consume:ExportViewConsumer<T>,options?:ExportViewOptions):Promise<T> {return surface.withExportView(consume,options);}
  import type { RuntimeViewProps } from './types';

  let {
    document, dataGateway, aiSummary, initialSearch, navigation, onevent, pageRevisionId, execution
  }: RuntimeViewProps = $props();
</script>

<RuntimeSurface bind:this={surface}
  {document} {dataGateway} {aiSummary} {initialSearch} {navigation} {onevent} {pageRevisionId} {execution}
/>
