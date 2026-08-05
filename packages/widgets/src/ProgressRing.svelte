<script lang="ts">
  import EChart from './EChart.svelte';
  import { normalizeProgressValue, progressRingOption } from './progress-ring-options';

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
    width: 104px;
    height: 105px;
    flex: 0 0 104px;
    place-items: center;
  }
  .chart {
    position: absolute;
    top: 0;
    left: 6px;
    display: flex;
    width: 92px;
    height: 92px;
    pointer-events: none;
  }
  .number {
    position: absolute;
    top: 46px;
    left: 6px;
    z-index: 1;
    display: flex;
    width: 92px;
    align-items: baseline;
    justify-content: center;
    transform: translateY(-50%);
    color: #0f1a4d;
  }
  .number .value {
    font-size: 24px;
    font-weight: 300;
    line-height: 24px;
  }
  .number .percent {
    margin-left: 2px;
    font-size: 11px;
  }
  .label {
    position: absolute;
    bottom: 16px;
    left: 0;
    z-index: 1;
    width: 104px;
    color: #777;
    font-size: 16px;
    line-height: 20px;
    text-align: center;
  }
</style>
