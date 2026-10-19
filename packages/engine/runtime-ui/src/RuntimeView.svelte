<script lang="ts">
  import RuntimeSurface from './RuntimeSurface.svelte';
  import type { RuntimeViewProps } from './types';

  let {
    displayInputs, document, dataGateway, aiSummary, initialSearch, navigation, onevent, pageRevisionId, execution
  }: RuntimeViewProps = $props();
</script>

<RuntimeSurface
  {displayInputs} {document} {dataGateway} {aiSummary} {initialSearch} {navigation} {onevent} {pageRevisionId} {execution}
/>
