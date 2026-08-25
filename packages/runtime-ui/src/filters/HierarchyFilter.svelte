<script lang="ts">
  /**
   * 层级维度筛选器(纯渲染):层级 tabs + 维度取值控件。
   * 层级是筛选值的一部分,地图等分层视图读它,不维护自己的层级状态。
   */
  import type { FilterHierarchyLevel } from '@metriccanvas/page';
  import type { DimensionValuesSnapshot } from '@metriccanvas/runtime';
  import DimensionFilter from './DimensionFilter.svelte';

  interface Props {
    label?: string;
    levels: FilterHierarchyLevel[];
    level: string;
    values: string[];
    display?: 'select' | 'tabs' | 'tree' | 'search';
    candidates: DimensionValuesSnapshot;
    onchange: (next: { level: string; values: string[] }) => void;
  }

  let { label, levels, level, values, display = 'select', candidates, onchange }: Props = $props();
</script>

<div class="hierarchy">
  {#if label}<span class="label">{label}</span>{/if}
  <div class="tabs" role="tablist">
    {#each levels as item (item.id)}
      <button
        type="button"
        role="tab"
        class="tab"
        class:active={item.id === level}
        aria-selected={item.id === level}
        onclick={() => onchange({ level: item.id, values: [] })}
      >
        {item.label ?? item.id}
      </button>
    {/each}
  </div>
  <DimensionFilter
    candidates={candidates}
    value={values}
    display={display}
    onchange={(next) => onchange({ level, values: next })}
  />
</div>

<style>
  .hierarchy {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .label {
    color: #71717a;
    white-space: nowrap;
  }
  .tabs {
    display: flex;
    gap: 4px;
  }
  .tab {
    border: 1px solid #e4e4e7;
    background: #fff;
    border-radius: 8px;
    padding: 4px 10px;
    font-size: 13px;
    color: #3f3f46;
    cursor: pointer;
  }
  .tab.active {
    border-color: #08359e;
    color: #08359e;
    background: #eef3ff;
  }
</style>
