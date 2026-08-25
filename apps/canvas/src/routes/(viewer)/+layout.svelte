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
  .topbar {
    display: flex;
    align-items: center;
    height: 52px;
    padding: 0 24px;
    background: #fff;
    border-bottom: 1px solid #e4e4e7;
  }
  .brand {
    color: #18181b;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.01em;
    text-decoration: none;
  }
  /* 宿主外框不再统一裁宽:页面宽度由页面布局形态决定,报表形态的定宽居中
     由各路由的 `.page-frame` 承担,看板形态占满宿主宽度。 */
  main {
    width: 100%;
  }
</style>
