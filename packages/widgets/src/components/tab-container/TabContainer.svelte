<script lang="ts">
  import type { Snippet } from 'svelte';
  import { resolveActiveTab, type TabLabel } from './tabs';

  /**
   * Tab 容器(纯呈现):只负责页签铬和当前内容槽。
   * 子组件由统一运行时分发,本组件不认识表格或数据槽。
   */
  interface Props {
    title?: string;
    tabs: readonly TabLabel[];
    defaultTab?: string;
    children: Snippet<[string]>;
  }

  let { title, tabs, defaultTab, children }: Props = $props();
  let selected = $state<string | undefined>(undefined);
  const activeId = $derived(resolveActiveTab(tabs, selected, defaultTab));
</script>

<div class="tab-container">
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
  h3 {
    margin: 0;
    padding: 12px 16px 0;
    color: #121e3b;
    font-size: 16px;
    font-weight: 600;
  }
  .tab-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 10px 12px 0;
    border-bottom: 1px solid #e4e4e7;
  }
  button {
    padding: 6px 12px;
    color: #595959;
    background: transparent;
    border: 0;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    font: inherit;
    font-size: 13px;
  }
  button.active {
    color: #08359e;
    border-bottom-color: #08359e;
    font-weight: 600;
  }
  .tab-panel {
    display: flex;
    min-width: 0;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    padding: 8px 0 0;
  }
</style>
