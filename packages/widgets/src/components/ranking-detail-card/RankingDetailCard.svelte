<script lang="ts">
  import type { RankingDetailCardProps } from '@metriccanvas/page';
  import type { MainDataSlots } from '../../shared/component-data';
  import { buildRankingDetailRows } from './rows';
  import SemanticHtml from './SemanticHtml.svelte';

  interface Props {
    data: MainDataSlots;
    props: RankingDetailCardProps;
  }

  let { data, props }: Props = $props();
  const rows = $derived(buildRankingDetailRows(data, props));
</script>

<section
  class:negative={props.tone === 'negative'}
  class:neutral={props.tone === 'neutral'}
  class:report={props.variant === 'report'}
  class="ranking-detail-card"
>
  {#if props.title}<h3>{props.title}</h3>{/if}
  <div class="ranking-content">
    <ol>
      {#each rows as row (row.rank)}
        <li class="ranking-detail-row">
        <span class:top-three={row.rank <= 3} class="rank" aria-label={`第 ${row.rank} 名`}>
          {row.rank}
        </span>
        <div class="detail">
          <div class="headline">
            <strong class="name">{row.name}</strong>
            {#each row.badges as badge, badgeIndex (`${badge}:${badgeIndex}`)}
              <span class="badge">{badge}</span>
            {/each}
          </div>
          <div class="metric-line">
            {#if props.metricLabel}<span class="metric-label">{props.metricLabel}：</span>{/if}
            <span class="value">{row.value}</span>
            {#if row.change}
              <span
                class:positive={row.change.polarity === 'positive'}
                class:negative-value={row.change.polarity === 'negative'}
                class="change"
              >（环比：{row.change.text}）</span>
            {/if}
          </div>
          {#if row.description}<p>{row.description}</p>{/if}
          {#if row.semanticDescription}
            <div class="semantic-description">
              {#if row.semanticDescription.nodes}
                <SemanticHtml nodes={row.semanticDescription.nodes} />
              {:else}
                <span class="semantic-html-error">说明内容格式不受支持</span>
              {/if}
            </div>
          {/if}
          {#if row.details}
            <details class="nested-details" open={row.details.defaultExpanded}>
              <summary>归因明细（{row.details.items.length}）</summary>
              <ul>
                {#each row.details.items as item, itemIndex (`${item.title}:${itemIndex}`)}
                  <li>
                    <div class="nested-headline">
                      <strong>{item.title}</strong>
                      {#if item.value}<span>{item.value}</span>{/if}
                    </div>
                    {#if item.description}<p>{item.description}</p>{/if}
                  </li>
                {/each}
              </ul>
            </details>
          {/if}
        </div>
        </li>
      {:else}
        <li class="empty">暂无数据</li>
      {/each}
    </ol>
  </div>
</section>

<style>
  .ranking-detail-card {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    color: var(--mc-color-text-strong, #0f1a4d);
  }
  h3 {
    margin: 0 0 14px;
    color: var(--mc-color-report-heading, #121e3b);
    font-size: 18px;
    font-weight: 600;
    line-height: 28px;
  }
  ol {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .ranking-detail-row {
    display: grid;
    grid-template-columns: 26px minmax(0, 1fr);
    gap: 9px;
    padding: 9px 10px;
    background: var(--mc-color-surface-subtle, #f1f4ff);
    border-radius: 8px;
  }
  .rank {
    display: inline-flex;
    width: 22px;
    height: 22px;
    align-items: center;
    justify-content: center;
    margin-top: 1px;
    color: var(--mc-color-report-rank-muted, #697386);
    background: #e7eaf2;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .rank.top-three {
    color: #fff;
    background: var(--mc-color-accent, #4f46e5);
  }
  .negative .rank.top-three {
    background: var(--mc-color-negative, #f5222d);
  }
  .neutral .rank.top-three {
    background: #75809c;
  }
  .detail {
    min-width: 0;
  }
  .headline,
  .metric-line {
    display: flex;
    min-width: 0;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 6px;
  }
  .name {
    min-width: 0;
    color: var(--mc-color-report-text, #191919);
    font-size: 14px;
    font-weight: 600;
    line-height: 22px;
  }
  .badge {
    padding: 1px 6px;
    color: var(--mc-color-report-badge, #1476ff);
    background: var(--mc-color-report-badge-surface, #e8f1ff);
    border-radius: 3px;
    font-size: 11px;
    line-height: 18px;
  }
  .metric-line {
    margin-top: 3px;
    font-size: 13px;
    line-height: 22px;
  }
  .value {
    color: var(--mc-color-report-text, #191919);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .change {
    color: var(--mc-color-muted, #71717a);
    font-variant-numeric: tabular-nums;
  }
  .positive {
    color: var(--mc-color-positive, #52c41a);
  }
  .negative-value {
    color: var(--mc-color-negative, #f5222d);
  }
  p,
  .semantic-description {
    margin: 6px 0 0;
    padding: 7px 9px;
    color: var(--mc-color-report-description, #595959);
    background: rgb(255 255 255 / 0.72);
    border-radius: 5px;
    font-size: 12px;
    line-height: 18px;
    overflow-wrap: anywhere;
  }
  .semantic-html-error {
    color: var(--mc-color-negative, #f5222d);
  }
  .nested-details {
    margin-top: 8px;
    color: var(--mc-color-report-description, #595959);
    font-size: 12px;
  }
  .nested-details summary {
    width: fit-content;
    cursor: pointer;
    color: var(--mc-color-report-badge, #1476ff);
    font-weight: 600;
    line-height: 20px;
  }
  .nested-details ul {
    display: grid;
    gap: 6px;
    margin: 7px 0 0;
    padding: 0;
    list-style: none;
  }
  .nested-details li {
    padding: 7px 9px;
    background: rgb(255 255 255 / 0.78);
    border: 1px solid rgb(212 213 255 / 0.75);
    border-radius: 6px;
  }
  .nested-headline {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    font-variant-numeric: tabular-nums;
  }
  .nested-headline strong {
    color: var(--mc-color-report-text, #191919);
    font-weight: 600;
  }
  .nested-details p {
    margin-top: 4px;
    padding: 0;
    background: transparent;
    font-size: inherit;
    line-height: 18px;
  }
  .empty {
    padding: 28px 0;
    color: var(--mc-color-muted, #71717a);
    text-align: center;
  }
  .ranking-detail-card.report h3 {
    margin-bottom: 14px;
    font-size: 18px;
    font-weight: 400;
    line-height: 30px;
  }
  .ranking-detail-card.report ol {
    gap: 10px;
  }
  .ranking-detail-card.report .ranking-content {
    padding: 20px 12px;
    background: rgb(252 252 255);
    border: 1px solid rgb(212 213 255);
    border-radius: 12px;
  }
  .ranking-detail-card.report .ranking-detail-row {
    min-height: 138px;
    grid-template-columns: 26px minmax(0, 1fr);
    gap: 10px;
    padding: 10px 0;
    background: transparent;
    border-radius: 0;
  }
  .ranking-detail-card.report .rank,
  .ranking-detail-card.report .rank.top-three,
  .ranking-detail-card.report.negative .rank.top-three,
  .ranking-detail-card.report.neutral .rank.top-three {
    color: var(--mc-color-report-rank-muted, #697386);
    background: #e7eaf2;
  }
  .ranking-detail-card.report .name {
    font-size: 18px;
    font-weight: 500;
    line-height: 30px;
  }
  .ranking-detail-card.report .badge {
    font-size: 14px;
    line-height: 22px;
  }
  .ranking-detail-card.report .metric-line {
    margin-top: 4px;
    font-size: 18px;
    line-height: 28px;
  }
  .ranking-detail-card.report .metric-label {
    color: #505a84;
  }
  .ranking-detail-card.report p,
  .ranking-detail-card.report .semantic-description {
    margin-top: 8px;
    padding: 8px 10px;
    color: var(--mc-color-report-description, #595959);
    background: var(--mc-color-surface-subtle, #f1f4ff);
    border-radius: 6px;
    font-size: 16px;
    line-height: 20px;
  }
  .ranking-detail-card.report .nested-details {
    font-size: 14px;
  }
  .ranking-detail-card.report .nested-details p {
    margin-top: 4px;
    padding: 0;
    background: transparent;
    font-size: 13px;
    line-height: 18px;
  }
</style>
