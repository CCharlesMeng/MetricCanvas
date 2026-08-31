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
</script>

<header
  data-dashboard-toolbar
  class:compact={variant === 'compact'}
  class="dashboard-toolbar"
>
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
  <FilterBar
    {declarations}
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
  .compact h1 {
    flex: none;
    margin-right: 24px;
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
    h1 {
      white-space: normal;
    }
  }
</style>
