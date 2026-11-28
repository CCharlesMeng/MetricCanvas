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

<div class="metric-card activity-progress">
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
  .metric-card.activity-progress {
    position: relative;
    box-sizing: border-box;
    display: flex;
    width: 100%;
    min-width: 0;
    align-items: stretch;
    justify-content: flex-start;
    flex-direction: column;
    gap: 0;
    height: 100%;
    min-height: 164px;
    padding: var(--mc-metric-card-padding, 0);
    border: var(--mc-metric-card-border, 0);
    border-radius: var(--mc-metric-card-radius, 0);
    background: var(--mc-color-surface, #fff);
    container-type: inline-size;
  }
  .activity-progress h3 {
    margin: 0 0 1px;
    color: #0f1a4d;
    font-size: 18px;
    font-weight: 400;
    line-height: 25px;
  }
  .activity-progress .metric-content {
    display: flex;
    min-width: 0;
    width: 100%;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0;
    margin-top: 26px;
    padding-right: calc(clamp(44px, 16.715%, 59px) - 6px);
  }
  .activity-progress .metric-values {
    display: flex;
    min-width: 0;
    flex: 0 0 125px;
    flex-direction: column;
    gap: 0;
  }
  .activity-progress .progress-slot {
    flex: 0 0 auto;
    transform: none;
  }
  .activity-progress :global(.metric-row) {
    align-items: flex-start;
    flex-direction: column;
    flex-wrap: nowrap;
    gap: 0;
  }
  .activity-progress :global(.row-label) {
    position: absolute;
    top: 17px;
    left: 17px;
    color: #0f1a4d;
    font-size: 18px;
    font-weight: 400;
    line-height: 25px;
    white-space: nowrap;
  }
  .activity-progress :global(.value-line) {
    margin: 17px 0 5px;
    gap: 0;
  }
  .activity-progress :global(.row-value) {
    font-size: 26px;
    font-weight: 500;
    line-height: 43px;
  }
  .activity-progress :global(.unit) {
    font-size: 18px;
    font-weight: 500;
    line-height: 43px;
  }
  .activity-progress :global(.changes) {
    gap: 0;
    line-height: 22px;
  }
  .activity-progress :global(.change) {
    font-size: 18px;
    line-height: 22px;
    white-space: nowrap;
  }
  .activity-progress :global(.change-label) {
    margin-right: 4px;
    color: #0f1a4d;
  }
  /* responsive-contract: metric-activity-progress-local-tight */
  @container (max-width: 260px) {
    .activity-progress .metric-content {
      padding-right: 4px;
    }
    .activity-progress .metric-values {
      flex-basis: 88px;
    }
    .activity-progress :global(.row-value) {
      font-size: 22px;
      line-height: 36px;
    }
    .activity-progress :global(.unit),
    .activity-progress :global(.change) {
      font-size: 13px;
      line-height: 18px;
    }
    .activity-progress .progress-slot {
      --progress-ring-size: 80px;
      --progress-ring-height: 81px;
      --progress-ring-chart-size: 70px;
      --progress-ring-inset: 5px;
      --progress-ring-number-top: 35px;
      --progress-ring-value-font-size: 20px;
      --progress-ring-value-line-height: 20px;
      --progress-ring-percent-font-size: 9px;
      --progress-ring-label-bottom: 12px;
      --progress-ring-label-font-size: 13px;
      --progress-ring-label-line-height: 17px;
    }
  }
</style>
