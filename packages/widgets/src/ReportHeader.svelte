<script lang="ts">
  import type { ReportHeaderProps } from '@metriccanvas/page';

  /** 可见页头组合组件：只展示 props，不读取页面 meta、数据或全局状态。 */
  interface Props {
    props: ReportHeaderProps;
  }

  let { props }: Props = $props();
</script>

<header class="report-header">
  <div class="heading">
    {#if props.badge}<span class="badge">{props.badge}</span>{/if}
    <h1>{props.title}</h1>
    {#if props.subtitle}<p>{props.subtitle}</p>{/if}
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
  .heading {
    min-width: 0;
  }
  h1 {
    margin: 8px 0 0;
    color: #111b3f;
    font-size: clamp(26px, 3vw, 38px);
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
