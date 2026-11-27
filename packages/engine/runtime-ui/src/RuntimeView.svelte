<script lang="ts">
  import RuntimeSurface from './RuntimeSurface.svelte';
  import type { RuntimeViewProps } from './types';

  let {
    document, hostCanExport, exportHandler, displayInputs, dataGateway, regionMap, aiSummary, initialSearch, navigation, onevent, onAuthRequired, pageRevisionId, execution, filterEditing
  }: RuntimeViewProps = $props();
</script>

<RuntimeSurface
  {document} {hostCanExport} {exportHandler} {displayInputs} {dataGateway} {regionMap} {aiSummary} {initialSearch} {navigation} {onevent} {onAuthRequired} {pageRevisionId} {execution} {filterEditing}
/>
