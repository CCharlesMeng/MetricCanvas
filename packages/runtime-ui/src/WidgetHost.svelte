<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { DataSnapshot } from '@metriccanvas/page';
  import { renderableDataSnapshot } from './widget-host-state';

  /**
   * 快照态统一呈现(切片1 评审遗留的下沉):加载态由此承担，
   * 空态/错误态投影为空行就绪快照，让组件的标题、容器、坐标轴与表头继续完整渲染。
   * 遗留原话是"下沉到运行时统一呈现"——runtime 包框架无关(零 svelte 依赖)容不下
   * Svelte 组件,故落表现层 widgets 包;"统一由平台呈现、壳不重复"这一目的等同达成。
   */
  interface Props {
    snapshot: DataSnapshot;
    /** 就绪态渲染内容 */
    ready: Snippet<[Extract<DataSnapshot, { status: 'ready' }>]>;
  }

  let { snapshot, ready }: Props = $props();
  const renderable = $derived(renderableDataSnapshot(snapshot));
</script>

{#if !renderable}
  <div class="skeleton"></div>
{:else}
  {@render ready(renderable)}
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
</style>
