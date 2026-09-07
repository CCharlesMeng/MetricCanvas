<script lang="ts">
  import EChart from '../../shared/EChart.svelte';
  import { normalizeProgressValue, progressRingOption } from './ring-options';

  interface Props {
    value: number;
    ringPercent?: number;
    label?: string;
  }

  let { value, ringPercent, label = '完成率' }: Props = $props();
  const normalized = $derived(normalizeProgressValue(value));
  const visibleTrackPercent = $derived(normalizeProgressValue(ringPercent ?? 100));
  const option = $derived(progressRingOption(normalized, visibleTrackPercent));
</script>

<div class="progress-ring" aria-label={`${label} ${normalized}%`}>
  <div class="chart" aria-hidden="true">
    <EChart {option} updateMode="merge" />
  </div>
  <div class="number"><span class="value">{normalized}</span><span class="percent">%</span></div>
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
