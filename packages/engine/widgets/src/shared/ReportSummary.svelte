<svelte:options css="injected" />
<script lang="ts">
  import type { Snippet } from 'svelte';
  import SemanticHtml from './SemanticHtml.svelte';
  import sectionTitleLeftUrl from '../assets/section-title-left.svg?inline';
  import sectionTitleRightUrl from '../assets/section-title-right.svg?inline';

  let { title = '报告摘要', body, format = 'text', actions }: {
    title?: string;
    body: string;
    format?: 'text' | 'semanticHtml';
    actions?: Snippet;
  } = $props();
</script>

<section class="report-summary layered">
  <div class="report-summary-title">
    <img src={sectionTitleLeftUrl} alt="" data-decorative-icon="section-title-left" />
    <span role="heading" aria-level="3">{title}</span>
    <img src={sectionTitleRightUrl} alt="" data-decorative-icon="section-title-right" />
  </div>
  <div class="report-summary-frame">
    {#if format === 'semanticHtml'}
      <div class="report-summary-content">
        <SemanticHtml source={body} />
      </div>
    {:else}
      <p>{body}</p>
    {/if}
    {#if actions}{@render actions()}{/if}
  </div>
</section>
<style>
  .report-summary {
    margin: 0;
  }
  /* 面板外观与居中图标标题的数值真源在统一运行时根部的 --mc-section-* 变量,
     这里只引用不重写(fallback 仅覆盖脱离 RuntimeView 的孤立渲染)。 */
  .report-summary.layered {
    padding: var(--mc-section-panel-padding, 15px 28px 29px);
    background: var(--mc-section-panel-background, none);
    border-radius: var(--mc-section-panel-radius, var(--mc-radius-section, 16px));
  }
  .report-summary-title {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--mc-section-title-gap, 12px);
    margin: 0 0 16px;
    text-align: center;
  }
  .report-summary-title img {
    width: var(--mc-section-title-icon-size, 20px);
    height: var(--mc-section-title-icon-size, 20px);
    flex: none;
  }
  .report-summary-title span {
    color: var(--mc-color-primary, #08359e);
    font-size: var(--mc-section-title-font-size, 32px);
    font-weight: var(--mc-section-title-font-weight, 600);
    line-height: var(--mc-section-title-line-height, 50px);
  }
  .report-summary-frame {
    min-height: 0;
    padding: 15px 16px;
    background: var(--mc-color-surface, #fff);
    border: 0;
    border-radius: var(--mc-radius-section, 16px);
  }
  .report-summary p,
  .report-summary-content {
    max-width: none;
    min-height: 0;
    margin: 0;
    padding: 13px 16px 13px 28px;
    color: var(--mc-color-report-text, #191919);
    background: var(--mc-color-surface-subtle, #f1f4ff);
    border: 1px solid var(--mc-color-report-content-frame, #d4d5ff);
    border-radius: var(--mc-radius-report-content, 12px);
    font-size: 18px;
    line-height: 32px;
  }
  .report-summary > .report-summary-frame > p { white-space: pre-line; }
  .report-summary-content {
    --mc-semantic-font-size: 18px;
    --mc-semantic-line-height: 32px;
    --mc-semantic-title-color: var(--mc-color-report-text, #191919);
    --mc-semantic-description-color: var(--mc-color-report-text, #191919);
  }
</style>
