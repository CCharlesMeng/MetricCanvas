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
  main {
    max-width: 1440px;
    margin: 0 auto;
    padding: 24px;
  }
</style>
