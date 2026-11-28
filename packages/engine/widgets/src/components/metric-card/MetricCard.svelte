<svelte:options css="injected" />
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { MetricCardProps, MetricCardRow, Row } from '@metriccanvas/page/internal';
  import { metricCardTipAnchor } from '@metriccanvas/page/internal';
  import type { MetricDataSlots } from '../../shared/component-data';
  import Skeleton from '../../shared/Skeleton.svelte';
  import { DEFAULT_NULL_TEXT } from '../../shared/value-format';
  import MetricCardActivityProgress from './MetricCardActivityProgress.svelte';
  import MetricCardPrimaryDetail from './MetricCardPrimaryDetail.svelte';
  import MetricCardRows from './MetricCardRows.svelte';
  import MetricCardSummary from './MetricCardSummary.svelte';
  import { resolveMetricProgress } from './metric-card-model';
  import ProgressRing from './ProgressRing.svelte';

  interface Props {
    /** 已解析的 main/compare/target 命名槽。 */
    data: MetricDataSlots;
    props: MetricCardProps;
    loading?: boolean;
    definitionTip?: Snippet<[string]>;
    rowDefinitionTip?: Snippet<[title: string, code: string]>;
    /** 屏幕呈现时启用加载骨架扫光。 */
    animate?: boolean;
    /** 只由声明了 link 的非空值触发。 */
    onlink?: (row: Row, event: MouseEvent) => void;
    linkHref?: (row: Row) => string | undefined;
    onaction?: (action: NonNullable<MetricCardRow['action']>) => void;
  }

  let {
    data,
    props,
    loading = false,
    animate: shimmer = true,
    definitionTip,
    rowDefinitionTip,
    onlink,
    linkHref,
    onaction
  }: Props = $props();

  const tipAnchor = $derived(definitionTip ? metricCardTipAnchor(props) : undefined);
  const titleAccessory = $derived(tipAnchor === 'title' ? definitionTip : undefined);
  const rowAccessory = $derived(tipAnchor === 'row' ? definitionTip : undefined);
  const progress = $derived(resolveMetricProgress(props.progress, data, loading));
  const isPanelVariant = $derived(
    props.variant === 'compactSummary' ||
      props.variant === 'dualSummary' ||
      props.variant === 'compactStrip' ||
      props.variant === 'compactStack'
  );
  const hasSecondaryPanel = $derived(Boolean(props.secondaryRows || props.secondaryTitle));
</script>

