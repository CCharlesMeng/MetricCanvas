<script lang="ts">
  import type { FieldBinding, MetricCardProps } from '@metriccanvas/page';
  import type { MetricDataSlots } from '../../shared/component-data';
  import { fieldValue, resolveField } from '../../shared/component-data';
  import { formatValue, valuePolarity } from '../../shared/value-format';
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

{#snippet metricRows(rows: MetricCardProps['rows'])}
  <div class="metric-values">
    {#each rows as row, index (`${row.label}:${index}`)}
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
                <span class="change-value">
                  {#if props.showTrendArrows && tone}
                    <span
                      class:up={tone === 'positive'}
                      class:down={tone === 'negative'}
                      class="trend-arrow"
                      aria-hidden="true"
                    >{tone === 'positive' ? '↑' : '↓'}</span>
                  {/if}
                  <span>{changeText(change.field, change.tone)}{#if change.unit}<span class="change-unit">{change.unit}</span>{/if}</span>
                </span>
              </span>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/snippet}

{#snippet metricPanel(title: string | undefined, rows: MetricCardProps['rows'] | undefined)}
  <section class="metric-panel">
    {#if title}<h3>{title}</h3>{/if}
    {#if rows}
      {@render metricRows(rows)}
    {:else}
      <div class="metric-values placeholder-values" aria-label={`${title ?? '指标'}数据待补充`}>
        <div class="metric-row">
          <span class="row-label">年累计</span><span class="row-value">—</span>
          <span class="change"><span class="change-label">同比</span>—</span>
        </div>
        <div class="metric-row">
          <span class="row-label">本月</span><span class="row-value">—</span>
          <span class="change"><span class="change-label">环比</span>—</span>
        </div>
      </div>
    {/if}
  </section>
{/snippet}

<div
  class:activity-progress={props.variant === 'activityProgress'}
  class:summary={props.variant === 'summary'}
  class:compact-summary={props.variant === 'compactSummary'}
  class:dual-summary={props.variant === 'dualSummary'}
  class:compact-strip={props.variant === 'compactStrip'}
  class:compact-stack={props.variant === 'compactStack'}
  class:two-column-panels={props.variant === 'dualSummary' && props.panelLayout === 'twoColumn'}
  class="metric-card"
>
  {#if props.variant === 'compactSummary' || props.variant === 'dualSummary' || props.variant === 'compactStrip' || props.variant === 'compactStack'}
    {@render metricPanel(props.title, props.rows)}
    {#if props.variant === 'dualSummary'}
      {@render metricPanel(props.secondaryTitle, props.secondaryRows)}
    {/if}
  {:else}
    {#if props.title}<h3>{props.title}</h3>{/if}
    <div class="metric-content">
      {@render metricRows(props.rows)}
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
  {/if}
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
  .compact-summary,
  .dual-summary,
  .compact-strip,
  .compact-stack {
    justify-content: flex-start;
    height: auto;
    gap: 8px;
    container-type: inline-size;
  }
  .compact-strip {
    --mc-compact-summary-flow: column;
    --mc-compact-summary-row-columns: minmax(0, 1fr);
    --mc-metric-panel-min-height: 0;
  }
  .compact-stack {
    --mc-compact-summary-flow: row;
    --mc-compact-summary-row-columns: minmax(0, 1fr);
    --mc-metric-panel-min-height: 0;
  }
  .dual-summary.two-column-panels {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 6px;
  }
  /* 面板表面经 --mc-metric-panel-* 可被页面布局形态覆写,缺省值即报表形态
     的既有观感;看板形态需要的是白底中性描边,不是报表的淡蓝内容区。 */
  .metric-panel {
    box-sizing: border-box;
    width: 100%;
    min-height: var(--mc-metric-panel-min-height, 136px);
    padding: var(--mc-metric-panel-padding, 10px 12px);
    overflow: visible;
    background: var(--mc-metric-panel-surface, var(--mc-color-surface-subtle, #f1f4ff));
    /* 两档形态取值不同的只有宽度(看板形态无边框),色两档同为报表内容区描边色,
       因此色不设量;只把色改透明达不到「无边框」,会留下 1px 的占位。 */
    border: var(--mc-metric-panel-border-width, 1px) solid
      var(--mc-color-report-content-frame, #d4d5ff);
    border-radius: var(--mc-metric-panel-radius, var(--mc-radius-report-content, 12px));
  }
  .metric-panel h3 {
    margin: 0 0 12px;
    color: var(--mc-card-title-color, var(--mc-color-text-strong, #0f1a4d));
    font-size: var(--mc-card-title-font-size, 18px);
    font-weight: var(--mc-card-title-font-weight, 400);
    line-height: var(--mc-card-title-line-height, 25px);
    text-align: left;
  }
  .metric-panel .metric-values {
    display: grid;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: var(--mc-compact-summary-flow, row);
    gap: 0;
  }
  .metric-panel .metric-row {
    display: grid;
    min-height: 40px;
    grid-template-columns: var(
      --mc-compact-summary-row-columns,
      auto minmax(0, 1fr) auto
    );
    align-items: baseline;
    gap: 6px;
  }
  .compact-strip .metric-row,
  .compact-stack .metric-row {
    align-content: start;
    gap: 2px;
  }
  @media (max-width: 760px) {
    .compact-strip {
      --mc-compact-summary-flow: row;
    }
  }
  /* 指标行的三个排版量(标签 / 大数字 / 单位)两档形态取值不同,
     经 --mc-metric-* 下发;缺省值即报表形态的既有观感。 */
  .metric-panel .row-label {
    color: var(--mc-metric-label-color, #505a84);
    font-size: var(--mc-metric-label-font-size, 16px);
    font-weight: 400;
    line-height: var(--mc-metric-label-line-height, 22px);
    white-space: nowrap;
  }
  .metric-panel .value-line {
    min-width: 0;
    gap: 0;
    white-space: nowrap;
  }
  .metric-panel .row-value {
    color: var(--mc-metric-value-color, var(--mc-color-text-strong, #0f1a4d));
    font-size: var(--mc-metric-value-font-size, 20px);
    font-weight: var(--mc-metric-value-font-weight, 500);
    line-height: var(--mc-metric-value-line-height, 40px);
  }
  .metric-panel .unit {
    color: var(--mc-metric-unit-color, #0f1a4d);
    font-size: var(--mc-metric-unit-font-size, 16px);
    font-weight: var(--mc-metric-unit-font-weight, 500);
    line-height: var(--mc-metric-unit-line-height, 40px);
  }
  .metric-panel .changes {
    display: block;
    min-width: 0;
  }
  .metric-panel .change {
    display: inline-flex;
    gap: 4px;
    font-size: 18px;
    font-weight: 500;
    line-height: 22px;
    white-space: nowrap;
  }
  .metric-panel .change-label {
    color: #505a84;
    font-size: 16px;
    font-weight: 400;
  }
  .compact-strip .change {
    align-items: baseline;
    flex-direction: row;
    gap: 2px;
    font-size: 12px;
    line-height: 18px;
    white-space: nowrap;
  }
  .compact-strip .change-label {
    font-size: 11px;
    line-height: 18px;
  }
  .metric-panel .placeholder-values .row-value,
  .metric-panel .placeholder-values .change {
    color: var(--mc-color-muted, #71717a);
  }
  @container (max-width: 230px) {
    .metric-panel {
      padding-right: 7px;
      padding-left: 7px;
    }
    .metric-panel .metric-row {
      gap: 2px;
    }
    .metric-panel .metric-values {
      grid-auto-flow: row;
    }
    .metric-panel .row-label {
      font-size: 13px;
    }
    .metric-panel .row-value {
      font-size: 17px;
    }
    .metric-panel .unit,
    .metric-panel .change-label {
      font-size: 13px;
    }
    .metric-panel .change {
      gap: 2px;
      font-size: 12px;
    }
    .metric-panel .change-label {
      margin-right: 0;
    }
  }
  @media (max-width: 760px) {
    .dual-summary.two-column-panels {
      grid-template-columns: minmax(0, 1fr);
    }
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
    min-height: 200px;
    height: auto;
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
    container-type: inline-size;
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
    white-space: nowrap;
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
  @container (max-width: 275px) {
    .summary .metric-content {
      padding-left: 7px;
      padding-right: 7px;
    }
    .summary .metric-values {
      padding-right: 0;
    }
    .summary .metric-row {
      margin-right: 6px;
      padding-left: 8px;
    }
    .summary .row-label {
      font-size: 15px;
    }
    .summary .row-value {
      font-size: 21px;
    }
    .summary .unit,
    .summary .change {
      font-size: 13px;
    }
    .summary .changes {
      min-width: 0;
      max-width: 100%;
      gap: 0;
    }
    .summary .change {
      max-width: 100%;
      overflow-wrap: anywhere;
      white-space: normal;
    }
  }
  @container (max-width: 235px) {
    .summary .metric-content {
      padding-right: 4px;
      padding-left: 4px;
    }
    .summary .metric-row {
      margin-right: 4px;
      padding-left: 4px;
    }
    .summary .row-value {
      font-size: 18px;
    }
    .summary .unit,
    .summary .change {
      font-size: 12px;
    }
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
  @media (max-width: 760px) {
    .activity-progress {
      height: 174px;
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
  .change-value {
    display: inline-flex;
    align-items: baseline;
    gap: 2px;
  }
  .trend-arrow {
    font-size: 0.9em;
    font-weight: 700;
    line-height: 1;
  }
  .positive {
    color: var(--mc-color-positive, #5cb300);
  }
  .negative {
    color: var(--mc-color-negative, #f21e1e);
  }
</style>
