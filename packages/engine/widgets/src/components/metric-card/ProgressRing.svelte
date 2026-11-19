<svelte:options css="injected" />
<script lang="ts">
  import type { FieldValue, ValueFormat } from '@metriccanvas/page/internal';
  import { formatValue, hasDisplayValue } from '../../shared/value-format';
  import EChart from '../../shared/EChart.svelte';
  import Skeleton from '../../shared/Skeleton.svelte';
  import MetricValueMotion from './MetricValueMotion.svelte';
  import { normalizeProgressValue, progressRingOption } from './ring-options';

  interface Props {
    value: number | undefined;
    loading?: boolean;
    animate: boolean;
    missingText?: string;
    ringPercent?: number;
    label?: string;
    format?: ValueFormat;
  }

  let { value, loading = false, animate, ringPercent, label = '完成率', missingText, format = 'percent-adaptive' }: Props = $props();
  function displayText(number: FieldValue | undefined): string {
    const text = formatValue(number, format, missingText);
    return text.endsWith('%') || !hasDisplayValue(number) ? text : `${text}%`;
  }
  const display = $derived(displayText(value));
  const normalized = $derived(value === undefined || !Number.isFinite(value) ? undefined : normalizeProgressValue(value));
  const visibleTrackPercent = $derived(normalizeProgressValue(ringPercent ?? 100));
  const option = $derived(progressRingOption(normalized ?? 0, visibleTrackPercent));
</script>

<div class="progress-ring" aria-busy={loading} aria-label={loading ? label : `${label} ${display}`}>
  <div class="chart" aria-hidden="true">
    <EChart {option} updateMode="merge" />
  </div>
  <div class="number">
    {#if loading}
      <Skeleton width="44px" inline shimmer={animate} />
    {:else}
      <MetricValueMotion {value} {format} {animate}>
        {#snippet children(visibleValue)}
          {@const text = displayText(visibleValue)}
          {@const percent = text.endsWith('%')}
          <span class="value">{percent ? text.slice(0, -1) : text}</span>
          {#if percent}<span class="percent">%</span>{/if}
        {/snippet}
      </MetricValueMotion>
    {/if}
  </div>
  <span class="label">{label}</span>
</div>

<style>
  .progress-ring {
    position: relative;
    display: grid;
    width: var(--progress-ring-size, 104px);
    height: var(--progress-ring-height, 105px);
    flex: 0 0 var(--progress-ring-size, 104px);
    place-items: center;
  }
  .chart {
    position: absolute;
    top: 0;
    left: var(--progress-ring-inset, 6px);
    display: flex;
    width: var(--progress-ring-chart-size, 92px);
    height: var(--progress-ring-chart-size, 92px);
    pointer-events: none;
  }
  .number {
    position: absolute;
    top: var(--progress-ring-number-top, 46px);
    left: var(--progress-ring-inset, 6px);
    z-index: 1;
    display: flex;
    width: var(--progress-ring-chart-size, 92px);
    align-items: baseline;
    justify-content: center;
    transform: translateY(-50%);
    color: #0f1a4d;
  }
  .number .value {
    font-size: var(--progress-ring-value-font-size, 24px);
    font-weight: 300;
    line-height: var(--progress-ring-value-line-height, 24px);
  }
  .number .percent {
    margin-left: 2px;
    font-size: var(--progress-ring-percent-font-size, 11px);
  }
  .label {
    position: absolute;
    bottom: var(--progress-ring-label-bottom, 16px);
    left: 0;
    z-index: 1;
    width: var(--progress-ring-size, 104px);
    color: #777;
    font-size: var(--progress-ring-label-font-size, 16px);
    line-height: var(--progress-ring-label-line-height, 20px);
    text-align: center;
  }
</style>
