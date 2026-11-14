<svelte:options css="injected" />
<script lang="ts">
  import { Button } from '@metriccanvas/ui';
  import ReportSummary from '../../../../widgets/src/shared/ReportSummary.svelte';
  import { getContext } from 'svelte';
  import { STATIC_EXPORT_CONTEXT } from '../../../../widgets/src/shared/export-context';
  const staticExport = Boolean(getContext(STATIC_EXPORT_CONTEXT));
  import TextBlock from '../../../../widgets/src/components/text/TextBlock.svelte';
  import type { AiSummarySnapshot } from '../types';

  let { props, data, onretry }: {
    props: { title?: string; variant?: 'reportInline' };
    data: AiSummarySnapshot;
    onretry: () => void;
  } = $props();

  const loading = $derived(!staticExport && data.status === 'loading');
  const body = $derived(summaryBody(data));
  const format = $derived(data.status === 'ready' ? data.format : undefined);

  function summaryBody(snapshot: AiSummarySnapshot): string {
    switch (snapshot.status) {
      case 'ready': return snapshot.text;
      case 'loading': return '';
      case 'empty': return '当前条件的分析摘要尚未生成。';
      case 'error': return snapshot.error.message;
    }
  }
</script>

<div class="ai-summary" aria-live="polite" aria-busy={loading} role={data.status === 'error' ? 'alert' : undefined} data-summary-format={format ?? 'text'}>
  {#if props.variant === 'reportInline'}
    <TextBlock {loading} props={{ title: props.title, variant: 'reportInline', body, bodyFormat: format === 'semanticHtml' ? format : undefined }} />
    {#if data.status === 'error'}<Button onclick={onretry}>重试</Button>{/if}
  {:else}
    <ReportSummary {loading} title={props.title} {body} {format}>
      {#snippet actions()}
        {#if data.status === 'error'}<Button onclick={onretry}>重试</Button>{/if}
      {/snippet}
    </ReportSummary>
  {/if}
</div>

<style>
  .ai-summary { position: relative; width: 100%; min-width: 0; min-height: 112px; }
</style>
