<script lang="ts">
  import { page } from '$app/state';
  import ScenarioCatalog from '$lib/ScenarioCatalog.svelte';
</script>

<ScenarioCatalog dimension={page.params.dimension} topic={page.params.topic} />
