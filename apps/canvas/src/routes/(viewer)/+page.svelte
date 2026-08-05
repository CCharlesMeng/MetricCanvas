<script lang="ts">
  import { pageRepository } from '$lib/services';
</script>

<h1>看板目录</h1>

<a class="preview-entry" href="/preview">
  <span class="title">Page JSON 即时预览</span>
  <span class="desc">粘贴或编辑页面文档，并直接查看严格校验后的渲染结果。</span>
</a>

{#await pageRepository.list()}
  <p class="muted">加载中…</p>
{:then pages}
  {#if pages.length === 0}
    <p class="muted">pages/ 目录还没有页面。</p>
  {:else}
    <ul class="catalog">
      {#each pages as p (p.id)}
        <li>
          <a href="/pages/{p.id}">
            <span class="title">{p.title}</span>
            {#if p.description}<span class="desc">{p.description}</span>{/if}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
{/await}

<style>
  h1 {
    font-size: 20px;
    margin: 8px 0 20px;
  }
  .muted {
    color: #71717a;
  }
  .preview-entry {
    display: block;
    padding: 16px;
    margin-bottom: 20px;
    color: #312e81;
    background: #eef2ff;
    border: 1px solid #c7d2fe;
    border-radius: 10px;
    text-decoration: none;
  }
  .preview-entry:hover {
    border-color: #818cf8;
  }
  .catalog {
    list-style: none;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }
  .catalog a {
    display: block;
    padding: 16px;
    background: #fff;
    border: 1px solid #e4e4e7;
    border-radius: 10px;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s;
  }
  .catalog a:hover {
    border-color: #a1a1aa;
  }
  .title {
    display: block;
    font-weight: 600;
  }
  .desc {
    display: block;
    margin-top: 4px;
    font-size: 13px;
    color: #71717a;
  }
</style>
