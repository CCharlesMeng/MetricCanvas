<script lang="ts">
  import { page } from '$app/state';
  const href = $derived(page.url.searchParams.get('href') ?? '');
  const target = $derived.by(() => {
    try { return new URL(href); }
    catch { return undefined; }
  });
</script>

<svelte:head><title>本地未收录目标页 · 页面试验场</title></svelte:head>

<main>
  <h1>本地未收录该目标页</h1>
  <p>页面试验场按 URL 最后一个路径段匹配 pages 中同名的 JSON。请检查文件名与页面 id 是否一致。</p>
  <h2>原目标地址</h2>
  <code data-target-href>{href}</code>
  {#if target}
    <h2>跳转参数</h2>
    <dl>{#each [...target.searchParams] as [key, value]}<dt>{key}</dt><dd>{value}</dd>{:else}<dd>无查询参数</dd>{/each}</dl>
    {#if target.hash}<p>锚点：<code>{target.hash}</code></p>{/if}
  {/if}
  <p>业务 JSON 保留原线上地址。此提示只表示本地没有同名页面，不代表线上地址无效。</p>
  <nav aria-label="继续预览"><a href="/files">查找本地页面</a><a href="/preview">JSON 即时预览</a></nav>
</main>

<style>
  main { max-width: 960px; padding: 32px 24px; margin: auto; }
  h1 { font-size: 24px; } h2 { margin-top: 24px; font-size: 18px; }
  p, dl { line-height: 1.7; } code, dd { overflow-wrap: anywhere; white-space: pre-wrap; }
  dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 8px 20px; }
  dd { margin: 0; } nav { display: flex; gap: 24px; margin-top: 24px; }
</style>
