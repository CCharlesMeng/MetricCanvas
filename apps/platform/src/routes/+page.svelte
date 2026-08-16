<script lang="ts">
  import { dev } from '$app/environment';
  import { page } from '$app/state';
  import PageAuthoringWorkbench from '$lib/PageAuthoringWorkbench.svelte';
  import PlatformStylePrototype from '$lib/prototype/platform-style/PlatformStylePrototype.svelte';

  const prototypeVariants = new Set(['A', 'B', 'C']);
  const prototypeVariant = $derived(page.url.searchParams.get('variant'));
</script>

{#if dev && prototypeVariant && prototypeVariants.has(prototypeVariant)}
  <PlatformStylePrototype variant={prototypeVariant as 'A' | 'B' | 'C'} />
{:else}
  <PageAuthoringWorkbench />
{/if}
