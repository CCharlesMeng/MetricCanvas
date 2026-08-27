<script lang="ts">
  /**
   * 层级维度筛选器(纯渲染):层级 tabs + 维度取值控件。
   * 层级是筛选值的一部分,地图等分层视图读它,不维护自己的层级状态。
   */
  import type { FilterHierarchyLevel } from '@metriccanvas/page';
  import type { DimensionValuesSnapshot } from '@metriccanvas/runtime';
  import { hierarchyControlValues } from '../map-hierarchy';
  import DimensionFilter from './DimensionFilter.svelte';

  interface Props {
    label?: string;
    emptyLabel?: string;
    levels: FilterHierarchyLevel[];
    level: string;
    values: string[];
    picker?: 'tabs' | 'hidden';
    display?: 'select' | 'tabs' | 'tree' | 'search';
    candidates: DimensionValuesSnapshot;
    onchange: (next: { level: string; values: string[] }) => void;
  }

  let {
    label,
    emptyLabel,
    levels,
    level,
    values,
    picker = 'tabs',
    display = 'select',
    candidates,
    onchange
  }: Props = $props();

  const firstLevel = $derived(levels[0]);
  const controlValues = $derived(
    picker === 'hidden' ? hierarchyControlValues(values, candidates) : values
  );
</script>

<div class="hierarchy">
  {#if label}<span class="label">{label}</span>{/if}
  {#if picker === 'tabs'}
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
  {:else if firstLevel && level !== firstLevel.id}
    <button
      type="button"
      class="back"
      aria-label={`返回${firstLevel.label ?? firstLevel.id}`}
      onclick={() => onchange({ level: firstLevel.id, values: [] })}
    >
      返回
    </button>
  {/if}
  <DimensionFilter
    {emptyLabel}
    candidates={candidates}
    value={controlValues}
    display={display}
    onchange={(next) => onchange({ level, values: next })}
  />
</div>

<style>
  /* 控件铬与外置字段名标签的可见性经 --mc-filter-* 下发；层级切换器是否
     存在则由筛选声明决定，不能按整个 dashboard 形态全局隐藏。 */
  .hierarchy {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: var(--mc-filter-font-size, 13px);
  }
  .label {
    display: var(--mc-filter-label-display, inline);
    color: #71717a;
    white-space: nowrap;
  }
  .tabs {
    display: flex;
    gap: 4px;
  }
  .tab {
    border: 1px solid var(--mc-filter-control-border-color, #e4e4e7);
    background: #fff;
    border-radius: var(--mc-filter-control-radius, 8px);
    padding: 4px 10px;
    font-size: var(--mc-filter-font-size, 13px);
    color: #3f3f46;
    cursor: pointer;
  }
  .tab.active {
    border-color: #08359e;
    color: #08359e;
    background: #eef3ff;
  }
  .back {
    border: 0;
    background: transparent;
    padding: 0;
    color: #08359e;
    font: inherit;
    cursor: pointer;
    white-space: nowrap;
  }
</style>
