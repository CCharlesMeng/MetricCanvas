<script lang="ts">
  /**
   * 筛选栏:页面筛选器声明 → 对应控件的唯一分发点。
   *
   * 从 RuntimeView 抽出,使新增筛选器类型只改这一个文件加一个控件,
   * 不再与组件分发、参数水合、表格交互挤在同一份源文件里。
   * 本身零状态:当前值与候选值由运行时传入,变更只上抛。
   */
  import type {
    FilterDeclaration,
    NumberRangeValue,
    TimeRangeValue
  } from '@metriccanvas/page';
  import {
    dimensionValuesSnapshot,
    type DimensionValuesSnapshots,
    type FilterValues
  } from '@metriccanvas/runtime';
  import DimensionFilter from './DimensionFilter.svelte';
  import HierarchyFilter from './HierarchyFilter.svelte';
  import TimeRangeFilter from './TimeRangeFilter.svelte';
  import TimePointFilter from './TimePointFilter.svelte';
  import BooleanFilter from './BooleanFilter.svelte';
  import NumberRangeFilter from './NumberRangeFilter.svelte';
  import SearchFilter from './SearchFilter.svelte';
  import { dimensionValueOf } from './cascade';
  import { visibleFilterDeclarations } from './filter-bar';

  type DimensionDeclaration = Extract<FilterDeclaration, { type: 'dimension' }>;

  interface Props {
    declarations: FilterDeclaration[];
    values: FilterValues;
    candidates: DimensionValuesSnapshots;
    ondimension: (declaration: DimensionDeclaration, values: string[], level?: string) => void;
    ontimerange: (filterId: string, range: TimeRangeValue | null) => void;
    ontimepoint: (filterId: string, granularity: 'month' | 'date', value: string | null) => void;
    onboolean: (filterId: string, checked: boolean) => void;
    onnumberrange: (filterId: string, range: NumberRangeValue | null) => void;
    onsearch: (filterId: string, query: string) => void;
    /** 保留筛选信息架构但不建立可变状态。 */
    readOnly?: boolean;
    note?: string;
  }

  let {
    declarations,
    values,
    candidates,
    ondimension,
    ontimerange,
    ontimepoint,
    onboolean,
    onnumberrange,
    onsearch,
    readOnly = false,
    note
  }: Props = $props();

  const visible = $derived(visibleFilterDeclarations(declarations));

  function timeRangeValue(filterId: string): TimeRangeValue | null {
    const value = values.get(filterId);
    return value?.type === 'timeRange' ? { from: value.from, to: value.to } : null;
  }

  function timePointValue(filterId: string): string | null {
    const value = values.get(filterId);
    return value?.type === 'timePoint' ? value.value : null;
  }

  function booleanValue(filterId: string): boolean {
    const value = values.get(filterId);
    return value?.type === 'boolean' && value.value;
  }

  function numberRangeValue(filterId: string): NumberRangeValue {
    const value = values.get(filterId);
    return value?.type === 'numberRange' ? { from: value.from, to: value.to } : {};
  }

  function searchValue(filterId: string): string {
    const value = values.get(filterId);
    return value?.type === 'search' ? value.query : '';
  }

  function currentDimension(declaration: DimensionDeclaration): string {
    const current = dimensionValueOf(values, declaration.id);
    if (declaration.hierarchy) {
      const level =
        declaration.hierarchy.find((item) => item.id === current.level) ?? declaration.hierarchy[0];
      return level?.dimension ?? declaration.dimension;
    }
    return declaration.dimension;
  }

  function dimensionDisplay(declaration: DimensionDeclaration): string {
    return dimensionValueOf(values, declaration.id).values[0] ?? declaration.emptyLabel ?? declaration.label ?? '全部';
  }
</script>

