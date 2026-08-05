<script lang="ts">
  let { children } = $props();
</script>

<main>{@render children()}</main>

<style>
  main {
    min-height: 100vh;
    padding: 42px 24px 24px;
  }
</style>
