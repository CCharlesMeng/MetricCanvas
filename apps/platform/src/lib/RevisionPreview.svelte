<script lang="ts">
  import { aiSummary } from '@metriccanvas/engine/ui/ai-summary/yunbao-assistant';
  import { canonicalizeJson, normalizePageDocument } from '@metriccanvas/page';
  import { parseRuntimePage } from '@metriccanvas/page/internal';
  import type { ExecutionBootstrap } from '@metriccanvas/engine';
  import { RuntimeView,type RuntimeNavigation } from '@metriccanvas/engine/ui';
  import type { PageRevision } from './page-assets/contract';
  import {usePlatformServices} from './integration/services';
  const {pageAssets, dataGateway,displayInputs} = usePlatformServices();

  let { pageId, revisionId, readRevision = pageAssets.getRevision, executeRevision, navigation, initialSearch }: {
    pageId: string; revisionId: string;navigation?:RuntimeNavigation;initialSearch?:string;
    readRevision?: (pageId: string, revisionId: string, signal?: AbortSignal) => Promise<PageRevision>;
    executeRevision?: (revision: PageRevision, signal: AbortSignal) => Promise<ExecutionBootstrap>;
  } = $props();
  let revision = $state<PageRevision | null>(null);
  let renderedDocument = $state<unknown>(null);
  let execution = $state<ExecutionBootstrap | undefined>();
  let error = $state('');
  let retry = $state(0);

  function comparableRevisionDocument(document: unknown) {
    const normalized = normalizePageDocument(document);
    if (normalized.ok) return normalized;
    let hasCapabilityDiagnostics = false;
    const parsed = parseRuntimePage(document, {}, () => { hasCapabilityDiagnostics = true; });
    if (!parsed.ok) return parsed;
    return hasCapabilityDiagnostics ? { ok: true as const, document } : normalized;
  }

  $effect(() => {
    void retry;
    const controller = new AbortController();
    revision = null;
    renderedDocument = null;
    error = '';
    execution = undefined;
    const expectedPageId = pageId, expectedRevisionId = revisionId;
    const reader = readRevision, executor = executeRevision;
    void (async () => {
      try {
        const loaded = await reader(expectedPageId, expectedRevisionId, controller.signal);
        if (controller.signal.aborted) return;
        if (loaded.pageId !== expectedPageId || loaded.revisionId !== expectedRevisionId) throw new Error('精确预览读取了不匹配的修订');
        // 固定可信已读内容；执行器只能补实际取值/快照，不能换掉修订正文。
        const baseline = comparableRevisionDocument(loaded.document);
        if (!baseline.ok) {
          const issue = baseline.errors[0];
          throw new Error(`精确预览修订文档未通过校验（${issue.path}）：${issue.message}`);
        }
        const result = executor ? await executor(structuredClone(loaded), controller.signal) : undefined;
        if (controller.signal.aborted) return;
        if (result && (result.target.kind !== 'draft' || result.target.ref.pageId !== loaded.pageId || result.target.ref.revisionId !== loaded.revisionId || !loaded.resourceId || result.target.ref.resourceId !== loaded.resourceId)) throw new Error('执行预览与已读精确修订不匹配');
        if (result) {
          const returned = comparableRevisionDocument(result.document);
          if (!returned.ok || canonicalizeJson(returned.document) !== canonicalizeJson(baseline.document)) throw new Error('执行预览文档与已读精确修订不匹配');
          renderedDocument = result.document;
        } else {
          renderedDocument = baseline.document;
        }
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
    <RuntimeView {aiSummary} {displayInputs} {navigation} {initialSearch} document={renderedDocument ?? revision.document} {execution} {dataGateway} pageRevisionId={revision.revisionId} />
  {:else}
    <p role="status">加载精确修订…</p>
  {/if}
</div>

<style>
  .revision-preview { width: 100%; min-width: 0; }
  [role='alert'] { padding: 16px; color: var(--down-strong); }
  [role='status'] { padding: 16px; color: var(--muted); }
</style>
