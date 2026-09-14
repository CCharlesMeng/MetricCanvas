<script lang="ts">
  import type { ExecutionBootstrap } from '@metriccanvas/engine';
  import { RuntimeView } from '@metriccanvas/engine/ui';
  import type { PageRevision } from './page-assets-client';
  import { createInjectedDqeGateway } from './runtime-config';
  import { pageAssets } from './page-assets';

  let { pageId, revisionId, readRevision = pageAssets.getRevision, executeRevision }: {
    pageId: string; revisionId: string;
    readRevision?: (pageId: string, revisionId: string, signal?: AbortSignal) => Promise<PageRevision>;
    executeRevision?: (revision: PageRevision, signal: AbortSignal) => Promise<ExecutionBootstrap>;
  } = $props();
  let revision = $state<PageRevision | null>(null);
  let execution = $state<ExecutionBootstrap | undefined>();
  let error = $state('');
  let retry = $state(0);
  const dataGateway = createInjectedDqeGateway();

  $effect(() => {
    void retry;
    const controller = new AbortController();
    revision = null;
    error = '';
    execution = undefined;
    const expectedPageId = pageId, expectedRevisionId = revisionId;
    const reader = readRevision, executor = executeRevision;
    void (async () => {
      try {
        const loaded = await reader(expectedPageId, expectedRevisionId, controller.signal);
        if (controller.signal.aborted) return;
        if (loaded.pageId !== expectedPageId || loaded.revisionId !== expectedRevisionId) throw new Error('精确预览读取了不匹配的修订');
        const result = executor ? await executor(loaded, controller.signal) : undefined;
        if (controller.signal.aborted) return;
        if (result && (result.target.kind !== 'draft' || result.target.ref.pageId !== loaded.pageId || result.target.ref.revisionId !== loaded.revisionId || !loaded.resourceId || result.target.ref.resourceId !== loaded.resourceId)) throw new Error('执行预览与已读精确修订不匹配');
        execution = result;
        revision = loaded;
      } catch (cause) {
        if (!controller.signal.aborted) error = cause instanceof Error ? cause.message : String(cause);
      }
    })();
    return () => controller.abort();
  });
</script>

<div class="revision-preview" aria-label={`精确修订预览 ${revisionId}`}>
  {#if error}
    <div role="alert"><p>{error}</p><button onclick={() => retry += 1}>重试</button></div>
  {:else if revision}
    <RuntimeView document={execution?.document ?? revision.document} {execution} {dataGateway} pageRevisionId={revision.revisionId} />
  {:else}
    <p role="status">加载精确修订…</p>
  {/if}
</div>

<style>
  .revision-preview { width: 100%; min-width: 0; }
  [role='alert'] { padding: 16px; color: var(--down-strong); }
  [role='status'] { padding: 16px; color: var(--muted); }
</style>
