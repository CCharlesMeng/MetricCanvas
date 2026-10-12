<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ReportHeaderProps } from '@metriccanvas/page/internal';
  import { ReportHeader } from '../../widgets/src';
  let { props, period, controls, onback, exportMode = false }: {
    props: ReportHeaderProps; period?: string; controls?: Snippet<[string[]]>;
    onback?: () => void; exportMode?: boolean;
  } = $props();
  const rendered = $derived(period === undefined ? props : { ...props, asOf: {label:props.asOf?.label??'当前期间',value:period} });
</script>
{#if props.filterIds?.length && !exportMode && controls}
  <div class="date-toolbar" data-report-date-toolbar>
    <div class="controls">{@render controls(props.filterIds)}</div>
  </div>
{/if}
<div class:with-toolbar={!!props.filterIds?.length && !exportMode && !!controls} class="header-content">
  <ReportHeader props={rendered} onback={exportMode ? undefined : onback} />
</div>
<style>
  .header-content { display:contents; }
  .with-toolbar { --mc-page-content-padding-block-start:0px; }
  .date-toolbar { display:flex; flex-wrap:wrap; align-items:center; justify-content:flex-end; gap:12px; margin-inline:var(--mc-report-date-toolbar-margin-inline,0px); margin-bottom:0; padding:12px var(--mc-page-content-padding-inline,16px); border:0; border-radius:0; background:var(--mc-color-surface,#fff); }
  .controls { margin-left:auto; min-width:0; max-width:100%; --mc-filter-bar-padding:0; --mc-filter-bar-margin:0; --mc-filter-bar-border:0; --mc-filter-bar-gap:12px; --mc-filter-bar-justify-content:flex-end; --mc-filter-control-flex:0 1 auto; }
</style>
