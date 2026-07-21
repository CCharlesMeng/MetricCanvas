<script lang="ts">
  import type { FieldBinding, MetricCardProps } from '@metriccanvas/page';
  import type { MetricDataSlots } from './component-data';
  import { fieldValue, resolveField } from './component-data';
  import { formatValue, valuePolarity } from './value-format';

  interface Props {
    /** 已解析的 main/compare/target 命名槽。 */
    data: MetricDataSlots;
    props: MetricCardProps;
  }

  let { data, props }: Props = $props();

  function fieldText(field: FieldBinding): string {
    const resolved = resolveField(field, data);
    return formatValue(fieldValue(field, data), resolved.definition?.format);
  }
</script>

<div class="metric-card">
  {#if props.title}<h3>{props.title}</h3>{/if}
  {#each props.rows as row, index (`${row.label}:${index}`)}
    <div class="metric-row">
      <span class="row-label">{row.label}</span>
      <span class="row-value">{fieldText(row.valueField)}</span>
      {#if row.changes?.length}
        <div class="changes">
          {#each row.changes as change, changeIndex (`${change.label}:${changeIndex}`)}
            {@const raw = fieldValue(change.field, data)}
            {@const polarity = valuePolarity(raw)}
            <span
              class:positive={polarity === 'positive'}
              class:negative={polarity === 'negative'}
              class="change"
            >
              <span class="change-label">{change.label}</span>
              <span>{fieldText(change.field)}</span>
            </span>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .metric-card {
    display: flex;
    align-items: stretch;
    justify-content: center;
    flex-direction: column;
    gap: 0.45rem;
    height: 100%;
  }
  h3 {
    margin: 0 0 0.25rem;
    color: #18181b;
    font-size: 0.875rem;
    font-weight: 500;
  }
  .metric-row {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.4rem;
    min-width: 0;
  }
  .row-label {
    color: #595959;
    font-size: 0.875rem;
  }
  .row-value {
    color: #0f1a4d;
    font-size: 1.625rem;
    font-weight: 600;
    line-height: 1.35;
    font-variant-numeric: tabular-nums;
  }
  .changes {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .change {
    color: #71717a;
    font-size: 0.875rem;
    font-variant-numeric: tabular-nums;
  }
  .change-label {
    margin-right: 0.2rem;
  }
  .positive {
    color: #52c41a;
  }
  .negative {
    color: #f5222d;
  }
</style>
