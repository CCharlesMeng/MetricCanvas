<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { DataSnapshot } from '@metriccanvas/page';

  /**
   * 快照态统一呈现(切片1 评审遗留的下沉):加载骨架屏/结构化错误/空态由此承担,
   * 壳与组件都不再手写状态分支;组件只经 ready 快照渲染(纯渲染原则)。
   */
  interface Props {
    snapshot: DataSnapshot;
    /** 就绪态渲染内容 */
    ready: Snippet<[Extract<DataSnapshot, { status: 'ready' }>]>;
  }

  let { snapshot, ready }: Props = $props();
</script>

{#if snapshot.status === 'loading'}
  <div class="skeleton"></div>
{:else if snapshot.status === 'error'}
  <div class="state error">查询失败:{snapshot.error.message}</div>
{:else if snapshot.status === 'empty'}
  <div class="state">暂无数据</div>
{:else}
  {@render ready(snapshot)}
{/if}

<style>
  .skeleton {
    flex: 1;
    border-radius: 6px;
    background: linear-gradient(90deg, #f4f4f5 25%, #e4e4e7 50%, #f4f4f5 75%);
    background-size: 200% 100%;
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse {
    from {
      background-position: 200% 0;
    }
    to {
      background-position: -200% 0;
    }
  }
  .state {
    flex: 1;
    display: flex;
    align-items: center;
    color: #71717a;
    font-size: 14px;
  }
  .state.error {
    color: #b91c1c;
  }
</style>