{#snippet pendingOrMissing()}
  {#if loading}<Skeleton width="2.25em" inline {shimmer} />{:else}{DEFAULT_NULL_TEXT}{/if}
{/snippet}

{#snippet heading(title: string | undefined, accessory?: Snippet<[string]>)}
  {#if title}
    {#if accessory && title.trim()}
      <h3 class="with-title-accessory"><span>{title}</span>{@render accessory(title)}</h3>
    {:else}
      <h3>{title}</h3>
    {/if}
  {/if}
{/snippet}

{#snippet metricPanel(title: string | undefined, rows: MetricCardProps['rows'] | undefined, primary = false)}
  <section class="metric-panel">
    {@render heading(title, primary ? titleAccessory : undefined)}
    {#if rows}
      <div class="metric-values">
        <MetricCardRows
          {rows}
          {data}
          {loading}
          {shimmer}
          showTrendArrows={props.showTrendArrows}
          accessory={primary ? rowAccessory : undefined}
          {rowDefinitionTip}
          {onlink}
          {linkHref}
          {onaction}
        />
      </div>
    {:else}
      <div class="metric-values placeholder-values" aria-label={`${title ?? '指标'}数据待补充`}>
        <div class="metric-row">
          <span class="row-value">{@render pendingOrMissing()}</span>
        </div>
      </div>
    {/if}
  </section>
{/snippet}

{#snippet secondaryMetricPanel()}
  {@render metricPanel(props.secondaryTitle, props.secondaryRows)}
{/snippet}

{#if props.variant === 'summary'}
  <MetricCardSummary
    {data}
    {props}
    {loading}
    {shimmer}
    {titleAccessory}
    {rowAccessory}
    {rowDefinitionTip}
    {progress}
    secondaryPanel={hasSecondaryPanel ? secondaryMetricPanel : undefined}
    {onlink}
    {linkHref}
    {onaction}
  />
{:else if props.variant === 'activityProgress'}
  <MetricCardActivityProgress
    {data}
    {props}
    {loading}
    {shimmer}
    {titleAccessory}
    {rowAccessory}
    {rowDefinitionTip}
    {progress}
    secondaryPanel={hasSecondaryPanel ? secondaryMetricPanel : undefined}
    {onlink}
    {linkHref}
    {onaction}
  />
{:else if props.variant === 'primaryDetail'}
  <MetricCardPrimaryDetail
    {data}
    {props}
    {loading}
    {shimmer}
    {titleAccessory}
    {rowAccessory}
    {rowDefinitionTip}
    {progress}
    {onlink}
    {linkHref}
    {onaction}
  />
{:else}
  <div
    class:compact-summary={props.variant === 'compactSummary'}
    class:dual-summary={props.variant === 'dualSummary'}
    class:compact-strip={props.variant === 'compactStrip'}
    class:compact-stack={props.variant === 'compactStack'}
    class:two-column-panels={props.variant === 'dualSummary' && props.panelLayout === 'twoColumn'}
    class="metric-card"
  >
    {#if isPanelVariant}
      {@render metricPanel(props.title, props.rows, true)}
      {#if props.variant === 'dualSummary' || hasSecondaryPanel}
        {@render metricPanel(props.secondaryTitle, props.secondaryRows)}
      {/if}
      {#if progress}
        <div class="progress-slot">
          <ProgressRing
            loading={progress.loading}
            {shimmer}
            value={progress.value}
            format={progress.format}
            missingText={progress.missingText}
            ringPercent={progress.ringPercent}
            label={progress.label}
          />
        </div>
      {/if}
    {:else}
      {@render heading(props.title, titleAccessory)}
      <div class="metric-content">
        <div class="metric-values">
          <MetricCardRows
            rows={props.rows}
            {data}
            {loading}
            {shimmer}
            showTrendArrows={props.showTrendArrows}
            accessory={rowAccessory}
            {rowDefinitionTip}
            {onlink}
            {linkHref}
            {onaction}
          />
        </div>
        {#if progress}
          <div class="progress-slot">
            <ProgressRing
              loading={progress.loading}
              {shimmer}
              format={progress.format}
              value={progress.value}
              missingText={progress.missingText}
              ringPercent={progress.ringPercent}
              label={progress.label}
            />
          </div>
        {/if}
      </div>
      {#if hasSecondaryPanel}
        {@render metricPanel(props.secondaryTitle, props.secondaryRows)}
      {/if}
    {/if}
  </div>
{/if}

<style>
  .with-title-accessory {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .with-title-accessory span {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .metric-card {
    box-sizing: border-box;
    display: flex;
    width: 100%;
    min-width: 0;
    align-items: stretch;
    justify-content: center;
    flex-direction: column;
    gap: 0.45rem;
    height: 100%;
  }
  .metric-card:not(.compact-summary):not(.dual-summary):not(.compact-strip):not(.compact-stack) {
    padding: var(--mc-metric-card-padding, 0);
    border: var(--mc-metric-card-border, 0);
    border-radius: var(--mc-metric-card-radius, 0);
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
    --mc-compact-summary-flow: row;
    --mc-compact-summary-row-columns: minmax(0, 1fr);
    --mc-metric-panel-min-height: 0;
  }
  .compact-stack {
    flex: 1;
    --mc-compact-summary-flow: row;
    --mc-compact-summary-row-columns: minmax(0, 1fr);
    --mc-metric-panel-min-height: 0;
  }
  .compact-stack > .metric-panel:only-child {
    flex: 1;
  }
  .compact-strip,
  .compact-stack {
    text-shadow: 0 1px 5px rgb(0 0 0 / 0.05);
  }
  .dual-summary.two-column-panels {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
    gap: 12px;
    margin-top: 6px;
  }
  /* 有效内容统一使用白色表面;布局形态可调整几何量,
     组合卡仍通过 --mc-metric-panel-surface 压平子面板。 */
  .metric-panel {
    box-sizing: border-box;
    width: 100%;
    min-height: var(--mc-metric-panel-min-height, 136px);
    padding: var(--mc-metric-panel-padding, 10px 12px);
    overflow: visible;
    background: var(--mc-metric-panel-surface, var(--mc-color-surface, #fff));
    /* 灰底看板由画布区分卡面，白底容器下发浅灰描边；Report保留内容区描边色。
       无边框时宽度必须为0，避免透明边框仍占位。 */
    border: var(--mc-metric-panel-border-width, 1px) solid
      var(--mc-metric-panel-border-color, var(--mc-color-report-content-frame, #d4d5ff));
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
  .metric-panel :global(.metric-row) {
    display: grid;
    min-height: 40px;
    grid-template-columns: var(
      --mc-compact-summary-row-columns,
      auto minmax(0, 1fr) auto
    );
    align-items: baseline;
    gap: 6px;
  }
  .compact-strip :global(.metric-row),
  .compact-stack :global(.metric-row) {
    align-content: start;
    gap: 2px;
  }
  .compact-strip .metric-panel .metric-values {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    justify-content: space-between;
    gap: 20px;
  }
  .compact-strip .metric-panel :global(.metric-row),
  .compact-stack .metric-panel :global(.metric-row) {
    display: flex;
    min-width: 0;
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
  }
  .compact-strip .metric-panel :global(.metric-row) {
    position: relative;
    /* 两个指标始终等分可用宽度，分隔线才会稳定落在中轴，
       不随两侧文案和数值宽度漂移。 */
    flex: 1 1 0;
  }
  .compact-strip .metric-panel :global(.metric-row + .metric-row::before) {
    position: absolute;
    top: 0;
    bottom: 0;
    left: -10px;
    border-left: 1px dashed #dcdbdb;
    content: '';
  }
  .compact-stack .metric-panel :global(.metric-row + .metric-row) {
    margin-top: 20px;
  }
  .compact-strip .metric-panel :global(.row-label),
  .compact-stack .metric-panel :global(.row-label) {
    font-size: 14px;
    line-height: 20px;
  }
  .compact-strip .metric-panel :global(.value-line),
  .compact-stack .metric-panel :global(.value-line) {
    margin-top: 4px;
  }
  .compact-strip .metric-panel :global(.row-value),
  .compact-stack .metric-panel :global(.row-value) {
    font-size: 28px;
    font-weight: 400;
    line-height: 34px;
  }
  .compact-strip .metric-panel :global(.unit),
  .compact-stack .metric-panel :global(.unit) {
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
  }
  .compact-strip .metric-panel :global(.changes) {
    margin-top: 12px;
  }
  .compact-strip .metric-panel :global(.row-context) {
    margin-right: 4px;
    color: #595959;
    font-size: 12px;
    font-weight: 400;
    line-height: 22px;
  }
  .compact-stack .metric-panel :global(.changes) {
    margin-top: 12px;
  }
  .compact-stack :global(.change) {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    font-size: 14px;
    font-weight: 400;
    line-height: 22px;
  }
  .compact-stack :global(.change-label) {
    margin: 0;
    color: #595959;
    font-size: 12px;
    line-height: 22px;
  }
  /* 指标行的三个排版量(标签 / 大数字 / 单位)两档形态取值不同,
     经 --mc-metric-* 下发;缺省值即报表形态的既有观感。 */
  .metric-panel :global(.row-label) {
    color: var(--mc-metric-label-color, #505a84);
    font-size: var(--mc-metric-label-font-size, 16px);
    font-weight: 400;
    line-height: var(--mc-metric-label-line-height, 22px);
    white-space: nowrap;
  }
  .metric-panel :global(.value-line) {
    min-width: 0;
    gap: 0;
    white-space: nowrap;
  }
  .metric-panel :global(.row-value) {
    color: var(--mc-metric-value-color, var(--mc-color-text-strong, #0f1a4d));
    font-size: var(--mc-metric-value-font-size, 20px);
    font-weight: var(--mc-metric-value-font-weight, 500);
    line-height: var(--mc-metric-value-line-height, 40px);
  }
  .metric-panel :global(.unit) {
    color: var(--mc-metric-unit-color, #0f1a4d);
    font-size: var(--mc-metric-unit-font-size, 16px);
    font-weight: var(--mc-metric-unit-font-weight, 500);
    line-height: var(--mc-metric-unit-line-height, 40px);
  }
  .metric-panel :global(.changes) {
    display: block;
    min-width: 0;
  }
  .metric-panel :global(.change) {
    display: inline-flex;
    gap: 4px;
    font-size: 18px;
    font-weight: 500;
    line-height: 22px;
    white-space: nowrap;
  }
  .metric-panel :global(.change-label) {
    color: #505a84;
    font-size: 16px;
    font-weight: 400;
  }
  .compact-strip :global(.change) {
    align-items: center;
    flex-direction: row;
    gap: 2px;
    font-size: 12px;
    line-height: 22px;
    white-space: nowrap;
  }
  .compact-strip :global(.change-label) {
    color: #595959;
    font-size: 12px;
    line-height: 22px;
  }
  .compact-strip :global(.change-value) {
    display: inline-flex;
    min-width: 48px;
    height: 22px;
    box-sizing: border-box;
    align-items: center;
    justify-content: center;
    padding: 0 9px 0 5px;
    border-radius: 4px;
  }
  .compact-strip :global(.change.positive .change-value) {
    color: #3cc6c1;
    background: rgb(60 198 193 / 0.1);
  }
  .compact-strip :global(.change.negative .change-value) {
    color: #f23030;
    background: rgb(242 48 48 / 0.08);
  }
  .metric-panel .placeholder-values .row-value {
    color: var(--mc-color-muted, #71717a);
  }
  /* responsive-contract: metric-panel-local-compact */
  @container (max-width: 230px) {
    .metric-panel {
      padding-right: 7px;
      padding-left: 7px;
    }
    .metric-panel :global(.metric-row) {
      gap: 2px;
    }
    .metric-panel .metric-values {
      grid-auto-flow: row;
    }
    .metric-panel :global(.row-label) {
      font-size: 13px;
    }
    .metric-panel :global(.row-value) {
      font-size: 17px;
    }
    .metric-panel :global(.unit),
    .metric-panel :global(.change-label) {
      font-size: 13px;
    }
    .metric-panel :global(.change) {
      gap: 2px;
      font-size: 12px;
    }
    .metric-panel :global(.change-label) {
      margin-right: 0;
    }
  }
  /* responsive-contract: metric-compact-stack-local-type */
  @container (max-width: 230px) {
    .compact-stack .metric-panel :global(.row-label) {
      font-size: 14px;
    }
    .compact-stack .metric-panel :global(.row-value) {
      font-size: 28px;
    }
    .compact-stack .metric-panel :global(.unit) {
      font-size: 14px;
    }
  }
</style>
