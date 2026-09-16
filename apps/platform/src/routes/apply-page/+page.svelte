<script lang="ts">
  import { dev } from '$app/environment';
  import { onMount } from 'svelte';
  import PageAuthoringWorkbench from '$lib/PageAuthoringWorkbench.svelte';
  import { installRuntimeConfig, readRuntimeConfig } from '$lib/runtime-config';
  import { createApplyPageFixture } from '$lib/workbench/apply-page-fixture';
  let fixture = $state<ReturnType<typeof createApplyPageFixture> | null>(null);
  onMount(() => {
    if (!dev) return;
    const previous = readRuntimeConfig();
    installRuntimeConfig({ operatorId: 'apply-page-mock', workspaceId: crypto.randomUUID(),
      authToken: 'mock', pageMetadataBaseUrl: '/__unused-mock-assets', dqeEndpoint: '/__unused-mock-dqe' });
    fixture = createApplyPageFixture(window);
    return () => installRuntimeConfig(previous);
  });
</script>
{#if dev && fixture}
  <PageAuthoringWorkbench authoringPort={fixture.port} dialogueAdapter={fixture.adapter} />
{:else}
  <p>页面应用模拟入口仅供开发环境使用。</p>
{/if}
