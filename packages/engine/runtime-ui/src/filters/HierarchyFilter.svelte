<svelte:options css="injected" />
<script lang="ts">
  /**
   * 层级维度筛选器：单选在树内直接选层级和值；显式切层器保留旧交互。
   * 层级是筛选值的一部分,地图等分层视图读它,不维护自己的层级状态。
   */
  import type { DimensionSelectionExtension, FilterHierarchyLevel } from '@metriccanvas/page/internal';
  import type { DimensionValuesSnapshot } from '../../../runtime/src';
  import { hierarchyControlValues } from '../map-hierarchy';
  import DimensionFilter from './DimensionFilter.svelte';
  import HierarchyTreeFilter from './HierarchyTreeFilter.svelte';
  import { usesHierarchyTree } from './hierarchy-tree';

  interface Props {
    label?: string;
    selection?:DimensionSelectionExtension['selection'];
    structural?:boolean;
    searchable?:boolean;treeSelection?:import('@metriccanvas/ui').TreeSelection;
    emptyLabel?: string;
    levels: FilterHierarchyLevel[];
    level: string;
    values: string[];
    picker?: 'tabs' | 'hidden';
    display?: 'select' | 'tabs' | 'tree' | 'search';
    candidates: DimensionValuesSnapshot;
    candidateLevels?:Record<string,DimensionValuesSnapshot>;
    onretry?:()=>void;
    onchange: (next: { level: string; values: string[] }) => void;
  }

  let {
    candidateLevels,selection,structural=false,searchable=true,treeSelection='descendants',label,
    emptyLabel,
    levels,
    level,
    values,
    picker,
    display = 'select',
    candidates,
    onchange,
    onretry
  }: Props = $props();

  let draftLevel=$state('');
  $effect(()=>{draftLevel=level;});
  const activeLevel=$derived(selection?.required?draftLevel:level);
  const levelCandidates=$derived(candidateLevels?.[activeLevel]??candidates);
  const activeCandidates:DimensionValuesSnapshot=$derived(structural&&levelCandidates.status==='ready'&&!levelCandidates.candidates.some(item=>item.level===activeLevel&&!item.disabled)?{status:'empty'}:levelCandidates);
  const activeValues=$derived(activeLevel===level?values:[]);
  function chooseLevel(next:string){if(selection?.required)draftLevel=next;else onchange({level:next,values:[]});}
  const firstLevel = $derived(levels[0]);
  const integratedTree = $derived(usesHierarchyTree(display, selection?.mode, picker));
  const controlValues = $derived(
    picker === 'hidden' ? hierarchyControlValues(activeValues, activeCandidates) : activeValues
  );
</script>

<div class="hierarchy">
  {#if label}<span class="label">{label}</span>{/if}
  {#if integratedTree}
    <HierarchyTreeFilter {label} {emptyLabel} {levels} {level} {values} {structural} {treeSelection} {searchable} {onretry} {onchange}
      required={selection?.required} receipts={candidateLevels ?? { [level]: candidates }}/>
  {:else}
    {#if (picker ?? 'tabs') === 'tabs'}
      <div class="tabs" role="tablist">
        {#each levels as item (item.id)}
          <button
            type="button"
            role="tab"
            class="tab"
            class:active={item.id === activeLevel}
            aria-selected={item.id === activeLevel}
            onclick={() => chooseLevel(item.id)}
          >
            {item.label ?? item.id}
          </button>
        {/each}
      </div>
    {:else if firstLevel && activeLevel !== firstLevel.id}
      <button
        type="button"
        class="back"
        aria-label={`返回${firstLevel.label ?? firstLevel.id}`}
        onclick={() => chooseLevel(firstLevel.id)}
      >
        返回
      </button>
    {/if}
    <DimensionFilter {onretry} {selection} {structural} {searchable} {treeSelection} treeLevel={activeLevel}
      {emptyLabel}
      candidates={activeCandidates}
      value={controlValues}
      display={display}
      onchange={(next) => onchange({ level:activeLevel, values: next })}
    />
  {/if}
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
