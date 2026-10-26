<script lang="ts">
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { readDirectoryHref } from '$lib/directory-return';
  const framed = browser && window.self !== window.top;
  const directoryHref = $derived.by(() => { page.url.pathname; return readDirectoryHref(); });
  $effect(() => {
    const href = page.url.href;
    if (framed) window.parent.postMessage({ type: 'metriccanvas:preview-location', href }, window.location.origin);
  });
  let { children } = $props();
</script>

{#if page.url.pathname !== '/' && !page.url.pathname.startsWith('/catalog/') && !framed}
  <nav class="viewer-navigation" aria-label="试验场导航">
    <a href={page.url.pathname === '/files' ? '/' : directoryHref}>← 页面目录</a>
    {#if page.url.pathname !== '/preview'}<a href="/preview">JSON 即时预览</a>{/if}
  </nav>
{/if}

{@render children()}

<style>
  .viewer-navigation {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 24px;
    border-bottom: 1px solid #e4e4e7;
    background: #fafafa;
    font-size: 12px;
  }
  a { color: #52525b; text-decoration: none; }
  a:hover { color: #3730a3; }
  a:focus-visible { outline: 2px solid #6366f1; outline-offset: 3px; }
  @media print { .viewer-navigation { display: none; } }
</style>
