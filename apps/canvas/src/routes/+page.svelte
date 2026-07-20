<script lang="ts">
  import { pageRepository } from '$lib/services';
</script>

<h1>看板目录</h1>

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
