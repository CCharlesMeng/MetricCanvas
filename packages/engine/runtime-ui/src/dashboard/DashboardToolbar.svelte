<script lang="ts">
  import type {
    FilterDeclaration,
    NumberRangeValue,
    TimeRangeValue
  } from '@metriccanvas/page';
  import type {
    DimensionValuesSnapshots,
    FilterValues
  } from '@metriccanvas/runtime';
  import FilterBar from '../filters/FilterBar.svelte';
  import { dashboardFilterGroups } from './filter-groups';

  type DimensionDeclaration = Extract<FilterDeclaration, { type: 'dimension' }>;

  interface Props {
    title: string;
    declarations: FilterDeclaration[];
    values: FilterValues;
    candidates: DimensionValuesSnapshots;
    ondimension: (declaration: DimensionDeclaration, values: string[], level?: string) => void;
    ontimerange: (filterId: string, range: TimeRangeValue | null) => void;
    ontimepoint: (filterId: string, granularity: 'month' | 'date', value: string | null) => void;
    onboolean: (filterId: string, checked: boolean) => void;
    onnumberrange: (filterId: string, range: NumberRangeValue | null) => void;
    onsearch: (filterId: string, query: string) => void;
    variant?: 'compact';
    readOnly?: boolean;
    note?: string;
    onback?: () => void;
  }

  let {
    title,
    declarations,
    values,
    candidates,
    ondimension,
    ontimerange,
    ontimepoint,
    onboolean,
    onnumberrange,
    onsearch,
    variant,
    readOnly = false,
    note,
    onback
  }: Props = $props();

  const filterGroups = $derived(dashboardFilterGroups(declarations, variant));
</script>

<header
  data-dashboard-toolbar
  class:compact={variant === 'compact'}
  class="dashboard-toolbar"
