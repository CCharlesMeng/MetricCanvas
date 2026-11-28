<svelte:options css="injected" />
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { MetricCardProps, MetricCardRow, Row } from '@metriccanvas/page/internal';
  import type { MetricDataSlots } from '../../shared/component-data';
  import Skeleton from '../../shared/Skeleton.svelte';
  import { DEFAULT_NULL_TEXT } from '../../shared/value-format';
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
    onlink,
    linkHref,
    onaction
  }: Props = $props();
</script>

{#snippet heading(title: string | undefined, accessory?: Snippet<[string]>)}
  {#if title}
    {#if accessory && title.trim()}
      <h3 class="with-title-accessory"><span>{title}</span>{@render accessory(title)}</h3>
    {:else}
      <h3>{title}</h3>
    {/if}
  {/if}
{/snippet}

<div class="metric-card primary-detail">
  {@render heading(props.title, titleAccessory)}
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
  {#if props.secondaryRows || props.secondaryTitle}
    <section class="metric-panel">
      {@render heading(props.secondaryTitle)}
      {#if props.secondaryRows}
        <div class="metric-values">
          <MetricCardRows
            rows={props.secondaryRows}
            {data}
            {loading}
            {shimmer}
            showTrendArrows={props.showTrendArrows}
            {rowDefinitionTip}
            {onlink}
            {linkHref}
            {onaction}
          />
        </div>
      {:else}
        <div class="metric-values placeholder-values" aria-label={`${props.secondaryTitle ?? '指标'}数据待补充`}>
          <div class="metric-row">
            <span class="row-value">
              {#if loading}<Skeleton width="2.25em" inline {shimmer} />{:else}{DEFAULT_NULL_TEXT}{/if}
            </span>
          </div>
        </div>
      {/if}
    </section>
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
  .metric-card.primary-detail {
    box-sizing: border-box;
    display: flex;
    width: 100%;
    min-width: 0;
    align-items: stretch;
    flex-direction: column;
    height: 100%;
    flex: 1;
    justify-content: flex-start;
    gap: 0;
    background: var(--mc-metric-panel-surface, var(--mc-color-surface, #fff));
    padding: var(--mc-metric-panel-padding, 20px);
    border: var(--mc-metric-panel-border-width, 1px) solid var(--mc-metric-panel-border-color, rgb(0 0 0 / 0.1));
    border-radius: var(--mc-metric-panel-radius, 16px);
  }
  h3 {
    margin: 0 0 0.25rem;
    color: #18181b;
    font-size: 0.875rem;
    font-weight: 500;
  }
  .metric-content {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }
  .metric-values {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: 8px;
  }
  .progress-slot {
    flex: 0 0 auto;
  }
  .primary-detail > .metric-content :global(.metric-row) {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .primary-detail > .metric-content :global(.row-value) {
    color: #000;
    font-size: 28px;
    font-weight: 400;
    line-height: 34px;
  }
  .primary-detail > .metric-content :global(.changes) {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
  }
  .primary-detail > .metric-content :global(.change) {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-family: "PingFang SC", sans-serif;
    font-size: 14px;
    font-weight: 400;
  }
  .primary-detail > .metric-content :global(.change-label) {
    margin-right: 0;
    line-height: 20px;
  }
  .primary-detail > .metric-content :global(.change-value) {
    font-weight: 400;
    line-height: 17px;
  }
  .primary-detail > .metric-panel {
    box-sizing: border-box;
    width: 100%;
    min-height: 0;
    padding: 0;
    overflow: visible;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  .primary-detail > .metric-panel h3 {
    margin: 0 0 12px;
    color: var(--mc-card-title-color, var(--mc-color-text-strong, #0f1a4d));
    font-size: var(--mc-card-title-font-size, 18px);
    font-weight: var(--mc-card-title-font-weight, 400);
    line-height: var(--mc-card-title-line-height, 25px);
    text-align: left;
  }
  .primary-detail > .metric-panel .metric-values {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .primary-detail > .metric-panel :global(.metric-row) {
    display: flex;
    min-height: 0;
    align-items: baseline;
    gap: 8px;
    margin-top: 8px;
    font-family: "PingFang SC", sans-serif;
    font-style: normal;
    font-size: 14px;
    font-weight: 400;
    letter-spacing: 0;
    text-align: left;
  }
  .primary-detail > .metric-panel :global(.row-label) {
    color: rgba(0, 0, 0, 0.5);
    font-size: 14px;
    line-height: 20px;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .primary-detail > .metric-panel :global(.value-line) {
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .primary-detail > .metric-panel :global(.row-value),
  .primary-detail > .metric-panel :global(.unit) {
    color: #000;
    font-size: 14px;
    font-weight: 400;
    line-height: 17px;
  }
  .primary-detail > .metric-panel .placeholder-values .row-value {
    color: var(--mc-color-muted, #71717a);
  }
</style>
