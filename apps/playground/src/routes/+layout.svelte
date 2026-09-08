<script lang="ts">
  let { children } = $props();
</script>

<svelte:head>
  <title>页面试验场 · MetricCanvas</title>
</svelte:head>

{@render children()}

<style>
  :global(body) {
    margin: 0;
    background: #fafafa;
    color: #18181b;
    font-family:
      -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
      'Microsoft YaHei', sans-serif;
  }
</style>
