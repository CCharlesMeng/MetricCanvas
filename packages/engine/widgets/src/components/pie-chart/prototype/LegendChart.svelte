<script lang="ts">
  import EChart from '../../../shared/EChart.svelte';
  import { makeOption, type CustomerBand, type Settings } from './model';
  let { rows, settings }: { rows: CustomerBand[]; settings: Settings } = $props();
  let width = $state(760);
  const option = $derived(makeOption(width, settings, rows));
</script>

<div class="legend-chart" bind:clientWidth={width} class:stacked={width < 620}
  role="img" aria-label={`框架执行率分布区间的客户数及占比。${rows.map(row => `${row.name}：${row.count}户，${row.share}%`).join('；')}`}>
  <EChart {option} />
</div>

<style>
  .legend-chart { display: flex; width: 100%; height: 340px; min-width: 0; }
  .stacked { height: 450px; }
</style>
