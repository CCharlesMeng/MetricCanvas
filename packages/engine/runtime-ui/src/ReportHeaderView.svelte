<svelte:options css="injected" />
<script lang="ts">
  import { getContext, type Snippet } from 'svelte';
  import { REPORT_EXPORT_CONTEXT, reportExportButtons, type ReportExportContext } from './report-export-context';
  import type { ReportHeaderProps } from '@metriccanvas/page/internal';
  import { ReportHeader } from '../../widgets/src';
  let { props, period, controls, onback, exportMode = false }: {
    props: ReportHeaderProps; period?: string; controls?: Snippet<[string[]]>;
    onback?: () => void; exportMode?: boolean;
  } = $props();
  const exporter = getContext<ReportExportContext | undefined>(REPORT_EXPORT_CONTEXT);
  const buttons = $derived(reportExportButtons(props));
  const showDates = $derived(!!props.filterIds?.length && !!controls);
  const showToolbar = $derived(!exportMode && (showDates || (!!exporter && buttons.length > 0)));
  const rendered = $derived(period === undefined ? props : { ...props, asOf: {label:props.asOf?.label??'当前期间',value:period} });
</script>
{#if showToolbar}
  <div class="date-toolbar" data-report-date-toolbar data-report-toolbar>
    {#if showDates && controls && props.filterIds}
      <div class="controls">{@render controls(props.filterIds)}</div>
    {/if}
    {#if exporter && buttons.length}
      <div class="pdf-actions">
        {#each buttons as button}
          {@const active = exporter.active === button}
          <button type="button" data-report-pdf-download={button.format === 'pdf' ? '' : undefined} data-report-image-download={button.format === 'png' ? '' : undefined}
            disabled={exporter.busy} aria-busy={active && exporter.busy} aria-live="polite"
            title={active && exporter.error ? `导出失败：${exporter.error}` : undefined}
            onclick={() => exporter.download(props, button)}>{active && exporter.busy ? (exporter.message || '正在准备报告…') : active && exporter.error ? '导出失败，重试' : (button.label?.trim() || (button.format === 'pdf' ? '导出 PDF' : '导出图片'))}</button>
        {/each}
        {#if exporter.error && buttons.includes(exporter.active!)}<span role="alert">导出失败：{exporter.error}</span>{/if}
      </div>
    {/if}
  </div>
{/if}
<div class:with-toolbar={showToolbar} class="header-content">
  <ReportHeader props={rendered} onback={exportMode ? undefined : onback} />
</div>
<style>
  .header-content { display:contents; }
  .with-toolbar { --mc-page-content-padding-block-start:0px; }
  .date-toolbar { display:flex; flex-wrap:wrap; align-items:center; justify-content:flex-end; gap:12px; margin-inline:var(--mc-report-date-toolbar-margin-inline,0px); margin-bottom:0; padding:12px var(--mc-page-content-padding-inline,16px); border:0; border-radius:0; background:var(--mc-color-surface,#fff); }
  .controls { margin-left:auto; min-width:0; max-width:100%; --mc-filter-bar-padding:0; --mc-filter-bar-margin:0; --mc-filter-bar-border:0; --mc-filter-bar-gap:12px; --mc-filter-bar-justify-content:flex-end; --mc-filter-control-flex:0 1 auto; }
  .pdf-actions { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
  .pdf-actions button { font:inherit; font-size:14px; line-height:20px; padding:7px 15px; border:1px solid var(--mc-color-border,#d4d4d8); border-radius:var(--mc-radius-control,4px); background:#fff; color:var(--mc-color-text,#191919); cursor:pointer; }
  .pdf-actions button:disabled { opacity:.55; cursor:wait; }
  .pdf-actions button:focus-visible { outline:2px solid var(--mc-color-primary,#1476ff); outline-offset:2px; }
</style>
