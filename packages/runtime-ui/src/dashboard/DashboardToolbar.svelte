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
    onsearch
  }: Props = $props();
</script>

<header data-dashboard-toolbar class="dashboard-toolbar">
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
  />
</header>

<style>
  .dashboard-toolbar {
    --mc-filter-bar-flex: 1;
    --mc-filter-bar-justify-content: flex-end;
    --mc-filter-bar-padding: 0;
    --mc-filter-bar-margin: 0;
    --mc-filter-bar-background: transparent;
    --mc-filter-bar-border: 0;
    --mc-filter-bar-radius: 0;

    box-sizing: border-box;
    display: grid;
    min-width: 0;
    min-height: 80px;
    grid-template-columns: max-content minmax(0, 1fr);
    align-items: center;
    gap: 32px;
    padding: 22px 32px;
    background: var(--mc-color-surface, #fff);
    border-radius: var(--mc-radius-section, 16px);
  }
  h1 {
    margin: 0;
    color: var(--mc-page-title-color, #191919);
    font-size: 24px;
    font-weight: var(--mc-page-title-font-weight, 500);
    line-height: 36px;
    white-space: nowrap;
  }
  @media (max-width: 1050px) {
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
