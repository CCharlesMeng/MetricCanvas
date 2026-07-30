<script lang="ts">
  import type { FieldBinding, MetricCardProps } from '@metriccanvas/page';
  import type { MetricDataSlots } from './component-data';
  import { fieldValue, resolveField } from './component-data';
  import { formatValue, valuePolarity } from './value-format';
  import ProgressRing from './ProgressRing.svelte';

  interface Props {
    /** 已解析的 main/compare/target 命名槽。 */
    data: MetricDataSlots;
    props: MetricCardProps;
  }

  let { data, props }: Props = $props();

  function fieldText(field: FieldBinding): string {
    const resolved = resolveField(field, data);
    return formatValue(fieldValue(field, data), resolved.format);
  }

  function changeText(
    field: FieldBinding,
    tone: 'auto' | 'neutral' | 'positive' | 'danger' | undefined
  ): string {
    const raw = fieldValue(field, data);
    const text = fieldText(field);
    return tone === 'positive' && typeof raw === 'number' && raw > 0 ? `+${text}` : text;
  }

  const progressValue = $derived(
    props.progress ? Number(fieldValue(props.progress.valueField, data) ?? 0) : 0
  );

  function toneClass(
    tone: 'auto' | 'neutral' | 'positive' | 'danger' | undefined,
    raw: ReturnType<typeof fieldValue>
  ): 'positive' | 'negative' | '' {
    if (tone === 'positive') return 'positive';
    if (tone === 'danger') return 'negative';
    if (tone === 'neutral') return '';
    const polarity = valuePolarity(raw);
    return polarity === 'positive' ? 'positive' : polarity === 'negative' ? 'negative' : '';
  }
</script>

<div
  class:activity-progress={props.variant === 'activityProgress'}
  class:summary={props.variant === 'summary'}
  class="metric-card"
>
  {#if props.title}<h3>{props.title}</h3>{/if}
  <div class="metric-content">
    <div class="metric-values">
      {#each props.rows as row, index (`${row.label}:${index}`)}
        <div class="metric-row">
          <span class="row-label">{row.label}</span>
          <span class="value-line">
            <span class="row-value">{fieldText(row.valueField)}</span>
            {#if row.unit}<span class="unit">{row.unit}</span>{/if}
          </span>
          {#if row.changes?.length}
            <div class="changes">
              {#each row.changes as change, changeIndex (`${change.label}:${changeIndex}`)}
                {@const raw = fieldValue(change.field, data)}
                {@const tone = toneClass(change.tone, raw)}
                <span class:positive={tone === 'positive'} class:negative={tone === 'negative'} class="change">
                  <span class="change-label">{change.label}</span>
                  <span>{changeText(change.field, change.tone)}</span>
                </span>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
    {#if props.progress}
      <ProgressRing value={progressValue} label={props.progress.label ?? '完成率'} />
    {/if}
  </div>
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
  .metric-content {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }
  .metric-values {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: 8px;
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
  .activity-progress {
    position: relative;
    justify-content: flex-start;
    padding-left: 58px;
  }
  .summary {
    text-align: center;
  }
  .summary .metric-content {
    width: 100%;
  }
  .summary .metric-values {
    width: 100%;
    flex-direction: row;
    gap: 12px;
  }
  .summary .metric-row {
    min-width: 0;
    flex: 1;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 8px;
    padding: 14px 8px 9px;
    background: #fff;
    border-radius: 8px;
  }
  .summary h3 {
    margin-bottom: 0.75rem;
    color: #08359e;
    font-size: 1.125rem;
    font-weight: 700;
    text-align: left;
  }
  .summary .row-label {
    color: #0f1a4d;
    font-size: 1.125rem;
  }
  .summary .value-line {
    align-items: center;
    flex-direction: column;
    gap: 2px;
  }
  .summary .unit {
    font-size: 13px;
  }
  .activity-progress .metric-row {
    align-items: flex-start;
    flex-direction: column;
  }
  .activity-progress::before {
    position: absolute;
    top: 12px;
    bottom: 12px;
    left: 4px;
    width: 40px;
    border-radius: 20px 8px 20px 8px;
    background: linear-gradient(160deg, #d7e7ff, #eef2ff 55%, #dcdfff);
    content: '';
  }
  .value-line {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
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
  .unit {
    color: #0f1a4d;
    font-size: 14px;
    font-weight: 500;
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
