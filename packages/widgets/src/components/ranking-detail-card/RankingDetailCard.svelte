<script lang="ts">
  import type { RankingDetailCardProps } from '@metriccanvas/page';
  import type { MainDataSlots } from '../../shared/component-data';
  import { buildRankingDetailRows } from './rows';

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
  class="ranking-detail-card"
>
  {#if props.title}<h3>{props.title}</h3>{/if}
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
        </div>
      </li>
    {:else}
      <li class="empty">暂无数据</li>
    {/each}
  </ol>
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
    color: #121e3b;
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
    color: #697386;
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
    color: #191919;
    font-size: 14px;
    font-weight: 600;
    line-height: 22px;
  }
  .badge {
    padding: 1px 6px;
    color: #1476ff;
    background: #e8f1ff;
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
    color: #191919;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .change {
    color: #71717a;
    font-variant-numeric: tabular-nums;
  }
  .positive {
    color: var(--mc-color-positive, #52c41a);
  }
  .negative-value {
    color: var(--mc-color-negative, #f5222d);
  }
  p {
    margin: 6px 0 0;
    padding: 7px 9px;
    color: #595959;
    background: rgb(255 255 255 / 0.72);
    border-radius: 5px;
    font-size: 12px;
    line-height: 18px;
    overflow-wrap: anywhere;
  }
  .empty {
    padding: 28px 0;
    color: var(--mc-color-muted, #71717a);
    text-align: center;
  }
</style>