<div class:read-only={readOnly} class="filter-bar">
  {#each visible as declaration (declaration.id)}
    <div data-filter-control class="filter-control">
    {#if readOnly && declaration.type === 'boolean'}
      <label class="readonly-boolean">
        <input type="checkbox" checked={booleanValue(declaration.id)} disabled />
        <span data-filter-display>{declaration.label ?? '布尔筛选'}</span>
      </label>
    {:else if readOnly && declaration.type === 'timePoint'}
      <input
        class="readonly-date"
        type={declaration.granularity === 'month' ? 'month' : 'date'}
        value={timePointValue(declaration.id) ?? ''}
        aria-label={declaration.label ?? '日期'}
        disabled
      />
    {:else if readOnly && declaration.type === 'dimension'}
      <button type="button" class="readonly-select" aria-label={declaration.label} disabled>
        <span data-filter-display>{dimensionDisplay(declaration)}</span>
        <span aria-hidden="true" class="readonly-arrow">▾</span>
      </button>
    {:else if readOnly}
      <button type="button" class="readonly-select" aria-label={declaration.label} disabled>
        <span data-filter-display>{declaration.label ?? '筛选'}</span>
      </button>
    {:else if declaration.type === 'dimension' && declaration.hierarchy}
      {@const current = dimensionValueOf(values, declaration.id)}
      <HierarchyFilter
        label={declaration.label}
        emptyLabel={declaration.emptyLabel}
        levels={declaration.hierarchy}
        level={current.level ?? declaration.defaultLevel ?? declaration.hierarchy[0]!.id}
        values={current.values}
        picker={declaration.hierarchyPicker ?? 'tabs'}
        display={declaration.display ?? 'select'}
        candidates={dimensionValuesSnapshot(candidates, currentDimension(declaration))}
        onchange={(next) => ondimension(declaration, next.values, next.level)}
      />
    {:else if declaration.type === 'dimension'}
      <DimensionFilter
        label={declaration.label}
        emptyLabel={declaration.emptyLabel}
        candidates={dimensionValuesSnapshot(candidates, declaration.dimension)}
        value={dimensionValueOf(values, declaration.id).values}
        display={declaration.display ?? 'select'}
        onchange={(next) => ondimension(declaration, next)}
      />
    {:else if declaration.type === 'timeRange'}
      <TimeRangeFilter
        label={declaration.label}
        precision={declaration.precision ?? 'date'}
        value={timeRangeValue(declaration.id)}
        onchange={(range) => ontimerange(declaration.id, range)}
      />
    {:else if declaration.type === 'timePoint'}
      <TimePointFilter
        label={declaration.label}
        granularity={declaration.granularity}
        value={timePointValue(declaration.id)}
        onchange={(value) => ontimepoint(declaration.id, declaration.granularity, value)}
      />
    {:else if declaration.type === 'boolean'}
      <BooleanFilter
        label={declaration.label}
        value={booleanValue(declaration.id)}
        onchange={(checked) => onboolean(declaration.id, checked)}
      />
    {:else if declaration.type === 'numberRange'}
      {@const range = numberRangeValue(declaration.id)}
      <NumberRangeFilter
        label={declaration.label}
        from={range.from}
        to={range.to}
        onchange={(next) => onnumberrange(declaration.id, next)}
      />
    {:else}
      <SearchFilter
        label={declaration.label}
        value={searchValue(declaration.id)}
        onchange={(query) => onsearch(declaration.id, query)}
      />
    {/if}
    </div>
  {/each}
  {#if note}<p class="filter-note">{note}</p>{/if}
</div>

<style>
  .filter-bar {
    display: flex;
    flex: var(--mc-filter-bar-flex, 0 1 auto);
    flex-wrap: var(--mc-filter-bar-wrap, wrap);
    align-items: center;
    justify-content: var(--mc-filter-bar-justify-content, normal);
    gap: var(--mc-filter-bar-gap, 20px);
    padding: var(--mc-filter-bar-padding, 12px 16px);
    margin: var(--mc-filter-bar-margin, 0 0 18px);
    background: var(--mc-filter-bar-background, var(--mc-color-surface));
    border: var(--mc-filter-bar-border, 1px solid var(--mc-color-border));
    border-radius: var(--mc-filter-bar-radius, var(--mc-radius-cell));
  }
  .filter-control {
    flex: none;
  }
  .readonly-boolean {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #191919;
    font-size: 14px;
    white-space: nowrap;
  }
  .readonly-date,
  .readonly-select {
    box-sizing: border-box;
    height: 32px;
    padding: 0 10px;
    color: #595959;
    background: #fff;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    font: inherit;
    font-size: 14px;
  }
  .readonly-select {
    display: inline-flex;
    min-width: 112px;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .readonly-date:disabled,
  .readonly-select:disabled,
  .readonly-boolean input:disabled {
    cursor: not-allowed;
    opacity: 1;
  }
  .readonly-arrow {
    color: #8c8c8c;
  }
  .filter-note {
    flex: var(--mc-filter-note-flex, 1 0 100%);
    margin: 0;
    color: #8c8c8c;
    font-size: 12px;
    line-height: 18px;
    white-space: var(--mc-filter-note-white-space, normal);
  }
</style>
