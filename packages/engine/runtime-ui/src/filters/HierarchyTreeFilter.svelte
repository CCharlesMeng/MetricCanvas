<svelte:options css="injected" />
<script lang="ts">
  import { Selection, type TreeSelection } from '@metriccanvas/ui';
  import type { DimensionValuesSnapshot } from '../../../runtime/src';
  import type { FilterHierarchyLevel } from '@metriccanvas/page/internal';
  import { hierarchyNodeKey, hierarchyTreeOptions, hierarchyTreeSelection, hierarchyTreeSnapshot, hierarchyTreeStatus } from './hierarchy-tree';

  let { label = '维度筛选', emptyLabel = '全部', levels, level, values, receipts, structural = true, treeSelection = 'independent', required = false, searchable = true, onretry, onchange }: {
    label?: string; emptyLabel?: string; levels: FilterHierarchyLevel[]; level: string; values: string[];
    receipts: Record<string, DimensionValuesSnapshot>; structural?: boolean; treeSelection?: TreeSelection; required?: boolean; searchable?: boolean;
    onretry?: () => void; onchange: (next: { level: string; values: string[] }) => void;
  } = $props();

  const snapshot = $derived(hierarchyTreeSnapshot(levels, receipts, structural));
  const options = $derived(hierarchyTreeOptions(snapshot, level, values, structural ? undefined : levels));
  const controlValues = $derived(values.map(value => hierarchyNodeKey(level, value)));
  function commit(keys: string[]) {
    if (required && !keys.length) return;
    const next = hierarchyTreeSelection(snapshot, keys, level);
    if (next) onchange(next);
  }
</script>

<div class="dropdown" data-candidates-status={snapshot.status}>
  <Selection {label} {options} value={controlValues} multiple={false} tree {treeSelection}
    {searchable} {required} clearable={!required} placeholder={emptyLabel}
    statusText={hierarchyTreeStatus(snapshot)} statusError={snapshot.status === 'error'} {onretry} onchange={commit}/>
</div>

<style>
  .dropdown{width:var(--mc-filter-select-width,240px);max-width:100%;min-width:0}
</style>
