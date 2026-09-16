<script lang="ts">
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import { pageAssets } from '$lib/page-assets';
  import type { AssetSummary } from '$lib/page-assets/contract';
  let pages = $state<AssetSummary[]>([]);
  let loading = $state(true), error = $state(''), pageNo = $state(1), total = $state(0);
  let statusFilter = $state<'' | 'draft' | 'published'>('');
  let request = 0;
  onMount(() => { void loadPages(); });
  async function loadPages() {
    const id = ++request; loading = true; error = '';
    try {
      const result = await pageAssets.list({page:pageNo,pageSize:20,...(statusFilter ? {state:statusFilter} : {})});
      if (id === request) { pages = result.items; total = result.total; }
    } catch (cause) { if(id === request) error = cause instanceof Error ? cause.message : '目录加载失败'; }
    finally { if(id === request) loading = false; }
  }
</script>

<svelte:head>
  <title>页面管理 | MetricCanvas</title>
</svelte:head>

<section class="management">
  <div class="heading">
    <div>
      <p class="eyebrow">管理</p>
      <h1>页面</h1>
      <p class="muted">查看已保存页面，继续创作或管理草稿。</p>
    </div>
    <div class="heading-actions">
      <a href={`${resolve('/')}?new=1`}>创建新页面</a>
      <select aria-label="页面状态" bind:value={statusFilter} onchange={() => {pageNo=1;void loadPages();}}><option value="">全部</option><option value="draft">草稿</option><option value="published">已发布</option></select>
      <button onclick={loadPages} disabled={loading}>刷新目录</button>
    </div>
  </div>

  {#if loading}
    <div class="skeleton-list" aria-label="加载页面目录">
      <i></i><i></i><i></i>
    </div>
  {:else if error}
    <div class="error">
      <p>{error}</p>
      <button onclick={loadPages}>重试</button>
    </div>
  {:else if pages.length === 0}
    <div class="empty">
      <h2>暂无页面</h2>
      <p>当前筛选下没有页面，可创建新页面。</p>
      <a href={resolve('/')}>打开页面搭建工作台</a>
    </div>
  {:else}
    <ul class="page-list">
      {#each pages as page (page.resourceId)}
        <li>
          <a class="page-link" href={`${resolve('/manage/pages/[pageId]', { pageId: page.pageId })}?resource=${encodeURIComponent(page.resourceId)}`}>
            <span class="page-id">{page.pageId}</span>
            <span class="summary">
              <span>
                最新页面修订
                <code>{page.revisionId}</code>
              </span>
              <span>
                状态
                <code>{page.state === 'published' ? '已发布' : page.state === 'draft' ? '草稿' : '状态未知'}</code>
              </span>
              <span>{page.description || page.pageId} · {page.updatedAt}</span>
            </span>
          </a>
        </li>
      {/each}
    </ul>
    <nav aria-label="目录分页"><button disabled={pageNo === 1 || loading} onclick={() => {pageNo--;void loadPages();}}>上一页</button><span>第 {pageNo} 页 · 共 {total} 条</span><button disabled={pageNo * 20 >= total || loading} onclick={() => {pageNo++;void loadPages();}}>下一页</button></nav>
  {/if}
</section>

<style>
  .management {
    max-width: 1120px;
    margin: 0 auto;
    padding: 32px 24px 72px;
  }
  .heading {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    align-items: start;
    margin-bottom: 24px;
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
    margin: 5px 0;
    font-size: 24px;
    letter-spacing: -0.01em;
  }
  .muted {
    color: var(--muted);
    font-size: 13px;
  }
  button, .empty a {
    padding: 7px 13px;
    color: var(--text);
    background: var(--surface);
    border: 1px solid #d4d4d8;
    border-radius: 9px;
    font: inherit;
    font-size: 12.5px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease,
      transform 0.1s ease;
  }
  button:hover:not(:disabled), .empty a:hover {
    border-color: var(--faint);
    box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
  }
  button:active:not(:disabled) {
    transform: translateY(1px);
  }
  .heading-actions {
    display: flex;
    gap: 8px;
  }
  button:disabled {
    cursor: wait;
    opacity: 0.5;
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
    padding: 16px 18px;
    color: inherit;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
    text-decoration: none;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }
  .page-link:hover {
    border-color: rgb(79 70 229 / 45%);
    box-shadow: 0 2px 10px rgb(24 24 27 / 6%);
  }
  .page-id {
    font-weight: 700;
    font-size: 13.5px;
  }
  .summary {
    display: flex;
    flex-wrap: wrap;
    justify-content: end;
    gap: 16px;
    color: var(--muted);
    font-size: 12px;
  }
  code {
    margin-left: 4px;
    padding: 1px 7px;
    color: #3f3f46;
    background: var(--line-soft);
    border-radius: 5px;
    font-size: 11.5px;
  }
  .skeleton-list {
    display: grid;
    gap: 10px;
  }
  .skeleton-list i {
    height: 58px;
    background: linear-gradient(100deg, #ececee 40%, #f6f6f7 50%, #ececee 60%);
    background-size: 200% 100%;
    border-radius: 12px;
    animation: shimmer 1.6s ease-in-out infinite;
  }
  @keyframes shimmer {
    to {
      background-position: -200% 0;
    }
  }
  .empty,
  .error {
    display: grid;
    justify-items: start;
    gap: 12px;
    padding: 28px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
  }
  .empty h2 {
    margin: 0;
    font-size: 16px;
  }
  .empty p,
  .error p {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }
  @container platform (max-width: 720px) {
    .page-link {
      flex-direction: column;
    }
    .summary {
      justify-content: start;
    }
  }
</style>
