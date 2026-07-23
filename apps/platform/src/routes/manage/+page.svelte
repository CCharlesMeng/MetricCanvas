<script lang="ts">
  import { onMount } from 'svelte';

  interface PageListItem {
    pageId: string;
    latestRevision: { revisionId: string } | null;
    publishedRevision: { revisionId: string } | null;
    catalogVisibility: 'visible' | 'hidden';
  }

  let pages = $state<PageListItem[]>([]);
  let loading = $state(true);
  let error = $state('');

  onMount(() => {
    void loadPages();
  });

  async function loadPages() {
    loading = true;
    error = '';
    try {
      const response = await fetch('/api/pages');
      if (!response.ok) throw new Error(await responseMessage(response));
      const payload = (await response.json()) as { pages: PageListItem[] };
      pages = payload.pages;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : '看板页面目录加载失败';
    } finally {
      loading = false;
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
  <title>看板页面管理 | MetricCanvas</title>
</svelte:head>

<section class="management">
  <div class="heading">
    <div>
      <p class="eyebrow">管理</p>
      <h1>看板页面</h1>
      <p class="muted">查看页面修订、审计信息、差异与统一运行时预览。</p>
    </div>
    <div class="heading-actions">
      <a href="/manage/templates">管理页面模板</a>
      <button onclick={loadPages} disabled={loading}>刷新目录</button>
    </div>
  </div>

  {#if loading}
    <p class="muted">加载看板页面目录…</p>
  {:else if error}
    <div class="error">
      <p>{error}</p>
      <button onclick={loadPages}>重试</button>
    </div>
  {:else if pages.length === 0}
    <div class="empty">
      <h2>暂无看板页面</h2>
      <p>可先在页面搭建工作台创建页面。</p>
      <a href="/">打开页面搭建工作台</a>
    </div>
  {:else}
    <ul class="page-list">
      {#each pages as page (page.pageId)}
        <li>
          <a class="page-link" href={`/manage/pages/${encodeURIComponent(page.pageId)}`}>
            <span class="page-id">{page.pageId}</span>
            <span class="summary">
              <span>
                最新页面修订
                <code>{page.latestRevision?.revisionId ?? '尚无修订'}</code>
              </span>
              <span>
                当前发布修订
                <code>{page.publishedRevision?.revisionId ?? '未发布'}</code>
              </span>
              <span>{page.catalogVisibility === 'visible' ? '目录可见' : '目录隐藏'}</span>
            </span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .management {
    max-width: 1120px;
    margin: 0 auto;
    padding: 36px 24px 72px;
  }
  .heading {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    align-items: start;
    margin-bottom: 28px;
  }
  .eyebrow {
    margin: 0;
    color: #52525b;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
  }
  h1 {
    margin: 5px 0;
    font-size: 28px;
  }
  .muted {
    color: #71717a;
  }
  button,
  .empty a,
  .heading-actions a {
    border: 1px solid #27272a;
    border-radius: 7px;
    padding: 8px 12px;
    color: #fff;
    background: #27272a;
    font: inherit;
    text-decoration: none;
    cursor: pointer;
  }
  .heading-actions { display: flex; gap: 8px; }
  button:disabled {
    cursor: wait;
    opacity: 0.6;
  }
  .page-list {
    display: grid;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .page-link {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    padding: 18px;
    color: inherit;
    background: #fff;
    border: 1px solid #e4e4e7;
    border-radius: 10px;
    text-decoration: none;
  }
  .page-link:hover {
    border-color: #71717a;
  }
  .page-id {
    font-weight: 700;
  }
  .summary {
    display: flex;
    flex-wrap: wrap;
    justify-content: end;
    gap: 18px;
    color: #71717a;
    font-size: 13px;
  }
  code {
    margin-left: 4px;
    color: #3f3f46;
  }
  .empty,
  .error {
    display: grid;
    justify-items: start;
    gap: 12px;
    padding: 24px;
    background: #fff;
    border: 1px solid #e4e4e7;
    border-radius: 10px;
  }
  .empty h2,
  .empty p,
  .error p {
    margin: 0;
  }
  @media (max-width: 720px) {
    .page-link {
      flex-direction: column;
    }
    .summary {
      justify-content: start;
    }
  }
</style>
