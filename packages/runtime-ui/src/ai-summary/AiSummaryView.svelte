<script lang="ts">
  import { SafeMarkdown } from '@metriccanvas/widgets';
  import type { AiSummarySnapshot } from './session';

  let {
    props,
    data,
    onretry
  }: {
    props: { title?: string };
    data: AiSummarySnapshot;
    onretry: () => void;
  } = $props();
</script>

<section class="ai-summary" aria-live="polite">
  {#if props.title}<h3>{props.title}</h3>{/if}
  {#if data.status === 'loading'}
    <p class="muted">正在生成总结…</p>
  {:else if data.status === 'streaming'}
    <div class="summary-content"><SafeMarkdown content={data.text} /></div>
    <span class="streaming" aria-label="仍在生成">●</span>
  {:else if data.status === 'ready'}
    <div class="summary-content"><SafeMarkdown content={data.text} /></div>
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
  .ai-summary {
    position: relative;
    display: grid;
    gap: 0;
    min-height: 0;
    grid-template-rows: auto auto;
    padding: 15px 18px 15px 15px;
    background: var(--mc-color-surface, #fff);
    border-radius: 16px;
  }
  h3 {
    margin: 0 0 15px 5px;
    color: #121e3b;
    font-size: 20px;
    font-weight: 600;
    line-height: 25px;
    text-align: left;
  }
  p { margin: 0; }
  .muted { color: #71717a; }
  .summary-content {
    display: grid;
    align-content: start;
    gap: 0;
    padding: 9px 27px 12px 12px;
    color: #191919;
    background: var(--mc-color-surface-subtle, #f1f4ff);
    border-radius: 8px;
    font-size: 18px;
    font-weight: 400;
    line-height: 30px;
  }
  .streaming { color: #4f46e5; font-size: 9px; animation: pulse 900ms ease-in-out infinite alternate; }
  .error { display: flex; align-items: center; gap: 10px; color: #b42318; }
  .error button { padding: 5px 10px; color: #fff; background: #b42318; border: 0; border-radius: 5px; cursor: pointer; }
  @keyframes pulse { to { opacity: 0.25; } }
</style>
