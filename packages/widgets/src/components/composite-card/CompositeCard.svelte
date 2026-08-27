<script lang="ts">
  import type { Snippet } from 'svelte';
  import { compositeCardFlow } from './flow';
  import opportunityIconUrl from '../../assets/ioc-card-title-opportunity.svg?inline';
  import managementIconUrl from '../../assets/ioc-card-title-tiered-management.svg?inline';
  import reviewIconUrl from '../../assets/ioc-card-title-review.svg?inline';

  const titleIcons = {
    opportunity: opportunityIconUrl,
    tieredManagement: managementIconUrl,
    review: reviewIconUrl
  } as const;

  /**
   * 组合卡(纯呈现):卡壳、可选标题、卡内 12 列自动流与派生的分隔线。
   * 子组件由统一运行时按类型分发,本组件只按落位下发单元格——它不认识
   * 子组件类型,也不认识数据槽。
   */
  interface Props {
    title?: string;
    titleIcon?: keyof typeof titleIcons;
    variant?: 'compact';
    /** 子组件声明的 `layout.span`,数组顺序即自动流顺序。 */
    spans: readonly number[];
    /** 相邻子组件之间是否分隔;位置由自动流落位派生,不由声明给出。 */
    dividers?: boolean;
    /** 按落位渲染第 index 个子组件。 */
    children: Snippet<[number]>;
  }

  let { title, titleIcon, variant, spans, dividers, children }: Props = $props();

  const slots = $derived(compositeCardFlow(spans));
</script>

<div class:compact={variant === 'compact'} class="composite-card">
  {#if title}<h3>
    {#if titleIcon}<img src={titleIcons[titleIcon]} alt="" aria-hidden="true" />{/if}
    <span>{title}</span>
  </h3>{/if}
  <div class:with-dividers={dividers === true} class="composite-grid">
    {#each slots as slot, index}
      <div
        class:divider-above={dividers === true && slot.precededByRow}
        class:divider-before={dividers === true && slot.precededInRow}
        class:bleed-start={slot.precededInRow}
        class:bleed-end={slot.followedInRow}
        class="composite-slot"
        style={`grid-column: span ${slot.span};`}
      >
        {@render children(index)}
      </div>
    {/each}
  </div>
</div>

<style>
  .composite-card {
    /* 卡内行距与列距同取卡壳自己的间距:分隔线画在它的中线上,
       所以线位与间距是同一个量,不能各写一份。 */
    --composite-card-gap: 12px;

    box-sizing: border-box;
    display: flex;
    min-width: 0;
    min-height: 280px;
    flex: 1;
    flex-direction: column;
    gap: var(--composite-card-gap);
    padding: 13px 20px 16px 16px;
    background: var(--mc-color-surface, #fff);
    border-radius: var(--mc-radius-section, 16px);

    /* 卡里不套卡:指标面板、仪表与信息面板各自是「白底 + 圆角 + 自己的内边距」,
       套进卡壳就成了两层卡面。这里只在卡内作用域改写它们**已有**的量,不改它们
       的文件,也不动形态定义点。白名单里另两种(饼图、分类明细)本来就没有自己
       的表面,因此这份清单与白名单的对应关系由测试钉住。 */
    --mc-metric-panel-surface: transparent;
    --mc-metric-panel-padding: 0;
    --mc-metric-panel-border-width: 0;
    --mc-metric-panel-radius: 0;
    --mc-gauge-surface: transparent;
    --mc-gauge-padding: 0;
    --mc-gauge-border: 0;
    --mc-gauge-radius: 0;
    --mc-key-value-panel-surface: transparent;
    --mc-key-value-panel-padding: 0;
    --mc-key-value-panel-radius: 0;
  }
  .compact {
    height: 280px;
    min-height: 280px;
  }
  .compact > h3 {
    text-shadow: 0 1px 5px rgb(0 0 0 / 0.05);
  }
  h3 {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 0;
    color: var(--mc-card-title-color, #191919);
    font-size: var(--mc-card-title-font-size, 16px);
    font-weight: var(--mc-card-title-font-weight, 500);
    line-height: var(--mc-card-title-line-height, 24px);
  }
  h3 img {
    width: 20px;
    height: 20px;
    flex: none;
  }
  .composite-grid {
    /* 满宽 compactSummary 的指标组按设计横排；窄卡由 MetricCard 自己的
       容器查询退回纵排。量只在组合卡作用域下发，不影响报表顶层指标卡。 */
    --mc-compact-summary-flow: column;
    --mc-compact-summary-row-columns: minmax(0, 1fr);
    --mc-metric-panel-min-height: 60px;
    --mc-gauge-dial-size: 64px;

    display: grid;
    min-width: 0;
    flex: 1;
    align-items: stretch;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    /* 行下限:绘图型子组件没有固有高度(ECharts 容器是 `flex: 1`),行按内容
       定高就会把它们压成零高。分区单元格靠 `.cell`/`.chart-cell` 的 min-height
       解决同一件事,卡内的对应物就是这一行。取 90px——设计源里组合卡第一行的
       竖分隔线正是 `h-[90px]`,行装得下就照内容长。 */
    grid-auto-rows: minmax(60px, auto);
    gap: var(--composite-card-gap);
  }
  .composite-slot {
    position: relative;
    display: flex;
    min-width: 0;
    flex-direction: column;
  }
  /* 横线画在行边界上,即上一行与本行之间那道间距的中线。行内有邻居时向那一侧
     跨过列间距,相邻单元格的两段因此连成一条,而不是被列间距断开。 */
  .composite-slot.divider-above::before {
    position: absolute;
    top: calc(-1 * var(--composite-card-gap) / 2);
    right: 0;
    left: 0;
    border-top: 1px dashed var(--mc-cell-divider-color, #dcdbdb);
    content: '';
    pointer-events: none;
  }
  .composite-slot.divider-above.bleed-start::before {
    left: calc(-1 * var(--composite-card-gap) / 2);
  }
  .composite-slot.divider-above.bleed-end::before {
    right: calc(-1 * var(--composite-card-gap) / 2);
  }
  /* 竖线画在同一行相邻子组件之间那道间距的中线上,高度即该行行高。 */
  .composite-slot.divider-before::after {
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc(-1 * var(--composite-card-gap) / 2);
    border-left: 1px dashed var(--mc-cell-divider-color, #dcdbdb);
    content: '';
    pointer-events: none;
  }

  /* 窄屏退化成单列:此时「同一行的邻居」不再存在,竖线无从分隔,横线改由
     DOM 相邻关系派生——分隔的语义仍是「相邻子组件之间」,只是行的定义变了。 */
  @media (max-width: 760px) {
    .composite-grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .composite-slot {
      grid-column: 1 / -1 !important;
    }
    .composite-slot.divider-before::after {
      display: none;
    }
    .composite-grid.with-dividers > .composite-slot:not(:first-child)::before {
      position: absolute;
      top: calc(-1 * var(--composite-card-gap) / 2);
      right: 0;
      left: 0;
      border-top: 1px dashed var(--mc-cell-divider-color, #dcdbdb);
      content: '';
      pointer-events: none;
    }
  }
</style>
