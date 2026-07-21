<script lang="ts">
  import type { RankingCardProps } from '@metriccanvas/page';
  import type { MainDataSlots } from './component-data';
  import { fieldLabel, resolveField } from './component-data';
  import { formatValue, valuePolarity } from './value-format';

  interface Props {
    /** 已由统一运行时确定顺序的 main 数据槽；组件不排序、不取数。 */
    data: MainDataSlots;
    props: RankingCardProps;
  }

  let { data, props }: Props = $props();

  const name = $derived(resolveField(props.nameField, data));
  const value = $derived(resolveField(props.valueField, data));
  const change = $derived(
    props.changeField ? resolveField(props.changeField, data) : undefined
  );
</script>

{#if props.title}<h3>{props.title}</h3>{/if}
<ol class="ranking-card">
  {#each data.main.snapshot.rows as row, index (index)}
    {@const changePolarity = valuePolarity(change ? row[change.field] : undefined)}
    <li class="ranking-item">
      <span
        aria-label={`第 ${index + 1} 名`}
        class:top-three={index < 3}
        class="rank"
      >
        {index + 1}
      </span>
      <span class="name">{formatValue(row[name.field], name.definition?.format)}</span>
      <span class="ranking-value">
        {formatValue(row[value.field], value.definition?.format)}
      </span>
      {#if change}
        <span
          class:negative={changePolarity === 'negative'}
          class:positive={changePolarity === 'positive'}
          class="change"
        >
          <span class="change-label">{fieldLabel(props.changeField!, data)}</span>
          {formatValue(row[change.field], change.definition?.format)}
        </span>
      {/if}
    </li>
  {:else}
    <li class="empty">暂无数据</li>
  {/each}
</ol>

<style>
  h3 {
    margin: 0 0 6px;
    color: #18181b;
    font-size: 13px;
    font-weight: 500;
  }
  .ranking-card {
    flex: 1;
    min-height: 0;
    margin: 0;
    padding: 0;
    overflow: auto;
    list-style: none;
  }
  .ranking-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid rgb(0 0 0 / 0.06);
  }
  .ranking-item:last-child {
    border-bottom: 0;
  }
  .rank {
    display: inline-flex;
    flex: 0 0 24px;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #bfbfbf;
    color: #fff;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .rank.top-three {
    background: #5b72ea;
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: #191919;
    font-size: 14px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ranking-value {
    color: #191919;
    font-size: 14px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .change {
    display: inline-flex;
    gap: 4px;
    color: #71717a;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .change-label {
    color: #8a91a5;
  }
  .positive {
    color: #52c41a;
  }
  .negative {
    color: #f5222d;
  }
  .empty {
    padding: 24px 0;
    color: #71717a;
    text-align: center;
  }
</style>
