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
                  <span>{changeText(change.field, change.tone)}{#if change.unit}<span class="change-unit">{change.unit}</span>{/if}</span>
                </span>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
    {#if props.progress}
      <div class="progress-slot">
        <ProgressRing
          value={progressValue}
          ringPercent={props.progress.ringPercent}
          label={props.progress.label ?? '完成率'}
        />
      </div>
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
  .progress-slot {
    flex: 0 0 auto;
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
    container-type: inline-size;
    justify-content: flex-start;
    gap: 0;
    height: 164px;
    padding: 17px 0 38px 17px;
    background: var(--mc-color-surface, #fff);
    border-radius: 12px;
  }
  .summary {
    height: 200px;
    justify-content: flex-start;
    gap: 0;
    padding: 11px 17px 16px;
    background-color: transparent;
    background-image: var(--mc-section-gradient, none);
    background-repeat: no-repeat;
    background-position: center;
    background-size: 100% 100%;
    border-radius: 16px;
    text-align: left;
  }
  .summary .metric-content {
    width: 100%;
    height: 128px;
    padding: 15px 0 13px 12px;
    background: var(--mc-color-surface, #fff);
    border-radius: 12px;
  }
  .summary .metric-values {
    width: 100%;
    flex-direction: row;
    gap: 0;
    padding-right: 12px;
  }
  .summary .metric-row {
    min-width: 0;
    flex: 1;
    align-items: flex-start;
    justify-content: flex-start;
    flex-direction: column;
    flex-wrap: nowrap;
    gap: 0;
    height: 100px;
    margin-right: 12px;
    padding: 14px 0 9px 13px;
    background: var(--mc-color-surface-subtle, #f1f4ff);
    border-radius: 8px;
  }
  .summary .metric-row:last-child {
    margin-right: 0;
  }
  .summary h3 {
    margin: 0 0 7px;
    color: var(--mc-color-primary, #08359e);
    font-size: 24px;
    font-weight: 600;
    line-height: 38px;
    text-align: center;
  }
  .summary .row-label {
    color: #0f1a4d;
    font-size: 18px;
    font-weight: 400;
    line-height: 25px;
    margin-bottom: 9px;
  }
  .summary .value-line {
    align-items: baseline;
    flex-direction: row;
    gap: 0;
  }
  .summary .row-value {
    font-size: 26px;
    font-weight: 500;
    line-height: 43px;
  }
  .summary .unit {
    font-size: 18px;
    font-weight: 500;
    line-height: 43px;
  }
  .activity-progress h3 {
    margin: 0 0 1px;
    color: #0f1a4d;
    font-size: 18px;
    font-weight: 400;
    line-height: 25px;
  }
  .activity-progress .metric-content {
    width: 100%;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0;
    margin-top: 26px;
    padding-right: calc(clamp(44px, 16.715%, 59px) - 6px);
  }
  .activity-progress .metric-values {
    flex: 0 0 125px;
    gap: 0;
  }
  .activity-progress .progress-slot {
    transform: none;
  }
  .activity-progress .metric-row {
    align-items: flex-start;
    flex-direction: column;
    flex-wrap: nowrap;
    gap: 0;
  }
  .activity-progress .row-label {
    position: absolute;
    top: 17px;
    left: 17px;
    color: #0f1a4d;
    font-size: 18px;
    font-weight: 400;
    line-height: 25px;
    white-space: nowrap;
  }
  .activity-progress .value-line {
    margin: 17px 0 5px;
    gap: 0;
  }
  .activity-progress .row-value {
    font-size: 26px;
    font-weight: 500;
    line-height: 43px;
  }
  .activity-progress .unit {
    font-size: 18px;
    font-weight: 500;
    line-height: 43px;
  }
  .activity-progress .changes {
    gap: 0;
    line-height: 22px;
  }
  .activity-progress .change {
    font-size: 18px;
    line-height: 22px;
    white-space: nowrap;
  }
  .activity-progress .change-label {
    margin-right: 4px;
    color: #0f1a4d;
  }
  @container (max-width: 260px) {
    .activity-progress .metric-content {
      padding-right: 4px;
    }
    .activity-progress .metric-values {
      flex-basis: 88px;
    }
    .activity-progress .row-value {
      font-size: 22px;
      line-height: 36px;
    }
    .activity-progress .unit,
    .activity-progress .change {
      font-size: 13px;
      line-height: 18px;
    }
    .activity-progress .progress-slot {
      --progress-ring-size: 80px;
      --progress-ring-height: 81px;
      --progress-ring-chart-size: 70px;
      --progress-ring-inset: 5px;
      --progress-ring-number-top: 35px;
      --progress-ring-value-font-size: 20px;
      --progress-ring-value-line-height: 20px;
      --progress-ring-percent-font-size: 9px;
      --progress-ring-label-bottom: 12px;
      --progress-ring-label-font-size: 13px;
      --progress-ring-label-line-height: 17px;
    }
  }
  .change-unit {
    margin-left: 2px;
    color: inherit;
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
