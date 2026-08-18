<script lang="ts">
  import type { ReportHeaderProps } from '@metriccanvas/page';
  import SemanticHtml from '../../shared/SemanticHtml.svelte';
  import sectionTitleLeftUrl from '../../assets/section-title-left.svg';
  import sectionTitleRightUrl from '../../assets/section-title-right.svg';
  import headerFlowBackgroundUrl from '../../assets/header-flow-background.svg';
  import reportBadgeBackgroundUrl from '../../assets/report-badge-background.svg?no-inline';

  /** 可见页头组合组件：只展示 props，不读取页面 meta、数据或全局状态。 */
  interface Props {
    props: ReportHeaderProps;
  }

  let { props }: Props = $props();
</script>

<header class:short-bar={props.decoration === 'shortBar'} class="report-header">
  {#if props.decoration === 'shortBar'}
    <div class="heading">
      <div class="report-cover">
        <img
          class="header-flow-background"
          src={headerFlowBackgroundUrl}
          alt=""
          aria-hidden="true"
          data-decorative-image="header-flow-background"
        />
        {#if props.generatedBy}<p class="generated-by">{props.generatedBy}</p>{/if}
        {#if props.badge}
          <div class="lead-row">
            <span class="badge lead-badge">
              <img
                class="lead-badge-background"
                src={reportBadgeBackgroundUrl}
                alt=""
                aria-hidden="true"
                data-decorative-image="report-badge-background"
              />
              <span>{props.badge}</span>
            </span>
          </div>
        {/if}
        <div class="title-line">
          <h1>{props.title}</h1>
        </div>
        {#if props.asOf}
          <div class="as-of inline">
            {props.asOf.label}：{props.asOf.value}
          </div>
        {/if}
      </div>
      {#if props.generatedBy && props.subtitle}
        <section class="report-summary layered">
          <div class="report-summary-title">
            <img src={sectionTitleLeftUrl} alt="" data-decorative-icon="section-title-left" />
            <span>报告摘要</span>
            <img src={sectionTitleRightUrl} alt="" data-decorative-icon="section-title-right" />
          </div>
          <div class="report-summary-frame">
            {#if props.subtitleFormat === 'semanticHtml'}
              <div class="report-summary-content">
                <SemanticHtml source={props.subtitle} />
              </div>
            {:else}
              <p>{props.subtitle}</p>
            {/if}
          </div>
        </section>
      {:else if props.subtitle && props.subtitleFormat === 'semanticHtml'}
        <div class="subtitle-content"><SemanticHtml source={props.subtitle} /></div>
      {:else if props.subtitle}<p>{props.subtitle}</p>{/if}
      {#if props.tags?.length}
        <div class="tags" aria-label="报告标签">
          {#each props.tags as tag, index (`${tag}:${index}`)}
            <span>{tag}</span>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <div class="heading">
      <div class="title-line">
        <span class="report-icon" aria-hidden="true"></span>
        <h1>{props.title}</h1>
      </div>
      {#if props.badge}<span class="badge">{props.badge}</span>{/if}
      {#if props.generatedBy}<p class="generated-by">{props.generatedBy}</p>{/if}
      {#if props.subtitle && props.subtitleFormat === 'semanticHtml'}
        <div class="subtitle-content"><SemanticHtml source={props.subtitle} /></div>
      {:else if props.subtitle}<p>{props.subtitle}</p>{/if}
      {#if props.tags?.length}
        <div class="tags" aria-label="报告标签">
          {#each props.tags as tag, index (`${tag}:${index}`)}
            <span>{tag}</span>
          {/each}
        </div>
      {/if}
    </div>
    {#if props.asOf}
      <div class="as-of">
        <span>{props.asOf.label}</span>
        <strong>{props.asOf.value}</strong>
      </div>
    {/if}
  {/if}
</header>

<style>
  .report-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 32px;
    width: 100%;
    padding: 10px 4px 24px;
  }
  .report-header.short-bar {
    display: block;
    min-height: 248px;
    padding: 0;
  }
  .report-cover {
    position: relative;
    isolation: isolate;
    margin: calc(-1 * var(--mc-page-content-padding-block-start, 0px))
      calc(-1 * var(--mc-page-content-padding-inline, 0px)) 0;
    padding: 28px 26px 52px;
    overflow: hidden;
    background: var(--mc-color-surface-subtle, #f1f4ff);
    border-radius: 0;
  }
  .header-flow-background {
    position: absolute;
    inset: 0;
    z-index: -1;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    pointer-events: none;
  }
  .title-line {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .report-icon {
    width: 28px;
    height: 28px;
    border-radius: 8px 3px 8px 3px;
    background:
      linear-gradient(135deg, transparent 42%, #fff 43% 54%, transparent 55%),
      linear-gradient(135deg, #5b72ea, #8aa7ff);
    box-shadow: 0 6px 16px rgb(69 89 180 / 0.2);
  }
  .heading {
    min-width: 0;
  }
  h1 {
    margin: 0;
    color: #445593;
    font-size: 24px;
    line-height: 1.15;
    letter-spacing: -0.025em;
  }
  p {
    max-width: 720px;
    margin: 10px 0 0;
    color: #667085;
    font-size: 14px;
    line-height: 1.65;
  }
  .subtitle-content {
    --mc-semantic-font-size: 14px;
    --mc-semantic-line-height: 1.65;
    --mc-semantic-title-color: #667085;
    --mc-semantic-description-color: #667085;
    max-width: 720px;
    margin: 10px 0 0;
    color: #667085;
    font-size: 14px;
    line-height: 1.65;
  }
  .generated-by {
    margin-top: 10px;
    color: #445593;
    font-weight: 500;
  }
  .short-bar .generated-by {
    display: flex;
    align-items: center;
    gap: 7px;
    margin: 0 0 60px;
    color: #445593;
    font-size: 16px;
    font-weight: 500;
    line-height: 22px;
  }
  .short-bar .heading {
    display: flex;
    width: 100%;
    flex-direction: column;
    gap: 0;
  }
  .short-bar .generated-by::before {
    width: 28px;
    height: 28px;
    flex: 0 0 28px;
    background: url('../../assets/report-assistant-icon.svg') center / 100% 100% no-repeat;
    content: '';
  }
  .short-bar .title-line {
    margin-left: 34px;
  }
  .short-bar h1 {
    position: relative;
    display: inline-block;
    color: transparent;
    background: linear-gradient(
      270deg,
      rgb(46 50 149) 0%,
      rgb(46 36 180) 23.629%,
      rgb(73 119 255) 80.57%,
      rgb(20 77 184) 100%
    );
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    font-family: 'PingFang SC', sans-serif;
    font-style: normal;
    font-size: 60px;
    font-weight: 400;
    line-height: 72px;
    letter-spacing: 0;
    text-align: left;
    -webkit-text-stroke-width: 0.4px;
  }
  .short-bar h1::after {
    position: absolute;
    top: calc(100% - 6px);
    right: 0;
    left: 0;
    height: 9px;
    background: rgb(102 196 255);
    content: '';
    opacity: 0.28;
  }
  .badge,
  .tags span {
    display: inline-flex;
    padding: 4px 10px;
    border-radius: 999px;
    background: #e8edff;
    color: #4257c9;
    font-size: 12px;
    font-weight: 700;
  }
  .lead-badge {
    position: relative;
    isolation: isolate;
    min-width: 208px;
    min-height: 50px;
    justify-content: center;
    padding: 4px 16px;
    overflow: hidden;
    color: #fff;
    background: transparent;
    border-radius: 0;
    font-size: 32px;
    font-weight: 500;
    line-height: 42px;
  }
  .lead-badge-background {
    position: absolute;
    inset: 0;
    z-index: -1;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    pointer-events: none;
  }
  .lead-row {
    display: flex;
    align-items: flex-start;
    margin: 0 0 14px 36px;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  .tags span {
    background: #f4f6ff;
    color: #6672a8;
    font-weight: 500;
  }
  .as-of {
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    gap: 3px;
    min-width: 92px;
  }
  .as-of.inline {
    align-items: baseline;
    flex-direction: row;
    gap: 0;
    margin: 4px 0 0 38px;
  }
  .short-bar .as-of.inline {
    margin: 16px 0 0 36px;
  }
  .as-of span {
    color: #8a91a5;
    font-size: 11px;
  }
  .as-of strong {
    color: #1f2a56;
    font-size: 13px;
    font-weight: 600;
  }
  .short-bar .as-of.inline {
    color: transparent;
    background: linear-gradient(
      270deg,
      rgb(46 50 149) 0%,
      rgb(46 36 180) 23.629%,
      rgb(73 119 255) 80.57%,
      rgb(20 77 184) 100%
    );
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    font-family: 'PingFang SC', sans-serif;
    font-style: normal;
    font-size: 16px;
    font-weight: 400;
    line-height: 22px;
    letter-spacing: 0;
    text-align: left;
    -webkit-text-stroke-width: 0.4px;
  }
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
  .report-summary-content {
    --mc-semantic-font-size: 18px;
    --mc-semantic-line-height: 32px;
    --mc-semantic-title-color: var(--mc-color-report-text, #191919);
    --mc-semantic-description-color: var(--mc-color-report-text, #191919);
  }
  @media (max-width: 760px) {
    .report-header {
      align-items: flex-start;
      flex-direction: column;
      gap: 18px;
    }
    .report-header.short-bar {
      display: block;
      min-height: auto;
    }
    .short-bar h1 {
      font-size: 42px;
      line-height: 1.2;
    }
    .header-flow-background {
      object-position: 62% center;
    }
  }
</style>
