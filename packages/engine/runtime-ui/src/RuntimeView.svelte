<script lang="ts">
  import RuntimeSurface from './RuntimeSurface.svelte';
  import type { RuntimeViewProps } from './types';

  let {
    document, dataGateway, aiSummary, initialSearch, navigation, onevent, pageRevisionId
  }: RuntimeViewProps = $props();
</script>

<RuntimeSurface
  {document} {dataGateway} {aiSummary} {initialSearch} {navigation} {onevent} {pageRevisionId}
/>
