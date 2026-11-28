<svelte:options css="injected" />
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { FieldBinding, MetricCardProps, MetricCardRow, Row } from '@metriccanvas/page/internal';
  import type { MetricDataSlots } from '../../shared/component-data';
  import Skeleton from '../../shared/Skeleton.svelte';
  import {
    formatMetricFieldText,
    resolveMetricChangeDisplay,
    resolveMetricRowRecord,
    resolveMetricValueDisplay,
    resolveRowDefinitionCode
  } from './metric-card-model';

  interface Props {
    rows: MetricCardProps['rows'];
    data: MetricDataSlots;
    loading?: boolean;
    shimmer?: boolean;
    showTrendArrows?: boolean;
    accessory?: Snippet<[string]>;
    rowDefinitionTip?: Snippet<[title: string, code: string]>;
    onlink?: (row: Row, event: MouseEvent) => void;
    linkHref?: (row: Row) => string | undefined;
    onaction?: (action: NonNullable<MetricCardRow['action']>) => void;
  }

  let {
    rows,
    data,
    loading = false,
    shimmer = true,
    showTrendArrows = false,
    accessory,
    rowDefinitionTip,
    onlink,
    linkHref,
    onaction
  }: Props = $props();

  function activateLink(field: FieldBinding, event: MouseEvent) {
    const row = resolveMetricRowRecord(field, data);
    if (row) onlink?.(row, event);
  }

  function handleLinkKeydown(field: FieldBinding, event: KeyboardEvent & { currentTarget: HTMLAnchorElement }) {
    if (!linkHref?.(resolveMetricRowRecord(field, data) ?? {}) && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      event.currentTarget.click();
    }
  }
</script>

{#snippet loadingValue()}
  <Skeleton width="2.25em" inline {shimmer} />
{/snippet}

{#snippet metricValue(row: MetricCardRow, display: ReturnType<typeof resolveMetricValueDisplay>)}
  {#if row.context}<span class="row-context">{row.context}</span>{/if}
  <span class="row-value" style:color={display.colorStyle}>
    {#if display.pending}
      {@render loadingValue()}
    {:else}
      {display.text}
    {/if}
  </span>
  {#if !display.pending && display.unit}<span class="unit">{display.unit}</span>{/if}
{/snippet}

{#each rows as row, index (`${row.label}:${index}`)}
  {@const display = resolveMetricValueDisplay(row, data, loading)}
  {@const action = row.action}
  {@const code = resolveRowDefinitionCode(row, data, rowDefinitionTip !== undefined)}
  {@const rowRecord = resolveMetricRowRecord(row.valueField, data) ?? {}}
  {@const href = linkHref?.(rowRecord)}
  <div class="metric-row">
    <span class="row-label" class:with-title-accessory={accessory !== undefined || code !== undefined}>
      {#if code}
        <span>{row.label}</span>{@render rowDefinitionTip?.(row.label, code)}
      {:else}
        {row.label}{@render accessory?.(row.label)}
      {/if}
    </span>
    {#if !display.pending && display.raw != null && action && onaction}
      <button
        type="button"
        class="value-line value-link"
        data-metric-row-action
        aria-label={`${row.label} ${formatMetricFieldText(row.valueField, data, row.unit)}`}
        onclick={() => onaction?.(action)}
      >
        {@render metricValue(row, display)}
      </button>
    {:else if !display.pending && row.link === true && display.raw != null && linkHref}
      <a
        {href}
        role={href ? undefined : 'button'}
        tabindex={href ? undefined : 0}
        onkeydown={(event) => handleLinkKeydown(row.valueField, event)}
        class="value-line value-link"
        data-metric-row-link
        aria-label={`${row.label} ${formatMetricFieldText(row.valueField, data, row.unit)}`}
        onclick={(event) => activateLink(row.valueField, event)}
      >
        {@render metricValue(row, display)}
      </a>
    {:else}
      <span class="value-line">{@render metricValue(row, display)}</span>
    {/if}
    {#if row.changes?.length}
      <div class="changes">
        {#each row.changes as change, changeIndex (`${change.label}:${changeIndex}`)}
          {@const item = resolveMetricChangeDisplay(change, data, loading, showTrendArrows)}
          <span class:positive={item.color === 'green'} class:negative={item.color === 'red'} class="change">
            <span class="change-label">{item.label}</span>
            <span class="change-value" style:color={item.colorStyle}>
              {#if item.showTrendArrow}
                <span
                  class:up={item.direction === 'positive'}
                  class:down={item.direction === 'negative'}
                  class="trend-arrow"
                  aria-hidden="true"
                >{item.direction === 'positive' ? '↑' : '↓'}</span>
              {/if}
              {#if item.pending}
                {@render loadingValue()}
              {:else}
                <span>{item.text}{#if item.unit}<span class="change-unit">{item.unit}</span>{/if}</span>
              {/if}
            </span>
          </span>
        {/each}
      </div>
    {/if}
  </div>
{/each}

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
  .row-label.with-title-accessory {
    display: inline-flex;
  }
  .metric-row {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.4rem;
    min-width: 0;
  }
  .change-unit {
    margin-left: 2px;
    color: inherit;
  }
  .value-line {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
  }
  .value-link {
    width: fit-content;
    padding: 0;
    color: inherit;
    background: transparent;
    border: 0;
    cursor: pointer;
    font: inherit;
    text-align: left;
    text-decoration: none;
  }
  .value-link .row-value {
    text-decoration-line: underline;
  }
  .value-link:focus-visible {
    outline: 2px solid var(--mc-color-primary, #08359e);
    outline-offset: 2px;
    border-radius: 4px;
  }
  .row-label {
    color: #595959;
    font-size: 0.875rem;
  }
  .row-value {
    color: #0f1a4d;
    font-size: 1.625rem;
    font-weight: 400;
    line-height: 1.35;
    font-variant-numeric: tabular-nums;
  }
  .unit {
    color: #0f1a4d;
    font-size: 14px;
    font-weight: 500;
  }
  .changes {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .change {
    color: #71717a;
    font-size: 0.875rem;
    font-variant-numeric: tabular-nums;
  }
  .change-label {
    margin-right: 0.2rem;
  }
  .change-value {
    display: inline-flex;
    align-items: baseline;
    gap: 2px;
  }
  .trend-arrow {
    font-size: 0.9em;
    font-weight: 700;
    line-height: 1;
  }
  .change.positive .change-value {
    color: var(--mc-color-positive, #5cb300);
  }
  .change.negative .change-value {
    color: var(--mc-color-negative, #f21e1e);
  }
</style>
