<script lang="ts">
  let { children } = $props();
</script>

<div class="shell">
  <header class="topbar">
    <a href="/" class="brand">MetricCanvas</a>
  </header>
  <main>{@render children()}</main>
</div>

<style>
  :global(body) {
    margin: 0;
    background: #fafafa;
    color: #18181b;
    font-family:
      -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
      'Microsoft YaHei', sans-serif;
  }
  .topbar {
    display: flex;
    align-items: center;
    height: 52px;
    padding: 0 24px;
    background: #ffffff;
    border-bottom: 1px solid #e4e4e7;
  }
  .brand {
    font-weight: 700;
    font-size: 15px;
    letter-spacing: -0.01em;
    color: #18181b;
    text-decoration: none;
  }
  main {
    padding: 24px;
    max-width: 1440px;
    margin: 0 auto;
  }
</style>
