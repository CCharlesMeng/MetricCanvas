<script lang="ts">
  import EChart from './EChart.svelte';
  import { normalizeProgressValue, progressRingOption } from './progress-ring-options';

  interface Props {
    value: number;
    visualValue?: number;
    label?: string;
  }

  let { value, visualValue, label = '完成率' }: Props = $props();
  const normalized = $derived(normalizeProgressValue(value));
  const visualProgress = $derived(normalizeProgressValue(visualValue ?? normalized));
  const option = $derived(progressRingOption(visualProgress));
</script>

<div class="progress-ring" aria-label={`${label} ${normalized}%`}>
  <div class="chart" aria-hidden="true">
    <EChart {option} updateMode="merge" />
  </div>
  <div class="number"><strong>{normalized}</strong><span>%</span></div>
  <span class="label">{label}</span>
</div>

<style>
  .progress-ring {
    position: relative;
    display: grid;
    width: 84px;
    height: 83px;
    flex: 0 0 84px;
    place-items: center;
  }
  .chart {
    position: absolute;
    top: 0;
    left: 6px;
    display: flex;
    width: 72px;
    height: 72px;
    pointer-events: none;
  }
  .number {
    position: absolute;
    top: 28px;
    left: 0;
    z-index: 1;
    display: flex;
    width: 84px;
    align-items: baseline;
    justify-content: center;
    color: #0f1a4d;
  }
  .number strong {
    font-size: 24px;
    font-weight: 500;
    line-height: 24px;
  }
  .number span {
    margin-left: 2px;
    font-size: 11px;
  }
  .label {
    position: absolute;
    bottom: 0;
    left: 0;
    z-index: 1;
    width: 84px;
    color: #777;
    font-size: 16px;
    line-height: 20px;
    text-align: center;
  }
</style>
