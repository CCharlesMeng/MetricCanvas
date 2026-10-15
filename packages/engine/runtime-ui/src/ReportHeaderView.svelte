<script lang="ts">
  import { getContext, type Snippet } from 'svelte';
  import { REPORT_PDF_CONTEXT, type ReportPdfContext } from './report-pdf-context';
  import type { ReportHeaderProps } from '@metriccanvas/page/internal';
  import { ReportHeader } from '../../widgets/src';
  let { props, period, controls, onback, exportMode = false }: {
    props: ReportHeaderProps; period?: string; controls?: Snippet<[string[]]>;
    onback?: () => void; exportMode?: boolean;
  } = $props();
  const pdf = getContext<ReportPdfContext | undefined>(REPORT_PDF_CONTEXT);
  const showDates = $derived(!!props.filterIds?.length && !!controls);
  const showPdf = $derived(!!props.pdfExport && !!pdf);
  const showToolbar = $derived(!exportMode && (showDates || showPdf));
  const rendered = $derived(period === undefined ? props : { ...props, asOf: {label:props.asOf?.label??'当前期间',value:period} });
</script>
{#if showToolbar}
  <div class="date-toolbar" data-report-date-toolbar data-report-toolbar>
    {#if showDates && controls && props.filterIds}
      <div class="controls">{@render controls(props.filterIds)}</div>
    {/if}
    {#if showPdf && pdf}
      <div class="pdf-actions">
        <button type="button" class="pdf-download" data-report-pdf-download disabled={pdf.busy} aria-busy={pdf.busy} aria-live="polite" title={pdf.error ? `导出失败：${pdf.error}` : undefined} onclick={() => pdf.download(props)}>{pdf.busy ? (pdf.message || '正在准备报告…') : pdf.error ? '下载失败，重试' : (props.pdfExport?.label?.trim() || '下载 PDF')}</button>
        {#if pdf.busy}<button type="button" data-report-pdf-cancel onclick={() => pdf.cancel()}>取消</button>{/if}
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
