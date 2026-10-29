<svelte:options css="injected" />
<script lang="ts">
  import type { DataWarning } from '@metriccanvas/page/internal';
  let { warnings }: { warnings: DataWarning[] } = $props();
</script>

{#if warnings.length}
  <details class="data-warning" role="status">
    <summary>部分数据异常，当前展示可用结果</summary>
    <ul>{#each warnings as warning}<li>{warning.sourceId}：{warning.message}（{warning.count}）</li>{/each}</ul>
  </details>
{/if}

<style>
  .data-warning { flex:none; margin:0 0 8px; padding:8px 12px; color:#8a5700; background:#fff8e6; font-size:12px; line-height:1.5; }
  summary { cursor:pointer; }
  ul { margin:6px 0 0; padding-left:18px; }
</style>
