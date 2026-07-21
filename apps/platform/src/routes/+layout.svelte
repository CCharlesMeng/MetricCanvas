<script lang="ts">
  let { children } = $props();
</script>

<svelte:head>
  <title>MetricCanvas 页面搭建工作台</title>
</svelte:head>

<header>
  <a href="/">MetricCanvas</a>
  <span>页面搭建工作台</span>
</header>

<main>{@render children()}</main>

<style>
  :global(*) {
    box-sizing: border-box;
  }
  :global(body) {
    margin: 0;
    color: #18181b;
    background: #f4f4f5;
    font-family:
      Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
      sans-serif;
  }
  header {
    height: 54px;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 0 22px;
    color: #f4f4f5;
    background: #18181b;
  }
  header a {
    color: #fff;
    font-weight: 700;
    text-decoration: none;
  }
  header span {
    color: #a1a1aa;
    font-size: 14px;
  }
  main {
    min-height: calc(100vh - 54px);
  }
</style>
