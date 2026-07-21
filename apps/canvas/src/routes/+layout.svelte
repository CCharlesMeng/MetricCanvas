<script lang="ts">
  import { page } from '$app/state';

  let { children } = $props();
  const authoring = $derived(page.url.pathname === '/authoring');
</script>

<div class:authoring class="shell">
  {#if !authoring}
    <header class="topbar">
      <a href="/" class="brand">MetricCanvas</a>
    </header>
  {/if}
  <main class:authoring>{@render children()}</main>
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
  main.authoring {
    max-width: none;
    min-height: 100vh;
    padding: 42px 24px 24px;
  }
</style>
