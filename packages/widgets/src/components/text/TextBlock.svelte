<script lang="ts" module>
  /** 已解析的跳转链接:href 由运行时按筛选状态当前值组装(组件不感知序列化机制) */
  export interface TextBlockLink {
    label: string;
    href: string;
    onclick?: (event: MouseEvent) => void;
  }
</script>

<script lang="ts">
  import type { TextProps } from '@metriccanvas/page';
  import SemanticHtml from '../../shared/SemanticHtml.svelte';
  import aiSummaryIconUrl from '../../assets/ai-summary-icon.svg';
  import riskWarningIconUrl from '../../assets/risk-warning.svg';
  import sectionTitleLeftUrl from '../../assets/section-title-left.svg';
  import sectionTitleRightUrl from '../../assets/section-title-right.svg';

  /**
   * 文本组件(纯渲染):标题/说明静态文案 + 带参跳转链接。
   * 无查询、无数据快照;文案是页面文档里的字面量,不支持表达式(ADR-0003)。
   */
  interface Props {
    props: Omit<TextProps, 'links'>;
    /** 页面声明的链接经统一运行时解析为 href 后传入。 */
    links?: TextBlockLink[];
  }

  let { props, links = [] }: Props = $props();
</script>

<div
  class:insight={props.variant === 'insight'}
  class:report-inline={props.variant === 'reportInline'}
  class:risk-notice={props.variant === 'riskNotice'}
  class="text-block"
  style:--risk-notice-max-width={`${props.maxWidth ?? 532}px`}
