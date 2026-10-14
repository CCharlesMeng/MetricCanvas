<script lang="ts">
  import { pageRepository } from '$lib/services';
  import { catalogCategories, catalogLayouts, filterPageCatalog, organizePageCatalog } from '$lib/page-catalog';

  const catalog = pageRepository.list().then(organizePageCatalog);
  let query = $state('');
  let category = $state('all');
  let layoutForm = $state('all');
</script>

<main class="catalog-page">
  <header class="page-heading">
    <div>
      <p class="eyebrow">METRICCANVAS / PLAYGROUND</p>
      <h1>页面试验场</h1>
      <p class="intro">浏览业务示例，查找功能演示，验证页面表现。</p>
    </div>
    <a class="preview-entry" href="/preview">JSON 即时预览 <span aria-hidden="true">↗</span></a>
  </header>

  {#await catalog}
    <p class="status" role="status">加载页面目录…</p>
  {:then groups}
    {@const total = groups.reduce((count, group) => count + group.pages.length, 0)}
    {@const layoutGroups = filterPageCatalog(groups, '', 'all', layoutForm)}
    {@const visible = filterPageCatalog(groups, query, category, layoutForm)}
    {@const matched = visible.reduce((count, group) => count + group.pages.length, 0)}
    <nav class="layout-selector" aria-label="布局形态">
      <span class="layout-label">布局形态</span>
      <button type="button" class:active={layoutForm === 'all'} aria-pressed={layoutForm === 'all'} onclick={() => layoutForm = 'all'}>全部形态 <span>{total}</span></button>
      {#each catalogLayouts as layout (layout.id)}
        {@const count = groups.flatMap((group) => group.pages).filter((entry) => entry.layoutForm === layout.id).length}
        <button type="button" class:active={layoutForm === layout.id} aria-pressed={layoutForm === layout.id} onclick={() => layoutForm = layout.id}>{layout.title} <span>{count}</span></button>
      {/each}
    </nav>
    <div class="catalog-tools">
      <label class="search">
        <span>搜索页面</span>
        <input type="search" bind:value={query} placeholder="搜索名称、功能或页面 ID" />
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
    <p class="result-count" role="status">{query || category !== 'all' || layoutForm !== 'all' ? `显示 ${matched} / ${total} 个页面` : `共 ${total} 个页面 · 按用途分组`}</p>

    {#if total === 0}
      <div class="empty"><h2>还没有页面</h2><p>在 pages/ 目录加入页面文档后，即可在这里预览。</p></div>
    {:else if matched === 0}
      <div class="empty"><h2>没有找到匹配页面</h2><p>试试其他关键词，或查看全部页面。</p><button type="button" onclick={() => { query = ''; category = 'all'; layoutForm = 'all'; }}>重置筛选</button></div>
    {:else}
      <div class="groups">
        {#each visible as group (group.id)}
          <section aria-labelledby={`group-${group.id}`}>
            <header class="group-heading">
              <h2 id={`group-${group.id}`}>{group.title} <span>{group.pages.length}</span></h2>
              <p>{group.description}</p>
            </header>
            <ul class="page-list">
              {#each group.pages as entry (entry.id)}
                <li>
                  <a class="page-card" href={`/pages/${encodeURIComponent(entry.id)}`}>
                    <div class="card-heading"><h3>{entry.title}</h3><span class="arrow" aria-hidden="true">↗</span></div>
                    <span class="layout-badge" class:dashboard={entry.layoutForm === 'dashboard'}>{entry.layoutForm === 'dashboard' ? 'Dashboard · 看板' : 'Report · 报表'}</span>
                    <p class="summary">{entry.summary}</p>
                    <div class="card-footer"><span class="page-id">{entry.id}</span><div class="tags">{#each entry.tags as tag}<span>{tag}</span>{/each}</div></div>
                  </a>
                </li>
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

  a:focus-visible, button:focus-visible, input:focus-visible {
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
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
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