>
  <div class="dashboard-heading">
    {#if onback}
      <button
        type="button"
        data-dashboard-back
        class="dashboard-back"
        aria-label="返回"
        onclick={onback}
      >&lt;</button>
    {/if}
    <h1>{title}</h1>
  </div>
  <div class="dashboard-filter-area">
    <div data-dashboard-primary-filters class="primary-filters">
      <FilterBar
        declarations={filterGroups.primary}
        {values}
        {candidates}
        {ondimension}
        {ontimerange}
        {ontimepoint}
        {onboolean}
        {onnumberrange}
        {onsearch}
        {readOnly}
        {note}
      />
    </div>
    {#if filterGroups.overflow.length > 0}
      <details data-dashboard-filter-overflow class="filter-overflow">
        <summary>
          <span>更多筛选</span>
          <span data-dashboard-filter-count class="filter-count">
            {filterGroups.overflow.length}
          </span>
          <span aria-hidden="true" class="filter-overflow-arrow">▾</span>
        </summary>
        <div data-dashboard-overflow-panel class="overflow-panel">
          <FilterBar
            declarations={filterGroups.overflow}
            {values}
            {candidates}
            {ondimension}
            {ontimerange}
            {ontimepoint}
            {onboolean}
            {onnumberrange}
            {onsearch}
          />
        </div>
      </details>
    {/if}
  </div>
</header>

<style>
  .dashboard-toolbar {
    /* 工具栏始终跟随 Dashboard 宿主的可用宽度。 */
    --mc-filter-bar-flex: 1;
    --mc-filter-bar-justify-content: flex-start;
    --mc-filter-bar-gap: 16px;
    --mc-filter-bar-padding: 0;
    --mc-filter-bar-margin: 0;
    --mc-filter-bar-background: transparent;
    --mc-filter-bar-border: 0;
    --mc-filter-bar-radius: 0;

    box-sizing: border-box;
    display: grid;
    min-width: 0;
    min-height: 80px;
    grid-template-columns: minmax(204px, max-content) minmax(0, 1fr);
    align-items: center;
    gap: 40px;
    padding: 22px 32px;
    background: var(--mc-color-surface, #fff);
    border-radius: 0;
  }
  .dashboard-heading,
  .dashboard-filter-area,
  .primary-filters {
    min-width: 0;
  }
  .dashboard-heading,
  .dashboard-filter-area {
    display: flex;
    align-items: center;
  }
  .dashboard-filter-area {
    gap: 16px;
  }
  .primary-filters {
    display: flex;
    flex: 1;
  }
  h1 {
    margin: 0;
    color: var(--mc-page-title-color, #191919);
    font-size: 24px;
    font-weight: var(--mc-page-title-font-weight, 500);
    line-height: 36px;
    white-space: nowrap;
  }
  .dashboard-back {
    padding: 0;
    margin: 0 8px 0 0;
    color: #191919;
    background: transparent;
    border: 0;
    cursor: pointer;
    font: inherit;
    font-size: 20px;
    line-height: 1;
  }
  .dashboard-back:focus-visible {
    outline: 2px solid var(--mc-color-primary, #08359e);
    outline-offset: 2px;
  }
  .filter-overflow {
    position: relative;
    z-index: 70;
    flex: none;
  }
  .filter-overflow summary {
    display: inline-flex;
    box-sizing: border-box;
    height: var(--mc-filter-control-height, 34px);
    align-items: center;
    gap: 6px;
    padding: 0 12px;
    color: #191919;
    background: #fff;
    border: 1px solid var(--mc-filter-control-border-color, #c2c2c2);
    border-radius: var(--mc-filter-control-radius, 6px);
    cursor: pointer;
    font-size: var(--mc-filter-font-size, 14px);
    list-style: none;
    white-space: nowrap;
  }
  .filter-overflow summary::-webkit-details-marker {
    display: none;
  }
  .filter-overflow summary:focus-visible {
    outline: 2px solid var(--mc-color-primary, #08359e);
    outline-offset: 2px;
  }
  .filter-count {
    display: inline-flex;
    min-width: 18px;
    height: 18px;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
    color: var(--mc-color-primary, #08359e);
    background: #eef3ff;
    border-radius: 9px;
    font-size: 12px;
    line-height: 18px;
  }
  .filter-overflow-arrow {
    color: #8c8c8c;
    transition: transform 160ms ease;
  }
  .filter-overflow[open] .filter-overflow-arrow {
    transform: rotate(180deg);
  }
  .overflow-panel {
    --mc-filter-bar-flex: 0 1 auto;
    --mc-filter-bar-wrap: wrap;
    --mc-filter-bar-gap: 16px;
    --mc-filter-bar-padding: 16px;
    --mc-filter-bar-margin: 0;
    --mc-filter-bar-background: #fff;
    --mc-filter-bar-border: 0;
    --mc-filter-bar-radius: 0;

    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    box-sizing: border-box;
    width: min(760px, calc(100cqi - 48px));
    max-width: calc(100cqi - 48px);
    background: #fff;
    border: 1px solid var(--mc-color-border, #e4e4e7);
    border-radius: 8px;
    box-shadow: 0 12px 32px rgb(15 23 42 / 0.16);
  }
  .dashboard-toolbar.compact {
    --mc-filter-bar-flex: 1;
    --mc-filter-bar-gap: 12px;
    --mc-filter-bar-wrap: nowrap;
    --mc-filter-note-flex: 0 1 auto;
    --mc-filter-note-white-space: nowrap;

    position: sticky;
    z-index: 66;
    top: 0;
    display: flex;
    box-sizing: border-box;
    width: 100%;
    height: 56px;
    min-height: 56px;
    align-items: center;
    gap: 0;
    padding: 0 24px;
    background: #fff;
    border-bottom: 1px solid #e8e8e8;
  }
  .compact .dashboard-heading {
    flex: none;
    margin-right: 24px;
  }
  .compact .dashboard-filter-area {
    flex: 1;
  }
  .compact h1 {
    font-size: 18px;
    font-weight: 600;
    line-height: 24px;
  }
  @container mc-runtime (max-width: 1050px) {
    .dashboard-toolbar {
      grid-template-columns: minmax(0, 1fr);
      gap: 12px;
      padding: 18px 20px;
    }
    .dashboard-filter-area {
      align-items: flex-start;
    }
    h1 {
      white-space: normal;
    }
  }
</style>
