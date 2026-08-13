<script lang="ts">
  import SafeMarkdown from './SafeMarkdown.svelte';
  import type { AiSummarySnapshot } from './session';

  let {
    props,
    data,
    onretry
  }: {
    props: { title?: string; variant?: 'reportInline' };
    data: AiSummarySnapshot;
    onretry: () => void;
  } = $props();
</script>

<section class:report-inline={props.variant === 'reportInline'} class="ai-summary" aria-live="polite">
  {#if props.title && props.variant !== 'reportInline'}<h3>{props.title}</h3>{/if}
  {#if props.title && props.variant === 'reportInline'}<strong class="inline-label">{props.title}：</strong>{/if}
  {#if data.status === 'loading'}
    <p class="muted">正在生成总结…</p>
  {:else if data.status === 'streaming'}
    <div class="summary-content"><SafeMarkdown content={data.text} variant={props.variant === 'reportInline' ? 'compactInline' : undefined} /></div>
    <span class="streaming" aria-label="仍在生成">●</span>
  {:else if data.status === 'ready'}
    <div class="summary-content"><SafeMarkdown content={data.text} variant={props.variant === 'reportInline' ? 'compactInline' : undefined} /></div>
  {:else if data.status === 'empty'}
    <p class="muted">暂无可用于生成总结的数据。</p>
  {:else}
    <div class="error" role="alert">
      <p>{data.error.message}</p>
      <button type="button" onclick={onretry}>重试</button>
    </div>
  {/if}
</section>

<style>
  /* 摘要块外观真源在 RuntimeView 根部的 --mc-insight-* 变量,
     与 TextBlock(insight) 共用同一组数值,这里只引用不重写。 */
  .ai-summary {
    position: relative;
    display: grid;
    gap: 0;
    min-height: 0;
    grid-template-rows: auto auto;
    padding: var(--mc-insight-padding, 15px 18px 15px 15px);
    background: var(--mc-color-surface, #fff);
    border-radius: var(--mc-insight-radius, 16px);
  }
  .ai-summary.report-inline {
    display: flex;
    min-height: 73px;
    align-items: flex-start;
    gap: 0;
    padding: 13px 16px;
    color: var(--mc-color-report-text, #191919);
    background: var(--mc-color-surface-subtle, #f1f4ff);
    border-radius: 8px;
    font-size: 16px;
    line-height: 23.5px;
  }
  .inline-label {
    flex: none;
    font: inherit;
    font-weight: 600;
    white-space: nowrap;
  }
  h3 {
    margin: var(--mc-insight-heading-margin, 0 0 15px 5px);
    color: var(--mc-color-report-heading, #121e3b);
    font-size: var(--mc-insight-heading-font-size, 20px);
    font-weight: 600;
    line-height: var(--mc-insight-heading-line-height, 25px);
    text-align: left;
  }
  p { margin: 0; }
  .muted { color: var(--mc-color-muted, #71717a); }
  .summary-content {
    display: grid;
    align-content: start;
    gap: 0;
    padding: var(--mc-insight-body-padding, 9px 27px 12px 12px);
    color: var(--mc-color-report-text, #191919);
    background: var(--mc-color-surface-subtle, #f1f4ff);
    border-radius: var(--mc-insight-body-radius, 8px);
    font-size: var(--mc-insight-body-font-size, 18px);
    font-weight: 400;
    line-height: var(--mc-insight-body-line-height, 30px);
  }
  .report-inline .summary-content {
    min-width: 0;
    flex: 1;
    display: block;
    padding: 0;
    background: transparent;
    border-radius: 0;
    font-size: inherit;
    line-height: inherit;
  }
  .streaming { color: #4f46e5; font-size: 9px; animation: pulse 900ms ease-in-out infinite alternate; }
  .error { display: flex; align-items: center; gap: 10px; color: #b42318; }
  .error button { padding: 5px 10px; color: #fff; background: #b42318; border: 0; border-radius: 5px; cursor: pointer; }
  @keyframes pulse { to { opacity: 0.25; } }
</style>
