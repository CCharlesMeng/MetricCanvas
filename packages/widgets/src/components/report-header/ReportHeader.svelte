<script lang="ts">
  import type { ReportHeaderProps } from '@metriccanvas/page';

  /** 可见页头组合组件：只展示 props，不读取页面 meta、数据或全局状态。 */
  interface Props {
    props: ReportHeaderProps;
  }

  let { props }: Props = $props();
</script>

<header class:short-bar={props.decoration === 'shortBar'} class="report-header">
  <div class="heading">
    {#if props.decoration === 'shortBar' && props.generatedBy}
      <p class="generated-by">{props.generatedBy}</p>
    {/if}
    {#if props.decoration === 'shortBar'}<div class="summary-spacer before-title"></div>{/if}
    <div class="title-line">
      {#if props.decoration !== 'shortBar'}
        <span class="report-icon" aria-hidden="true"></span>
      {/if}
      <h1>{props.title}</h1>
    </div>
    {#if props.decoration !== 'shortBar' && props.badge}<span class="badge">{props.badge}</span>{/if}
    {#if props.decoration !== 'shortBar' && props.generatedBy}
      <p class="generated-by">{props.generatedBy}</p>
    {/if}
    {#if props.decoration === 'shortBar' && props.asOf}
      <div class="as-of inline">
        {props.asOf.label}：{props.asOf.value}
      </div>
    {/if}
    {#if props.decoration === 'shortBar' && props.badge}<span class="badge lead-badge">{props.badge}</span>{/if}
    {#if props.decoration === 'shortBar' && props.generatedBy && props.subtitle}
      <section class="report-summary layered">
        <div class="report-summary-title"><span>报告摘要</span></div>
        <p>{props.subtitle}</p>
      </section>
    {:else if props.subtitle}<p>{props.subtitle}</p>{/if}
    {#if props.decoration === 'shortBar'}<div class="summary-spacer after-summary"></div>{/if}
    {#if props.tags?.length}
      <div class="tags" aria-label="报告标签">
        {#each props.tags as tag, index (`${tag}:${index}`)}
          <span>{tag}</span>
        {/each}
      </div>
    {/if}
  </div>

  {#if props.decoration !== 'shortBar' && props.asOf}
    <div class="as-of">
      <span>{props.asOf.label}</span>
      <strong>{props.asOf.value}</strong>
    </div>
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
    flex-direction: column;
  }
  .short-bar .generated-by {
    order: 0;
  }
  .short-bar .lead-badge {
    align-self: flex-start;
    order: 1;
  }
  .short-bar .title-line {
    order: 2;
  }
  .short-bar .as-of.inline {
    order: 3;
  }
  .short-bar .report-summary {
    order: 4;
  }
  .summary-spacer {
    display: none;
  }
  .short-bar .generated-by::before {
    width: 28px;
    height: 28px;
    flex: 0 0 28px;
    background: url('./assets/report-assistant-icon.svg') center / 100% 100% no-repeat;
    content: '';
  }
  .short-bar .title-line {
    margin-left: 34px;
  }
  .short-bar h1 {
    color: #000;
    font-size: 60px;
    font-weight: 400;
    line-height: 72px;
    letter-spacing: 0;
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
    margin: 0 0 14px 36px;
    min-width: 208px;
    min-height: 50px;
    justify-content: center;
    padding: 4px 16px;
    color: #fff;
    background: var(--mc-color-report-header-accent, #2098ff);
    border-radius: 0;
    font-size: 32px;
    font-weight: 500;
    line-height: 42px;
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
    color: #000;
    font-size: 16px;
    font-weight: 400;
    line-height: 22px;
  }
  .report-summary {
    margin: 52px 0 0;
  }
  .report-summary.layered {
    padding: 8px 16px 16px;
    background-color: transparent;
    background-image: var(--mc-section-gradient, none);
    background-repeat: no-repeat;
    background-position: center;
    background-size: 100% 100%;
    border-radius: var(--mc-radius-section, 16px);
  }
  .report-summary-title {
    margin: 0 0 16px;
    text-align: center;
  }
  .report-summary-title span {
    color: var(--mc-color-primary, #08359e);
    font-size: 32px;
    font-weight: 400;
    line-height: 50px;
  }
  .report-summary p {
    max-width: none;
    min-height: 152px;
    margin: 0;
    padding: 28px 38px;
    color: var(--mc-color-report-text, #191919);
    background: var(--mc-color-surface, #fff);
    border: 0;
    border-radius: var(--mc-radius-section, 16px);
    font-size: 18px;
    line-height: 32px;
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
  }
</style>