>
  {#if props.variant === 'heading'}
    <span class="page-heading">
      <img src={sectionTitleLeftUrl} alt="" aria-hidden="true" data-decorative-icon="section-title-left" />
      <span class="page-heading-title">{props.title}</span>
      <img src={sectionTitleRightUrl} alt="" aria-hidden="true" data-decorative-icon="section-title-right" />
    </span>
  {:else if props.variant === 'reportInline'}
    <div class="inline-prefix">
      <img class="inline-icon" src={aiSummaryIconUrl} alt="" aria-hidden="true" />
      <div class="inline-content">
        <strong class="inline-label">{props.title ?? 'AI 总结'}：</strong>
        {#if props.body && props.bodyFormat === 'semanticHtml'}
          <div class="body semantic-body">
            <SemanticHtml source={props.body} inline toneWeight="regular" />
          </div>
        {:else if props.body}<p class="body">{props.body}</p>{/if}
      </div>
    </div>
  {:else if props.title && !props.body && links.length === 0}
    <span class="heading">{props.title}</span>
  {:else if props.title}<h3 class="heading">{props.title}</h3>{/if}
  {#if props.variant === 'riskNotice'}
    <img
      class="risk-warning-icon"
      src={riskWarningIconUrl}
      alt=""
      aria-hidden="true"
      data-decorative-icon="risk-warning"
    />
  {/if}
  {#if props.variant !== 'reportInline'}
    {#if props.body && props.bodyFormat === 'semanticHtml'}
      <div class="body semantic-body">
        <SemanticHtml source={props.body} />
      </div>
    {:else if props.body}<p class="body">{props.body}</p>{/if}
  {/if}
  {#if links.length > 0}
    <nav class="links">
      {#each links as link (link.label + link.href)}
        <a href={link.href} onclick={link.onclick}>{link.label} →</a>
      {/each}
    </nav>
  {/if}
</div>

<style>
  .text-block {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    min-height: 0;
  }
  /* insight 摘要块外观真源在统一运行时根部的 --mc-insight-* 变量,
     与 AI 总结 View 共用同一组数值,这里只引用不重写。 */
  .text-block.insight {
    box-sizing: border-box;
    justify-content: flex-start;
    gap: 0;
    padding: var(--mc-insight-padding, 15px 18px 15px 15px);
    border-radius: var(--mc-insight-radius, 16px);
    background: var(--mc-color-surface, #fff);
  }
  .text-block.report-inline {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    padding: 10px 14px;
    color: #191919;
    background: var(--mc-color-surface-subtle, #f1f4ff);
    border: 1px solid var(--mc-color-report-content-frame, #d4d5ff);
    border-radius: var(--mc-radius-report-content, 12px);
    font-size: 18px;
    font-weight: 400;
    line-height: 26px;
  }
  .report-inline .inline-prefix {
    display: grid;
    align-items: start;
    gap: 6px;
    grid-template-columns: 20px minmax(0, 1fr);
  }
  .report-inline .inline-icon {
    width: 20px;
    height: 20px;
    flex: none;
    margin-top: 3px;
    object-fit: contain;
  }
  .report-inline .inline-content {
    min-width: 0;
  }
  .report-inline .inline-label {
    flex: none;
    color: inherit;
    font: inherit;
    font-weight: 600;
    white-space: nowrap;
  }
  .text-block.risk-notice {
    box-sizing: border-box;
    width: min(100%, calc(var(--risk-notice-max-width) + 26px));
    min-height: 32px;
    flex: none;
    flex-direction: row;
    align-items: flex-start;
    justify-content: flex-start;
    gap: 6px;
    padding: 6px 10px;
    overflow: visible;
    color: #363b51;
    background: rgb(242 30 30 / 0.1);
    border-radius: 6px;
  }
  .risk-notice .body {
    min-width: 0;
    overflow: visible;
    overflow-wrap: anywhere;
    color: inherit;
    font-size: 10px;
    line-height: 20px;
    white-space: normal;
  }
  .risk-warning-icon {
    width: 20px;
    height: 20px;
    flex: none;
  }
  .heading {
    margin: 0;
    color: var(--mc-text-heading-color, #18181b);
    font-size: var(--mc-text-heading-font-size, 16px);
    font-weight: var(--mc-text-heading-font-weight, 600);
    line-height: var(--mc-text-heading-line-height, normal);
    text-align: var(--mc-text-heading-text-align, start);
  }
  /* 居中图标标题的数值真源在统一运行时根部的 --mc-section-title-* 变量。 */
  .page-heading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--mc-section-title-gap, 12px);
  }
  .page-heading img {
    width: var(--mc-section-title-icon-size, 20px);
    height: var(--mc-section-title-icon-size, 20px);
    flex: none;
  }
  .page-heading-title {
    color: var(--mc-color-primary, #0f1a4d);
    font-size: var(--mc-section-title-font-size, 32px);
    font-weight: var(--mc-section-title-font-weight, 600);
    line-height: var(--mc-section-title-line-height, 50px);
    text-align: center;
  }
  .body {
    margin: 0;
    font-size: 13px;
    color: #52525b;
    line-height: 1.6;
    white-space: pre-line;
  }
  .semantic-body {
    white-space: normal;
  }
  .insight .heading {
    margin: var(--mc-insight-heading-margin, 0 0 15px 5px);
    color: var(--mc-color-report-heading, #121e3b);
    font-size: var(--mc-insight-heading-font-size, 20px);
    font-weight: 600;
    line-height: var(--mc-insight-heading-line-height, 25px);
    text-align: left;
  }
  .insight .body {
    padding: var(--mc-insight-body-padding, 9px 27px 12px 12px);
    color: var(--mc-color-report-text, #191919);
    background: var(--mc-color-surface-subtle, #f1f4ff);
    border-radius: var(--mc-insight-body-radius, 8px);
    font-size: var(--mc-insight-body-font-size, 18px);
    font-weight: 400;
    line-height: var(--mc-insight-body-line-height, 30px);
  }
  .insight .semantic-body {
    --mc-semantic-description-color: #191919;
    --mc-semantic-font-size: 18px;
    --mc-semantic-line-height: 30px;
  }
  .report-inline .body {
    display: inline;
    padding: 0;
    color: inherit;
    background: transparent;
    border-radius: 0;
    font-size: inherit;
    font-weight: inherit;
    line-height: inherit;
  }
  /* 行内呈现由 SemanticHtml 的 inline 展示属性声明,调用方不再穿透其内部 DOM。 */
  .report-inline .semantic-body {
    --mc-semantic-description-color: #191919;
    --mc-semantic-font-size: 18px;
    --mc-semantic-line-height: 26px;
  }
  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-top: 2px;
  }
  .links a {
    font-size: 13px;
    color: #2563eb;
    text-decoration: none;
  }
  .links a:hover {
    text-decoration: underline;
  }
</style>
