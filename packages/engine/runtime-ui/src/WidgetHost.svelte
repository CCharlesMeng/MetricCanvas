<svelte:options css="injected" />
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { DataSnapshot } from '@metriccanvas/page/internal';
  import { renderableDataSnapshot } from './widget-host-state';

  /**
   * 快照态统一呈现(切片1 评审遗留的下沉):加载态由此承担，
   * 错误态与空态投影为空行就绪快照，让组件保留标题与容器。
   * 遗留原话是"下沉到运行时统一呈现"——runtime 包框架无关(零 svelte 依赖)容不下
   * Svelte 组件,故落表现层 widgets 包;"统一由平台呈现、壳不重复"这一目的等同达成。
   */
  interface Props {
    snapshot: DataSnapshot;
    notices?: string[];
    /** Configured content remains identifiable while data is loading or unavailable. */
    title?: string;
    /** 就绪态渲染内容 */
    ready: Snippet<[Extract<DataSnapshot, { status: 'ready' }>]>;
  }

  let { snapshot, ready, notices = [], title }: Props = $props();
  const renderable = $derived(renderableDataSnapshot(snapshot));
</script>

{#if title && !renderable}<h3>{title}</h3>{/if}
{#if !renderable}
  <div class="skeleton"></div>
{:else}
  {#each notices as notice}
    <div class="data-notice" role="status">{notice}</div>
  {/each}
  {@render ready(renderable)}
{/if}

<style>
  h3 {
    flex: none;
    margin: 0 0 6px;
    overflow-wrap: anywhere;
    color: var(--mc-card-title-color, #18181b);
    font-size: var(--mc-card-title-font-size, 16px);
    font-weight: var(--mc-card-title-font-weight, 500);
  }
  .data-notice {
    padding: 4px 8px;
    color: var(--mc-color-muted, #71717a);
    font-size: 12px;
    flex: none;
  }
  .skeleton {
    flex: 1;
    min-height: 72px;
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
