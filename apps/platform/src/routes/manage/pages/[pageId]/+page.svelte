<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import {
    formatStructuredJson,
    runtimePreviewUrl,
    selectRevisionComparison,
    type RevisionAudit
  } from '$lib/management-state';

  interface Revision extends RevisionAudit {
    pageId: string;
  }

  interface RevisionDiff {
    pageId: string;
    fromRevisionId: string;
    toRevisionId: string;
    changes: unknown[];
  }

  let revisions = $state<Revision[]>([]);
  let runtimeOrigin = $state('');
  let selectedRevisionId = $state('');
  let diff = $state<RevisionDiff | null>(null);
  let loading = $state(true);
  let loadingDiff = $state(false);
  let error = $state('');
  let diffError = $state('');

  const pageId = $derived(page.params.pageId ?? '');
  const comparison = $derived(selectRevisionComparison(revisions, selectedRevisionId));

  onMount(() => {
    void loadPage();
  });

  async function loadPage() {
    loading = true;
    error = '';
    try {
      const [pageResponse, historyResponse] = await Promise.all([
        fetch(`/api/pages/${encodeURIComponent(pageId)}`),
        fetch(`/api/pages/${encodeURIComponent(pageId)}/revisions`)
      ]);
      if (!pageResponse.ok) throw new Error(await responseMessage(pageResponse));
      if (!historyResponse.ok) throw new Error(await responseMessage(historyResponse));

      const pageData = (await pageResponse.json()) as {
        revision: Revision;
        runtimeOrigin: string;
      };
      const history = (await historyResponse.json()) as { revisions: Revision[] };
      revisions = history.revisions;
      runtimeOrigin = pageData.runtimeOrigin;
      selectedRevisionId = pageData.revision.revisionId;
      await loadDiff(pageData.revision.revisionId);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : '看板页面加载失败';
    } finally {
      loading = false;
    }
  }

  async function selectRevision(revisionId: string) {
    if (revisionId === selectedRevisionId) return;
    selectedRevisionId = revisionId;
    await loadDiff(revisionId);
  }

  async function loadDiff(revisionId: string) {
    const next = selectRevisionComparison(revisions, revisionId);
    diff = null;
    diffError = '';
    if (!next?.base) {
      loadingDiff = false;
      return;
    }

    loadingDiff = true;
    try {
      const search = new URLSearchParams({
        fromRevisionId: next.base.revisionId,
        toRevisionId: next.selected.revisionId
      });
      const response = await fetch(
        `/api/pages/${encodeURIComponent(pageId)}/revisions/diff?${search}`
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      const payload = (await response.json()) as { diff: RevisionDiff };
      if (selectedRevisionId === revisionId) diff = payload.diff;
    } catch (cause) {
      if (selectedRevisionId === revisionId) {
        diffError = cause instanceof Error ? cause.message : '修订差异加载失败';
      }
    } finally {
      if (selectedRevisionId === revisionId) loadingDiff = false;
    }
  }

  async function responseMessage(response: Response): Promise<string> {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    return payload?.error?.message ?? `HTTP ${response.status}`;
  }
</script>

<svelte:head>
  <title>看板页面修订 | MetricCanvas</title>
</svelte:head>

<section class="management">
  <a class="back" href="/manage">← 看板页面</a>

  {#if loading}
    <p class="muted">加载页面修订…</p>
  {:else if error}
    <div class="error">
      <p>{error}</p>
      <button onclick={loadPage}>重试</button>
    </div>
  {:else if !comparison}
    <div class="error">页面没有可查看的修订。</div>
  {:else}
    <div class="heading">
      <div>
        <p class="eyebrow">页面修订</p>
        <h1>{pageId}</h1>
      </div>
      <button onclick={loadPage}>刷新</button>
    </div>

    <div class="layout">
      <aside class="history">
        <h2>修订历史</h2>
        <ol>
          {#each revisions as revision (revision.revisionId)}
            <li class:active={revision.revisionId === selectedRevisionId}>
              <button onclick={() => selectRevision(revision.revisionId)}>
                <strong>R{revision.revisionNumber}</strong>
                <code>{revision.revisionId}</code>
                <span>创建人：{revision.createdBy}</span>
                <span>时间：{revision.createdAt}</span>
                <span>基线：{revision.baseRevisionId ?? '无（首个修订）'}</span>
                <span>内容哈希：{revision.contentHash}</span>
                <span>元数据版本：{revision.metadataVersion}</span>
              </button>
            </li>
          {/each}
        </ol>
      </aside>

      <div class="content">
        <section class="audit">
          <h2>选中修订 R{comparison.selected.revisionNumber}</h2>
          <dl>
            <div><dt>创建人</dt><dd>{comparison.selected.createdBy}</dd></div>
            <div><dt>创建时间</dt><dd>{comparison.selected.createdAt}</dd></div>
            <div><dt>基线修订</dt><dd>{comparison.selected.baseRevisionId ?? '无（首个修订）'}</dd></div>
            <div><dt>内容哈希</dt><dd><code>{comparison.selected.contentHash}</code></dd></div>
            <div><dt>元数据版本</dt><dd>{comparison.selected.metadataVersion}</dd></div>
          </dl>
        </section>

        <section>
          <h2>结构化 JSON 差异</h2>
          {#if comparison.base === null}
            <p class="muted">这是首个修订，没有前序基线可供比较。</p>
          {:else if loadingDiff}
            <p class="muted">加载差异…</p>
          {:else if diffError}
            <p class="error-text">{diffError}</p>
          {:else if diff}
            <pre>{formatStructuredJson(diff)}</pre>
          {/if}
        </section>

        <section>
          <h2>统一运行时预览</h2>
          <p class="muted">两个预览都固定到具体页面修订，不跟随当前最新修订。</p>
          <div class="previews">
            <article>
              <h3>选中 R{comparison.selected.revisionNumber}</h3>
              <code>{comparison.selected.revisionId}</code>
              <iframe
                title={`选中修订 R${comparison.selected.revisionNumber} 统一运行时预览`}
                src={runtimePreviewUrl(runtimeOrigin, pageId, comparison.selected.revisionId)}
              ></iframe>
            </article>
            <article>
              <h3>{comparison.base ? `基线 R${comparison.base.revisionNumber}` : '基线不可用'}</h3>
              {#if comparison.base}
                <code>{comparison.base.revisionId}</code>
                <iframe
                  title={`基线修订 R${comparison.base.revisionNumber} 统一运行时预览`}
                  src={runtimePreviewUrl(runtimeOrigin, pageId, comparison.base.revisionId)}
                ></iframe>
              {:else}
                <p class="muted">首个修订没有前序修订。</p>
              {/if}
            </article>
          </div>
        </section>
      </div>
    </div>
  {/if}
</section>

<style>
  .management {
    max-width: 1440px;
    margin: 0 auto;
    padding: 28px 24px 72px;
  }
  .back {
    color: #3f3f46;
    font-size: 14px;
  }
  .heading {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    align-items: start;
    margin: 22px 0;
  }
  .eyebrow {
    margin: 0;
    color: #52525b;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
  }
  h1 {
    margin: 4px 0;
    font-size: 28px;
  }
  h2 {
    margin: 0 0 14px;
    font-size: 16px;
  }
  h3 {
    margin: 0 0 6px;
    font-size: 14px;
  }
  .muted {
    color: #71717a;
  }
  button {
    border: 1px solid #27272a;
    border-radius: 7px;
    padding: 8px 12px;
    color: #fff;
    background: #27272a;
    font: inherit;
    cursor: pointer;
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
    gap: 20px;
  }
  .history,
  .content > section,
  .error {
    padding: 18px;
    background: #fff;
    border: 1px solid #e4e4e7;
    border-radius: 10px;
  }
  .history {
    align-self: start;
  }
  .history ol {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .history li button {
    display: grid;
    width: 100%;
    gap: 4px;
    padding: 12px;
    color: #3f3f46;
    text-align: left;
    background: #fafafa;
    border-color: #e4e4e7;
  }
  .history li.active button {
    color: #18181b;
    background: #f4f4f5;
    border-color: #52525b;
  }
  .history strong {
    font-size: 14px;
  }
  .history span,
  .history code {
    overflow: hidden;
    color: #71717a;
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .content {
    display: grid;
    gap: 20px;
  }
  .audit dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    margin: 0;
  }
  .audit dl div {
    min-width: 0;
  }
  dt {
    margin-bottom: 3px;
    color: #71717a;
    font-size: 12px;
  }
  dd {
    overflow-wrap: anywhere;
    margin: 0;
  }
  pre {
    overflow: auto;
    max-height: 420px;
    margin: 0;
    padding: 14px;
    color: #e4e4e7;
    background: #18181b;
    border-radius: 7px;
    font-size: 12px;
  }
  .previews {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }
  .previews article {
    display: grid;
    gap: 8px;
    min-width: 0;
  }
  .previews code {
    overflow: hidden;
    color: #52525b;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  iframe {
    width: 100%;
    min-height: 480px;
    border: 1px solid #d4d4d8;
    border-radius: 7px;
    background: #fff;
  }
  .error-text {
    color: #b91c1c;
  }
  @media (max-width: 920px) {
    .layout,
    .previews {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 560px) {
    .audit dl {
      grid-template-columns: 1fr;
    }
  }
</style>
