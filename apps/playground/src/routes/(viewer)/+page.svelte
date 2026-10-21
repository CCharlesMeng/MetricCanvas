<script lang="ts">
  import { afterNavigate, beforeNavigate } from '$app/navigation';
  import type { Snapshot } from '@sveltejs/kit';
  import { onDestroy, tick } from 'svelte';
  import { pageRepository } from '$lib/services';
  import { catalogCapabilities, catalogCategories, catalogLayouts, catalogRuntimes, filterPageCatalog, organizePageCatalog, runtimeInfo } from '$lib/page-catalog';
  import { normalizeCatalogNavigationState, readCatalogNavigationState, rememberCatalogNavigationState, type CatalogNavigationState } from '$lib/catalog-navigation-state';

  const catalog = pageRepository.list().then(organizePageCatalog);
  const saved = readCatalogNavigationState();
  let query = $state(saved.query);
  let category = $state(saved.category);
  let layoutForm = $state(saved.layoutForm);
  let capability = $state(saved.capability);
  let runtime = $state(saved.runtime);
  let mounted = true;
  onDestroy(() => { mounted = false; });

  function captureState(): CatalogNavigationState {
    return { query, category, layoutForm, capability, runtime, scrollY: window.scrollY };
  }

  function rememberState() {
    rememberCatalogNavigationState(captureState());
  }

  async function restoreScroll(scrollY: number, restoreAnchor = false) {
    // 目录异步加载且筛选会改变高度，等卡片渲染后再恢复位置。
    try {
      await catalog;
    } catch {
      return;
    }
    await tick();
    if (!mounted) return;
    const anchor = restoreAnchor && location.hash.startsWith('#group-')
      ? document.getElementById(location.hash.slice(1)) : null;
    if (anchor) anchor.scrollIntoView();
    else window.scrollTo(0, scrollY);
  }

  beforeNavigate(rememberState);
  afterNavigate(({ type }) => {
    if (type !== 'popstate') void restoreScroll(saved.scrollY, true);
  });

  // 浏览器前进/后退按各历史记录恢复；“页面目录”链接则恢复最近一次目录。
  export const snapshot: Snapshot<CatalogNavigationState> = {
    capture: captureState,
    restore(value) {
      const state = normalizeCatalogNavigationState(value);
      ({ query, category, layoutForm, capability, runtime } = state);
      void restoreScroll(state.scrollY);
    }
  };

  function resetFilters() {
    query = ''; category = 'all'; layoutForm = 'all'; capability = 'all'; runtime = 'all';
  }
</script>

<svelte:window onpagehide={rememberState} />

