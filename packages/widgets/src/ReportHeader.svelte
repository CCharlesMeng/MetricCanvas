<script lang="ts">
  import type { ReportHeaderProps } from '@metriccanvas/page';

  /** 可见页头组合组件：只展示 props，不读取页面 meta、数据或全局状态。 */
  interface Props {
    props: ReportHeaderProps;
  }

  let { props }: Props = $props();
</script>

<header class:briefing={props.decoration === 'shortBar'} class="report-header">
  <div class="heading">
    <div class="title-line">
      <span class="report-icon" aria-hidden="true"></span>
      <h1>{props.title}</h1>
    </div>
    {#if props.badge}<span class="badge">{props.badge}</span>{/if}
    {#if props.generatedBy}<p class="generated-by">{props.generatedBy}</p>{/if}
    {#if props.decoration === 'shortBar' && props.asOf}
      <div class="as-of inline">
        <span>{props.asOf.label}：</span>
        <strong>{props.asOf.value}</strong>
      </div>
    {/if}
    {#if props.subtitle}<p>{props.subtitle}</p>{/if}
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
{#if props.decoration === 'shortBar'}<div class="decoration" aria-hidden="true"></div>{/if}

<style>
  .report-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 32px;
    width: 100%;
    padding: 10px 4px 24px;
  }
  .report-header.briefing {
    align-items: flex-start;
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
  .briefing .generated-by {
    margin-left: 38px;
  }
  .decoration {
    width: min(475px, 44%);
    height: 9px;
    margin: -12px 0 10px 36px;
    background: rgb(102 196 255 / 0.28);
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
  .as-of span {
    color: #8a91a5;
    font-size: 11px;
  }
  .as-of strong {
    color: #1f2a56;
    font-size: 13px;
    font-weight: 600;
  }
  @media (max-width: 760px) {
    .report-header {
      align-items: flex-start;
      flex-direction: column;
      gap: 18px;
    }
  }
</style>
