<svelte:options css="injected" />
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { MetricCardProps, MetricCardRow, Row } from '@metriccanvas/page/internal';
  import type { MetricDataSlots } from '../../shared/component-data';
  import MetricCardRows from './MetricCardRows.svelte';
  import type { MetricProgressDisplay } from './metric-card-model';
  import ProgressRing from './ProgressRing.svelte';

  interface Props {
    data: MetricDataSlots;
    props: MetricCardProps;
    loading?: boolean;
    shimmer?: boolean;
    titleAccessory?: Snippet<[string]>;
    rowAccessory?: Snippet<[string]>;
    rowDefinitionTip?: Snippet<[title: string, code: string]>;
    progress?: MetricProgressDisplay;
    secondaryPanel?: Snippet;
    onlink?: (row: Row, event: MouseEvent) => void;
    linkHref?: (row: Row) => string | undefined;
    onaction?: (action: NonNullable<MetricCardRow['action']>) => void;
  }

  let {
    data,
    props,
    loading = false,
    shimmer = true,
    titleAccessory,
    rowAccessory,
    rowDefinitionTip,
    progress,
    secondaryPanel,
    onlink,
    linkHref,
    onaction
  }: Props = $props();
</script>

<div class="metric-card summary">
  {#if props.title}
    {#if titleAccessory && props.title.trim()}
      <h3 class="with-title-accessory"><span>{props.title}</span>{@render titleAccessory(props.title)}</h3>
    {:else}
      <h3>{props.title}</h3>
    {/if}
  {/if}
  <div class="metric-content">
    <div class="metric-values">
      <MetricCardRows
        rows={props.rows}
        {data}
        {loading}
        {shimmer}
        showTrendArrows={props.showTrendArrows}
        accessory={rowAccessory}
        {rowDefinitionTip}
        {onlink}
        {linkHref}
        {onaction}
      />
    </div>
    {#if progress}
      <div class="progress-slot">
        <ProgressRing
          loading={progress.loading}
          {shimmer}
          format={progress.format}
          value={progress.value}
          missingText={progress.missingText}
          ringPercent={progress.ringPercent}
          label={progress.label}
        />
      </div>
    {/if}
  </div>
  {#if secondaryPanel}
    {@render secondaryPanel()}
  {/if}
</div>

<style>
  .with-title-accessory {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .with-title-accessory span {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .metric-card.summary {
    box-sizing: border-box;
    display: flex;
    width: 100%;
    min-width: 0;
    align-items: stretch;
    justify-content: flex-start;
    flex-direction: column;
    gap: 0;
    height: 100%;
    min-height: 200px;
    padding: var(--mc-metric-card-padding, 0);
    border: var(--mc-metric-card-border, 0);
    border-radius: var(--mc-metric-card-radius, 0);
    background-color: transparent;
    background-image: var(--mc-section-gradient, none);
    background-repeat: no-repeat;
    background-position: center;
    background-size: 100% 100%;
    text-align: left;
    container-type: inline-size;
  }
  .summary .metric-content {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    width: 100%;
    height: 128px;
    padding: 15px 0 13px 12px;
    background: var(--mc-color-surface, #fff);
    border-radius: 12px;
  }
  .summary .metric-values {
    display: flex;
    min-width: 0;
    flex: 1;
    width: 100%;
    flex-direction: row;
    gap: 0;
    padding-right: 12px;
  }
  .progress-slot {
    flex: 0 0 auto;
  }
  .summary :global(.metric-row) {
    min-width: 0;
    flex: 1;
    align-items: flex-start;
    justify-content: flex-start;
    flex-direction: column;
    flex-wrap: nowrap;
    gap: 0;
    height: 100px;
    margin-right: 12px;
    padding: 14px 0 9px 13px;
    background: var(--mc-color-surface-subtle, #f1f4ff);
    border-radius: 8px;
  }
  .summary :global(.metric-row:last-child) {
    margin-right: 0;
  }
  .summary h3 {
    margin: 0 0 7px;
    color: var(--mc-color-primary, #08359e);
    font-size: 24px;
    font-weight: 600;
    line-height: 38px;
    text-align: center;
  }
  .summary :global(.row-label) {
    color: #0f1a4d;
    font-size: 18px;
    font-weight: 400;
    line-height: 25px;
    margin-bottom: 9px;
  }
  .summary :global(.value-line) {
    align-items: baseline;
    flex-direction: row;
    gap: 0;
    white-space: nowrap;
  }
  .summary :global(.row-value) {
    font-size: 26px;
    font-weight: 500;
    line-height: 43px;
  }
  .summary :global(.unit) {
    font-size: 18px;
    font-weight: 500;
    line-height: 43px;
  }
  /* responsive-contract: metric-summary-local-comfortable */
  @container (max-width: 275px) {
    .summary .metric-content {
      padding-left: 7px;
      padding-right: 7px;
    }
    .summary .metric-values {
      padding-right: 0;
    }
    .summary :global(.metric-row) {
      margin-right: 6px;
      padding-left: 8px;
    }
    .summary :global(.row-label) {
      font-size: 15px;
    }
    .summary :global(.row-value) {
      font-size: 21px;
    }
    .summary :global(.unit),
    .summary :global(.change) {
      font-size: 13px;
    }
    .summary :global(.changes) {
      min-width: 0;
      max-width: 100%;
      gap: 0;
    }
    .summary :global(.change) {
      max-width: 100%;
      overflow-wrap: anywhere;
      white-space: normal;
    }
  }
  /* responsive-contract: metric-summary-local-tight */
  @container (max-width: 235px) {
    .summary .metric-content {
      padding-right: 4px;
      padding-left: 4px;
    }
    .summary :global(.metric-row) {
      margin-right: 4px;
      padding-left: 4px;
    }
    .summary :global(.row-value) {
      font-size: 18px;
    }
    .summary :global(.unit),
    .summary :global(.change) {
      font-size: 12px;
    }
  }
</style>
