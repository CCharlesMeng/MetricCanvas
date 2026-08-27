<script lang="ts">
  import type { Snippet } from 'svelte';
  import { resolveActiveTab, type TabLabel } from './tabs';

  /**
   * Tab 容器(纯呈现):只负责页签铬和当前内容槽。
   * 子组件由统一运行时分发,本组件不认识表格或数据槽。
   */
  interface Props {
    title?: string;
    variant?: 'compact';
    tabs: readonly TabLabel[];
    defaultTab?: string;
    children: Snippet<[string]>;
  }

  let { title, variant, tabs, defaultTab, children }: Props = $props();
  let selected = $state<string | undefined>(undefined);
  const activeId = $derived(resolveActiveTab(tabs, selected, defaultTab));
</script>

<div class:compact={variant === 'compact'} class="tab-container">
  {#if title}<h3>{title}</h3>{/if}
  <div class="tab-list" role="tablist">
    {#each tabs as tab (tab.id)}
      <button
        type="button"
        role="tab"
        aria-selected={tab.id === activeId}
        class:active={tab.id === activeId}
        onclick={() => (selected = tab.id)}
      >
        {tab.label}
      </button>
    {/each}
  </div>
  {#if activeId}
    <div class="tab-panel" role="tabpanel">
      {@render children(activeId)}
    </div>
  {/if}
</div>

<style>
  .tab-container {
    display: flex;
    min-width: 0;
    min-height: 320px;
    flex: 1;
    flex-direction: column;
    background: var(--mc-color-surface, #fff);
    border-radius: 16px;
  }
  .tab-container.compact {
    height: 524px;
    min-height: 524px;
    flex: none;
  }
  h3 {
    margin: 0;
    padding: 12px 16px 0;
    color: var(--mc-card-title-color, #121e3b);
    font-size: var(--mc-card-title-font-size, 16px);
    font-weight: var(--mc-card-title-font-weight, 600);
    /* 缺省 inherit 而不是 normal:原来这里没有声明,行高走的是继承值。 */
    line-height: var(--mc-card-title-line-height, inherit);
  }
  /* 页签轨与页签铬两档形态取值不同:报表形态是「整条底边着色」的下划线页签,
     看板形态是「短指示条」页签。指示条走背景图而不是伪元素,报表形态下
     背景图为 none、尺寸为 0,不生成任何可见或占位的东西。 */
  .tab-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 10px 12px 0;
    border-bottom: 1px solid var(--mc-tab-track-color, #e4e4e7);
  }
  .compact .tab-list {
    box-sizing: border-box;
    width: 516px;
    height: 28px;
    flex: none;
    flex-wrap: nowrap;
    gap: 4px;
    padding: 0;
    margin: 14px 0 0 18px;
  }
  button {
    padding: 6px 12px;
    color: #595959;
    background: transparent;
    border: 0;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    font: inherit;
    font-size: var(--mc-tab-font-size, 13px);
  }
  .compact button {
    height: 28px;
    padding: 0 12px;
    line-height: 22px;
  }
  button.active {
    color: var(--mc-tab-active-color, #08359e);
    border-bottom-color: var(--mc-tab-active-underline-color, #08359e);
    font-weight: var(--mc-tab-active-font-weight, 600);
    /* 指示条整条走 background 简写:缺省 transparent 与上面那条 background
       逐字等价,报表形态的计算样式一个都不变。 */
    background: var(--mc-tab-indicator, transparent);
  }
  .tab-panel {
    display: flex;
    min-width: 0;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    padding: 8px 0 0;
  }
  .compact .tab-panel {
    box-sizing: border-box;
    width: 550px;
    height: 464px;
    flex: none;
    padding: 16px 0 0 18px;
  }
</style>
