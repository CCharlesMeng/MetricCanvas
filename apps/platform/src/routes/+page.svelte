<script lang="ts">
  import PageBuildingWorkbench from '$lib/PageBuildingWorkbench.svelte';
</script>

<div class="management-link">
  <a href="/manage">管理已有看板页面 →</a>
</div>
<PageBuildingWorkbench />

<style>
  .management-link {
    display: flex;
    justify-content: end;
    max-width: 1180px;
    margin: 0 auto;
    padding: 14px 22px 0;
  }
  a {
    color: #3f3f46;
    font-size: 14px;
  }
</style>
