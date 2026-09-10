<script lang="ts">
  import { RuntimeView } from '@metriccanvas/engine/ui';
  import type { PageRevision } from './page-assets-client';
  import { createInjectedDqeGateway } from './runtime-config';
  import { pageAssets } from './page-assets';

  let { pageId, revisionId }: { pageId: string; revisionId: string } = $props();
  let revision = $state<PageRevision | null>(null);
  let error = $state('');
  let retry = $state(0);
  const dataGateway = createInjectedDqeGateway();

  $effect(() => {
    void retry;
    const controller = new AbortController();
    revision = null;
    error = '';
    void pageAssets.getRevision(pageId, revisionId, controller.signal).then(
      (loaded) => { if (!controller.signal.aborted) revision = loaded; },
      (cause: unknown) => {
        if (!controller.signal.aborted) error = cause instanceof Error ? cause.message : String(cause);
      }
    );
    return () => controller.abort();
  });
</script>

<div class="revision-preview" aria-label={`精确修订预览 ${revisionId}`}>
  {#if error}
    <div role="alert"><p>{error}</p><button onclick={() => retry += 1}>重试</button></div>
  {:else if revision}
    <RuntimeView document={revision.document} {dataGateway} />
  {:else}
    <p role="status">加载精确修订…</p>
  {/if}
</div>

<style>
  .revision-preview { width: 100%; min-width: 0; }
  [role='alert'] { padding: 16px; color: var(--down-strong); }
  [role='status'] { padding: 16px; color: var(--muted); }
</style>
