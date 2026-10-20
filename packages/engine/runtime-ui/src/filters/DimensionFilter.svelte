<svelte:options css="injected" />
<script lang="ts">
  import { Selection, type UiTreeOption, type TreeSelection } from '@metriccanvas/ui';
  import type { DimensionValuesSnapshot } from '../../../runtime/src';
  import { buildFilterTree, type FilterTreeNode } from './tree';
  let {label, emptyLabel = '全部', candidates, value, display = 'select', selection = 'multiple', searchable = true, treeSelection = 'descendants', disabled = false, onchange}:
    {label?: string; emptyLabel?: string; candidates: DimensionValuesSnapshot; value: string[];
     display?: 'select'|'tabs'|'tree'|'search'; selection?: 'single'|'multiple'; searchable?: boolean;
     treeSelection?: TreeSelection; disabled?: boolean; onchange: (values:string[]) => void} = $props();
  const options = $derived(candidates.status === 'ready' ? candidates.candidates : []);
  function toUi(node: FilterTreeNode): UiTreeOption {
    return {value: node.value ?? `structure:${node.path}`, label: node.label, selectable: node.value !== null, children: node.children.length ? node.children.map(toUi) : undefined};
  }
  const treeResult = $derived.by(() => {
    if (display !== 'tree') return {options, error:false};
    try {return {options:buildFilterTree(options).map(toUi), error:false};}
    catch {return {options:[], error:true};}
  });
  const statusText = $derived(treeResult.error ? '候选层级无效' :
    candidates.status === 'idle' || candidates.status === 'loading' ? '候选项加载中…' :
    candidates.status === 'empty' ? '无候选项' : candidates.status === 'unavailable' ? '候选项不可用' :
    candidates.status === 'error' ? `候选项加载失败(${candidates.error.code})` : undefined);
</script>
<div class="filter">
  {#if label}<span class="label">{label}</span>{/if}
  {#if display === 'tabs'}
    <div class="tabs" role="tablist" aria-label={label ?? '维度筛选'}>
      <button type="button" role="tab" class="tab" class:active={!value.length} aria-selected={!value.length} {disabled} onclick={() => onchange([])}>{emptyLabel}</button>
      {#each options as option (option.value)}<button type="button" role="tab" class="tab" class:active={value.includes(option.value)} aria-selected={value.includes(option.value)} {disabled} onclick={() => onchange([option.value])}>{option.label}</button>{/each}
    </div>
    {#if statusText}<span role={candidates.status === 'error' ? 'alert' : 'status'} data-candidates-status={candidates.status}>{statusText}</span>{/if}
  {:else}
    <div class="dropdown" data-candidates-status={candidates.status}>
      <Selection label={label ?? '维度筛选'} options={treeResult.options} {value} tree={display === 'tree'} multiple={selection !== 'single'} {searchable} {treeSelection} {disabled} clearable placeholder={emptyLabel} {statusText} statusError={treeResult.error || candidates.status === 'error'} {onchange}/>
    </div>
  {/if}
</div>
<style>
  .filter{display:flex;align-items:center;gap:8px;font-size:var(--mc-filter-font-size,13px);min-width:0;max-width:100%}
  .label{display:var(--mc-filter-label-display,inline);color:#71717a;white-space:nowrap}
  .dropdown{width:var(--mc-filter-select-width,240px);max-width:100%;min-width:0}
  .tabs{display:flex;background:#f4f4f5;border-radius:8px;padding:2px;gap:2px}
  .tab{border:0;background:transparent;padding:5px 12px;border-radius:6px;font-size:var(--mc-filter-font-size,13px);color:#52525b;cursor:pointer}
  .tab.active{background:#fff;color:#18181b;font-weight:var(--mc-tab-active-font-weight,600);box-shadow:0 1px 2px rgb(0 0 0 / .08)}
</style>
