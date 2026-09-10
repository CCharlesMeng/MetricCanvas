<script lang="ts">
  import { resolve } from '$app/paths';
  import RevisionPreview from '$lib/RevisionPreview.svelte';
  import { pageAssets } from '$lib/page-assets';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import {
    formatStructuredJson,
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
  let selectedRevisionId = $state('');
  let diff = $state<RevisionDiff | null>(null);
  let loading = $state(true);
  let loadingDiff = $state(false);
  let error = $state('');
  let diffError = $state('');
  /** 后端如实声明"未开放"(HTTP 501,NOT_SUPPORTED)时的说明;与加载失败区分显示。 */
  let historyUnavailable = $state('');

  const pageId = $derived(page.params.pageId ?? '');
  const comparison = $derived(selectRevisionComparison(revisions, selectedRevisionId));

  onMount(() => {
    void loadPage();
  });

  async function loadPage() {
    loading = true;
    error = '';
    try {
      const details = await pageAssets.getDetails(pageId);
      historyUnavailable = details.historyUnavailable;
      revisions = details.revisions;
      selectedRevisionId = details.revision.revisionId;
      await loadDiff(details.revision.revisionId);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : '页面加载失败';
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
    if (historyUnavailable) {
      loadingDiff = false;
      return;
    }
    if (!next?.base) {
      loadingDiff = false;
      return;
    }

    loadingDiff = true;
    try {
      throw new Error('当前静态平台未获得服务端修订差异接口');
    } catch (cause) {
      if (selectedRevisionId === revisionId) {
        diffError = cause instanceof Error ? cause.message : '修订差异加载失败';
      }
    } finally {
      if (selectedRevisionId === revisionId) loadingDiff = false;
    }
  }

</script>

<svelte:head>
  <title>页面修订 | MetricCanvas</title>
</svelte:head>

<section class="management">
  <a class="back" href={resolve('/manage')}>← 页面</a>

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
        {#if historyUnavailable}
          <p class="muted">未开放:{historyUnavailable}</p>
        {/if}
        <ol>
          {#each revisions as revision (revision.revisionId)}
            <li class:active={revision.revisionId === selectedRevisionId}>
              <button onclick={() => selectRevision(revision.revisionId)}>
                <strong>R{revision.revisionNumber}</strong>
                <code>{revision.revisionId}</code>
                <span>创建人：{revision.createdBy || '接口未提供'}</span>
                <span>时间：{revision.createdAt || '接口未提供'}</span>
                <span>基线：{historyUnavailable ? '接口未提供' : revision.baseRevisionId ?? '无（首个修订）'}</span>
                <span>内容哈希：{revision.contentHash || '接口未提供'}</span>
                <span>数据上下文版本：{revision.dataContextVersion ?? '未记录'}</span>
              </button>
            </li>
          {/each}
        </ol>
      </aside>

      <div class="content">
        <section class="audit">
          <h2>选中修订 R{comparison.selected.revisionNumber}</h2>
          <dl>
            <div><dt>创建人</dt><dd>{comparison.selected.createdBy || '接口未提供'}</dd></div>
            <div><dt>创建时间</dt><dd>{comparison.selected.createdAt || '接口未提供'}</dd></div>
            <div><dt>基线修订</dt><dd>{historyUnavailable ? '接口未提供' : comparison.selected.baseRevisionId ?? '无（首个修订）'}</dd></div>
            <div><dt>内容哈希</dt><dd><code>{comparison.selected.contentHash || '接口未提供'}</code></dd></div>
            <div><dt>数据上下文版本</dt><dd>{comparison.selected.dataContextVersion ?? '未记录'}</dd></div>
          </dl>
          <div class="revision-actions">
            {#if comparison.selected.revisionId === revisions[0]?.revisionId}
              <a class="button-link" href={`${resolve('/')}?page=${encodeURIComponent(pageId)}`}>在页面搭建工作台打开</a>
              <a class="button-link" href={resolve('/manage/pages/[pageId]/edit', { pageId })}>
                编辑当前页面修订
              </a>
            {/if}
          </div>
        </section>

        <section>
          <h2>结构化 JSON 差异</h2>
          {#if historyUnavailable}
            <p class="muted">当前页面资产接口未开放历史修订与差异读取。</p>
          {:else if comparison.base === null}
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
              <RevisionPreview {pageId} revisionId={selectedRevisionId} />
            </article>
            <article>
              <h3>{comparison.base ? `基线 R${comparison.base.revisionNumber}` : '基线不可用'}</h3>
              {#if comparison.base}
                <code>{comparison.base.revisionId}</code>
                <RevisionPreview {pageId} revisionId={comparison.base.revisionId} />
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
    color: var(--accent);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  h1 {
    margin: 4px 0;
    font-size: 24px;
    letter-spacing: -0.01em;
  }
  h2 {
    margin: 0 0 14px;
    font-size: 15px;
  }
  h3 {
    margin: 0 0 6px;
    font-size: 13.5px;
  }
  .muted {
    color: var(--muted);
    font-size: 13px;
  }
  button {
    padding: 7px 13px;
    color: var(--text);
    background: var(--surface);
    border: 1px solid #d4d4d8;
    border-radius: 9px;
    font: inherit;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease,
      transform 0.1s ease;
  }
  button:hover:not(:disabled) {
    border-color: var(--faint);
    box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
  }
  button:active:not(:disabled) {
    transform: translateY(1px);
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
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
    border-color: var(--line);
    font-weight: 500;
  }
  .history li.active button {
    color: var(--text);
    background: #fafaff;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgb(79 70 229 / 10%);
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
  .revision-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
  }
  .button-link {
    padding: 7px 13px;
    color: var(--text);
    background: var(--surface);
    border: 1px solid #d4d4d8;
    border-radius: 9px;
    font: inherit;
    font-size: 12.5px;
    font-weight: 600;
    text-decoration: none;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }
  .button-link:hover {
    border-color: var(--faint);
    box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
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
  .error-text {
    color: #b91c1c;
  }
  @container platform (max-width: 920px) {
    .layout,
    .previews {
      grid-template-columns: 1fr;
    }
  }
  @container platform (max-width: 560px) {
    .audit dl {
      grid-template-columns: 1fr;
    }
  }
</style>
