<script lang="ts">
  import { afterNavigate, beforeNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import { readDirectoryHref, rememberDirectoryHref } from '$lib/directory-return';
  import type { Snapshot } from '@sveltejs/kit';
  import { onDestroy, tick } from 'svelte';
  import { pageRepository } from '$lib/services';
  import { pageComponentTypes, pageDataKinds, pageFolders, pageLayouts, filterPageDirectory, organizePageDirectory } from '$lib/page-directory';
  import { normalizeDirectoryNavigationState, readDirectoryNavigationState, rememberDirectoryNavigationState, type DirectoryNavigationState } from '$lib/directory-navigation-state';

  const directory = pageRepository.list().then(organizePageDirectory);
  const routeFolder = page.url.searchParams.get('scope');
  const routeComponent = page.url.searchParams.get('component');
  const revisiting = readDirectoryHref() === page.url.pathname + page.url.search;
  const saved = (routeFolder || routeComponent) && !revisiting
    ? normalizeDirectoryNavigationState({ folder: routeFolder ?? 'all', component: routeComponent ?? 'all' })
    : readDirectoryNavigationState();
  let query = $state(saved.query);
  let layoutForm = $state(saved.layoutForm);
  let component = $state(saved.component);
  let dataKind = $state(saved.dataKind);
  let folder = $state(saved.folder);
  let restoreHistorySnapshot = false;
  $effect(() => rememberDirectoryHref(page.url.pathname + page.url.search));
  let mounted = true;
  onDestroy(() => { mounted = false; });

  function captureState(): DirectoryNavigationState {
    return { query, layoutForm, component, dataKind, folder, scrollY: window.scrollY };
  }

  function rememberState() { rememberDirectoryNavigationState(captureState()); }
  $effect(rememberState);

  async function restoreScroll(scrollY: number) {
    try {
      const groups = await directory;
      if (!pageFolders(groups.flatMap(group => group.pages)).some(item => item.path === folder)) folder = 'all';
    } catch { return; }
    await tick();
    if (mounted) window.scrollTo(0, scrollY);
  }

  beforeNavigate(rememberState);
  afterNavigate(({ type }) => {
    restoreHistorySnapshot = type === 'popstate';
    if (type !== 'popstate') void restoreScroll(saved.scrollY);
  });

  export const snapshot: Snapshot<DirectoryNavigationState> = {
    capture: captureState,
    restore(value) {
      const state = normalizeDirectoryNavigationState(restoreHistorySnapshot ? value : saved);
      ({ query, layoutForm, component, dataKind, folder } = state);
      void restoreScroll(state.scrollY);
    }
  };

  function resetFilters() {
    query = ''; layoutForm = 'all'; component = 'all'; dataKind = 'all'; folder = 'all';
  }
</script>

<svelte:window onpagehide={rememberState} />

<main class="directory-page">
  <header class="page-heading">
    <div>
      <p class="eyebrow">METRICCANVAS / PLAYGROUND</p>
      <h1>全部页面文件</h1>
      <p class="intro">按文件夹查找页面，查看实际 JSON 并预览渲染。</p>
    </div>
    <a class="preview-entry" href="/preview">JSON 即时预览 <span aria-hidden="true">↗</span></a>
  </header>

  {#await directory}
    <p class="status" role="status">加载页面目录…</p>
  {:then groups}
    {@const pages = groups.flatMap(group => group.pages)}
    {@const total = pages.length}
    {@const allLayouts = filterPageDirectory(groups, query, 'all', component, dataKind, folder)}
    {@const visible = filterPageDirectory(groups, query, layoutForm, component, dataKind, folder)}
    {@const matched = visible.reduce((count, group) => count + group.pages.length, 0)}
    {@const filtered = query || layoutForm !== 'all' || component !== 'all' || dataKind !== 'all' || folder !== 'all'}
    <nav class="layout-selector" aria-label="文件夹导航">
      <label class="layout-label" for="directory-folder">文件夹路径</label>
      <select id="directory-folder" bind:value={folder}>
        <option value="all">全部页面（{total}）</option>
        {#each pageFolders(pages) as item (item.path)}
          <option value={item.path}>{'　'.repeat(item.depth)}{item.title}（{item.count}）</option>
        {/each}
      </select>
    </nav>
    <nav class="layout-selector" aria-label="布局形态">
      <span class="layout-label">布局形态</span>
      <button type="button" class:active={layoutForm === 'all'} aria-pressed={layoutForm === 'all'} onclick={() => layoutForm = 'all'}>全部形态 <span>{allLayouts.reduce((sum, group) => sum + group.pages.length, 0)}</span></button>
      {#each pageLayouts as layout (layout.id)}
        {@const count = allLayouts.flatMap(group => group.pages).filter(entry => entry.layoutForm === layout.id).length}
        {#if count > 0 || layoutForm === layout.id}
          <button type="button" class:active={layoutForm === layout.id} aria-pressed={layoutForm === layout.id} onclick={() => layoutForm = layout.id}>{layout.title} <span>{count}</span></button>
        {/if}
      {/each}
    </nav>
    <div class="directory-tools">
      <label class="search"><span>搜索页面</span><input type="search" bind:value={query} placeholder="搜索标题、路径或页面 ID" /></label>
      <label class="directory-filter">组件类型
        <select bind:value={component} aria-label="组件类型">
          <option value="all">全部组件</option>
          {#each pageComponentTypes as item (item.id)}
            {#if pages.some(entry => entry.componentTypes.includes(item.id)) || component === item.id}
              <option value={item.id}>{item.title}</option>
            {/if}
          {/each}
        </select>
      </label>
      <label class="directory-filter">数据来源
        <select bind:value={dataKind} aria-label="数据来源">
          <option value="all">全部数据来源</option>
          {#each pageDataKinds as item (item.id)}
            {#if pages.some(entry => entry.dataKind === item.id) || dataKind === item.id}<option value={item.id}>{item.title}</option>{/if}
          {/each}
        </select>
      </label>
    </div>
    <div class="results-heading">
      <p class="result-count" role="status">{filtered ? `显示 ${matched} / ${total} 个页面` : `共 ${total} 个页面 · 按文件夹分组`}</p>
      {#if filtered}<button type="button" onclick={resetFilters}>重置筛选</button>{/if}
    </div>
    {#if total === 0}
      <div class="empty"><h2>还没有页面</h2><p>在 pages/ 目录加入页面文档后，即可在这里预览。</p></div>
    {:else if matched === 0}
      <div class="empty"><h2>没有找到匹配页面</h2><p>试试其他关键词，或查看全部页面。</p><button type="button" onclick={resetFilters}>重置筛选</button></div>
    {:else}
      <div class="groups">
        {#each visible as group (group.id)}
          <section aria-labelledby={`group-${encodeURIComponent(group.id)}`}>
            <header class="group-heading"><h2 id={`group-${encodeURIComponent(group.id)}`}>{group.title} <span>{group.pages.length}</span></h2></header>
            <ul class="page-list">
              {#each group.pages as entry (entry.id)}
                <li><a class="page-card" href={`/pages/${encodeURIComponent(entry.id)}`}>
                  <div class="card-heading"><h3>{entry.title}</h3><span class="arrow" aria-hidden="true">↗</span></div>
                  <span class="layout-badge" class:dashboard={entry.layoutForm === 'dashboard'}>{entry.layoutForm === 'dashboard' ? 'Dashboard · 看板' : 'Report · 报表'}</span>
                  {#if entry.description}<p class="summary">{entry.description}</p>{/if}
                  <dl class="card-environment"><div><dt>数据</dt><dd>{pageDataKinds.find(item => item.id === entry.dataKind)?.title}</dd></div></dl>
                  <div class="card-footer"><span class="page-id">{entry.filePath ?? entry.id}</span><div class="tags">{#each entry.componentTypes as type}<span>{pageComponentTypes.find(item => item.id === type)?.title ?? type}</span>{/each}</div></div>
                </a></li>
              {/each}
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
  .directory-page {
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

  .directory-tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 0;
    border-top: 1px solid #e4e4e7;
    border-bottom: 1px solid #e4e4e7;
  }

  .directory-filter { display: flex; align-items: center; gap: 12px; color: #52525b; font-size: 13px; }
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
    .directory-page {
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
    .page-card {
      padding: 16px;
    }
  }
</style>