<main class="catalog-page">
  <header class="page-heading">
    <div>
      <p class="eyebrow">METRICCANVAS / PLAYGROUND</p>
      <h1>页面试验场</h1>
      <p class="intro">按能力找到示例，跟随操作观察效果，再查看配置与适用边界。</p>
    </div>
    <a class="preview-entry" href="/preview">JSON 即时预览 <span aria-hidden="true">↗</span></a>
  </header>

  {#await catalog}
    <p class="status" role="status">加载页面目录…</p>
  {:then groups}
    {@const total = groups.reduce((count, group) => count + group.pages.length, 0)}
    {@const layoutGroups = filterPageCatalog(groups, query, 'all', layoutForm, capability, runtime)}
    {@const allLayouts = filterPageCatalog(groups, query, category, 'all', capability, runtime)}
    {@const visible = filterPageCatalog(groups, query, category, layoutForm, capability, runtime)}
    {@const matched = visible.reduce((count, group) => count + group.pages.length, 0)}
    <nav class="capability-selector" aria-label="按能力查找">
      <div class="capability-heading"><h2>你想实现什么？</h2><button type="button" class:active={capability === 'all'} aria-pressed={capability === 'all'} onclick={() => capability = 'all'}>全部能力</button></div>
      <div class="capability-list">
        {#each catalogCapabilities as item (item.id)}
          {@const count = filterPageCatalog(groups, query, category, layoutForm, item.id, runtime).reduce((sum, group) => sum + group.pages.length, 0)}
          {#if count > 0 || capability === item.id}
            <button type="button" class:active={capability === item.id} aria-pressed={capability === item.id} onclick={() => capability = item.id}>
              <strong>{item.title} <span>{count}</span></strong><small>{item.question}</small>
            </button>
          {/if}
        {/each}
      </div>
    </nav>
    <nav class="layout-selector" aria-label="布局形态">
      <span class="layout-label">布局形态</span>
      <button type="button" class:active={layoutForm === 'all'} aria-pressed={layoutForm === 'all'} onclick={() => layoutForm = 'all'}>全部形态 <span>{allLayouts.reduce((sum, group) => sum + group.pages.length, 0)}</span></button>
      {#each catalogLayouts as layout (layout.id)}
        {@const count = allLayouts.flatMap((group) => group.pages).filter((entry) => entry.layoutForm === layout.id).length}
        {#if count > 0 || layoutForm === layout.id}
          <button type="button" class:active={layoutForm === layout.id} aria-pressed={layoutForm === layout.id} onclick={() => layoutForm = layout.id}>{layout.title} <span>{count}</span></button>
        {/if}
      {/each}
    </nav>
    <div class="catalog-tools">
      <label class="search">
        <span>搜索页面</span>
        <input type="search" bind:value={query} placeholder="搜索名称、功能或页面 ID" />
      </label>
      <label class="runtime-filter">运行条件
        <select bind:value={runtime} aria-label="运行条件">
          <option value="all">全部运行条件</option>
          {#each catalogRuntimes as item (item.id)}
            {@const count = filterPageCatalog(groups, query, category, layoutForm, capability, item.id).reduce((sum, group) => sum + group.pages.length, 0)}
            {#if count > 0 || runtime === item.id}<option value={item.id}>{item.title}</option>{/if}
          {/each}
        </select>
      </label>
      <nav class="categories" aria-label="页面分类">
        <button type="button" class:active={category === 'all'} aria-pressed={category === 'all'} onclick={() => category = 'all'}>全部用途 <span>{layoutGroups.reduce((sum, group) => sum + group.pages.length, 0)}</span></button>
        {#each catalogCategories as item (item.id)}
          {@const count = layoutGroups.filter((group) => group.category === item.id).reduce((sum, group) => sum + group.pages.length, 0)}
          {#if count > 0 || category === item.id}
            <button type="button" class:active={category === item.id} aria-pressed={category === item.id} onclick={() => category = item.id}>{item.title} <span>{count}</span></button>
          {/if}
        {/each}
      </nav>
    </div>
    <div class="results-heading">
      <p class="result-count" role="status">{query || category !== 'all' || layoutForm !== 'all' || capability !== 'all' || runtime !== 'all' ? `显示 ${matched} / ${total} 个页面` : `共 ${total} 个页面 · 按用途分组`}</p>
      {#if query || category !== 'all' || layoutForm !== 'all' || capability !== 'all' || runtime !== 'all'}<button type="button" onclick={resetFilters}>重置筛选</button>{/if}
    </div>

    {#if total === 0}
      <div class="empty"><h2>还没有页面</h2><p>在 pages/ 目录加入页面文档后，即可在这里预览。</p></div>
    {:else if matched === 0}
      <div class="empty"><h2>没有找到匹配页面</h2><p>试试其他关键词，或查看全部页面。</p><button type="button" onclick={resetFilters}>重置筛选</button></div>
    {:else}
      <div class="groups">
        {#each visible as group (group.id)}
          <section aria-labelledby={`group-${group.id}`}>
            <header class="group-heading">
              <h2 id={`group-${group.id}`}>{group.title} <span>{group.pages.length}</span></h2>
              <p>{group.description}</p>
            </header>
            <ul class="page-list">
              {#if group.collection}
                <li class="collection-entry">
                  <a class="page-card collection-card" href={group.collection.href + (group.pages.length < (groups.find(item => item.id === group.id)?.pages.length ?? 0) ? `?scene=${group.pages[0]!.scenario}` : '')}>
                    <div class="card-heading"><h3>{group.collection.title}</h3><span class="arrow" aria-hidden="true">↗</span></div>
                    <p class="summary">{group.collection.summary}</p>
                    <div class="tags"><span>时间选择</span><span>业务筛选</span><span>币种与金额</span><span>跨页传值</span><span>能力一览</span></div>
                    <p class="collection-count">{group.pages.length} 个匹配场景 · 在同一入口中体验</p>
                  </a>
                </li>
              {:else}
              {#each group.pages as entry (entry.id)}
                <li>
                  <a class="page-card" href={`/pages/${encodeURIComponent(entry.id)}`}>
                    <div class="card-heading"><h3>{entry.displayTitle}</h3><span class="arrow" aria-hidden="true">↗</span></div>
                    <span class="layout-badge" class:dashboard={entry.layoutForm === 'dashboard'}>{entry.layoutForm === 'dashboard' ? 'Dashboard · 看板' : 'Report · 报表'}</span>
                    <p class="summary">{entry.summary}</p>
                    {#if entry.environment}
                      <dl class="card-environment">
                        <div><dt>数据</dt><dd>{entry.environment.data}</dd></div>
                        <div><dt>运行</dt><dd>{runtimeInfo(entry.environment.runtime)?.title}</dd></div>
                        <div><dt>体验</dt><dd>{entry.environment.scope}</dd></div>
                      </dl>
                    {/if}
                    <div class="card-footer"><span class="page-id">{entry.id}</span><div class="tags">{#each entry.tags as tag}<span>{tag}</span>{/each}</div></div>
                  </a>
                </li>
              {/each}
              {/if}
            </ul>
          </section>
        {/each}
      </div>
    {/if}
  {:catch error}
    <p class="status" role="alert">页面目录加载失败：{error instanceof Error ? error.message : String(error)}</p>
  {/await}
</main>

<style>
  .collection-entry { grid-column: 1 / -1; }
  .collection-count { margin: 16px 0 0; color: #71717a; font-size: 12px; }
  .catalog-page {
    max-width: 1200px;
    padding: 40px 32px 64px;
    margin: 0 auto;
  }

  .page-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 32px;
  }

  .eyebrow {
    color: #71717a;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .12em;
    margin: 0 0 10px;
  }

  h1 {
    font-size: 28px;
    letter-spacing: -.03em;
    margin: 0;
  }

  .intro {
    margin: 10px 0 0;
    color: #71717a;
    font-size: 14px;
  }

  .preview-entry {
    display: flex;
    gap: 20px;
    align-items: center;
    padding: 12px 16px;
    border: 1px solid #c7d2fe;
    border-radius: 8px;
    background: #eef2ff;
    color: #3730a3;
    text-decoration: none;
    font-size: 14px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .preview-entry:hover {
    border-color: #818cf8;
  }

  .catalog-tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 0;
    border-top: 1px solid #e4e4e7;
    border-bottom: 1px solid #e4e4e7;
  }

  .capability-selector { margin-bottom: 28px; }
  .capability-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .capability-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .capability-list button { border: 1px solid #e4e4e7; text-align: left; padding: 12px; min-width: 0; }
  .capability-list button.active { border-color: #818cf8; background: #eef2ff; }
  .capability-list strong { display: block; font-size: 13px; }
  .capability-list small { display: block; margin-top: 4px; font-size: 12px; font-weight: 400; line-height: 1.6; color: #71717a; }
  .runtime-filter { display: flex; align-items: center; gap: 12px; color: #52525b; font-size: 13px; }
  select { max-width: 100%; border: 1px solid #d4d4d8; border-radius: 7px; padding: 10px; background: white; color: #18181b; font: inherit; }
  .results-heading { display: flex; align-items: center; justify-content: space-between; margin: 16px 0 28px; }
  .results-heading .result-count { margin: 0; }
  .card-environment { margin: 0 0 16px; font-size: 12px; line-height: 1.7; color: #52525b; }
  .card-environment div { display: flex; gap: 8px; }
  .card-environment dt { flex: none; color: #71717a; }
  .card-environment dd { margin: 0; overflow-wrap: anywhere; }

  .layout-selector {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }

  .layout-label {
    color: #52525b;
    font-size: 13px;
    margin-right: 4px;
  }

  .layout-badge {
    align-self: flex-start;
    margin-top: 8px;
    padding: 3px 7px;
    border-radius: 4px;
    background: #f4f4f5;
    color: #52525b;
    font-size: 11px;
  }

  .layout-badge.dashboard {
    background: #eef2ff;
    color: #3730a3;
  }

  .search {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
    color: #52525b;
  }

  input {
    box-sizing: border-box;
    width: 280px;
    min-width: 0;
    border: 1px solid #d4d4d8;
    border-radius: 7px;
    padding: 10px 12px;
    background: white;
    color: #18181b;
    font: inherit;
  }

  .categories {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  button {
    border: 1px solid transparent;
    border-radius: 7px;
    padding: 9px 12px;
    background: transparent;
    color: #52525b;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }

  button:hover {
    background: #f4f4f5;
  }

  button.active {
    background: #fff;
    border-color: #d4d4d8;
    color: #18181b;
    font-weight: 600;
  }

  button span {
    margin-left: 5px;
    font-size: 11px;
    color: #71717a;
  }

  a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible {
    outline: 2px solid #6366f1;
    outline-offset: 3px;
  }

  .result-count {
    margin: 16px 0 28px;
    font-size: 12px;
    color: #71717a;
  }

  .groups {
    display: grid;
    gap: 36px;
  }

  .group-heading {
    margin-bottom: 14px;
  }

  h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 600;
  }

  h2 span {
    display: inline-block;
    margin-left: 6px;
    color: #71717a;
    font-size: 12px;
    font-weight: 400;
  }

  .group-heading p {
    margin: 7px 0 0;
    font-size: 13px;
    color: #71717a;
    line-height: 1.6;
  }

  .page-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .page-list li {
    min-width: 0;
  }

  .page-card {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    height: 100%;
    padding: 18px 20px;
    border: 1px solid #e4e4e7;
    border-radius: 9px;
    background: #fff;
    color: inherit;
    text-decoration: none;
    transition: border-color .15s;
  }

  .page-card:hover {
    border-color: #a5b4fc;
  }

  .card-heading {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
  }

  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }

  .arrow {
    color: #a1a1aa;
  }

  .summary {
    margin: 8px 0 16px;
    color: #71717a;
    font-size: 13px;
    line-height: 1.6;
  }

  .card-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: auto;
  }

  .page-id {
    font: 10px ui-monospace, monospace;
    color: #71717a;
    overflow-wrap: anywhere;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .tags span {
    border-radius: 4px;
    padding: 3px 6px;
    background: #f4f4f5;
    font-size: 10px;
    color: #52525b;
  }

  .status, .empty p {
    color: #71717a;
    font-size: 14px;
  }

  .empty {
    padding: 48px 20px;
    text-align: center;
    border: 1px dashed #d4d4d8;
    border-radius: 9px;
  }

  .empty button {
    border-color: #d4d4d8;
    background: #fff;
  }

  @media (max-width: 700px) {
    .catalog-page {
      padding: 24px 20px 40px;
    }
    .page-heading {
      align-items: flex-start;
      flex-direction: column;
      gap: 20px;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 24px;
    }
    .search {
      width: 100%;
    }
    .search > span {
      flex-shrink: 0;
    }
    input {
      width: 100%;
    }
    .page-list {
      grid-template-columns: minmax(0, 1fr);
    }
    .capability-list { grid-template-columns: minmax(0, 1fr); }
    .page-card {
      padding: 16px;
    }
    .categories {
      gap: 3px;
    }
    .categories button {
      padding: 8px 9px;
    }
  }
</style>
