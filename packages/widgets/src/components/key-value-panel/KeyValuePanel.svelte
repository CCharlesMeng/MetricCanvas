<script lang="ts">
  import type { KeyValuePanelProps } from '@metriccanvas/page';
  import type { MainDataSlots } from '../../shared/component-data';
  import { fieldValue, resolveField, semanticHtmlFieldPresentation } from '../../shared/component-data';
  import SemanticHtml from '../../shared/SemanticHtml.svelte';
  import { formatValue } from '../../shared/value-format';
  import rewardIconUrl from '../../assets/ioc-card-title-reward.svg?inline';
  import medalIconUrl from '../../assets/ioc-medal.svg?inline';
  import penaltyCardIconUrl from '../../assets/ioc-penalty-card.svg?inline';

  const titleIcons = { reward: rewardIconUrl } as const;
  const itemIcons = {
    goldMedal: { url: medalIconUrl, color: '#d6af36' },
    silverMedal: { url: medalIconUrl, color: '#a7a7ad' },
    redCard: { url: penaltyCardIconUrl, color: '#d92d20' },
    yellowCard: { url: penaltyCardIconUrl, color: '#f5c518' }
  } as const;

  /**
   * 信息面板(纯渲染):把一条记录的若干字段按「标签：取值」逐项列出。
   * 只读第一行——它表达的是一条记录,不是一个行集。
   */
  interface Props {
    data: MainDataSlots;
    props: KeyValuePanelProps;
  }

  let { data, props }: Props = $props();

  const columns = $derived(props.columns ?? 3);
</script>

{#snippet entries()}
  <dl style:--key-value-columns={columns}>
    {#each props.items as item (item.label)}
      {@const resolved = resolveField(item.field, data)}
      {@const value = fieldValue(item.field, data)}
      {@const semantic = semanticHtmlFieldPresentation(resolved, value)}
      <div class="entry">
        <dt>
          {#if item.icon}
            {@const icon = itemIcons[item.icon]}
            <span
              class="item-icon"
              style={`--item-icon-mask:url("${icon.url}");--item-icon-color:${icon.color};`}
              aria-hidden="true"
            ></span>
          {/if}
          <span>{item.label}</span>
        </dt>
        <dd>
          {#if semantic}
            <SemanticHtml source={semantic.source} format={semantic.format} inline />
          {:else}
            {formatValue(value, resolved.format)}
          {/if}
          {#if item.unit}<span class="unit">{item.unit}</span>{/if}
        </dd>
      </div>
    {/each}
  </dl>
{/snippet}

<div
  class:counter-strip={props.variant === 'counterStrip'}
  class:detail-summary={props.variant === 'detailSummary'}
  class:detail-norm-matrix={props.variant === 'detailNormMatrix'}
  class="key-value-panel"
>
  {#if props.title}<h3>
    {#if props.titleIcon}<img src={titleIcons[props.titleIcon]} alt="" aria-hidden="true" />{/if}
    <span>{props.title}</span>
  </h3>{/if}
  {#if props.variant === 'detailSummary'}
    <div class="summary-body">{@render entries()}</div>
  {:else}
    {@render entries()}
  {/if}
</div>

<style>
  /* 表面经 --mc-key-value-panel-* 下发,与 --mc-metric-panel-* / --mc-gauge-*
     同一族做法;缺省值即两档形态共有的既有观感(白底 16px 圆角 19px 内边距),
     因此这三个量不进布局形态定义点。走 token 是为了「卡里不套卡」:放进组合卡
     时由卡内作用域压平,组件本身不认识自己被谁装着。 */
  .key-value-panel {
    box-sizing: border-box;
    width: 100%;
    flex: 1;
    min-width: 0;
    padding: var(--mc-key-value-panel-padding, 19px);
    background: var(--mc-key-value-panel-surface, var(--mc-color-surface, #fff));
    border-radius: var(--mc-key-value-panel-radius, var(--mc-radius-section, 16px));
  }
  h3 {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 0 0 12px;
    color: var(--mc-card-title-color, #121e3b);
    font-size: var(--mc-card-title-font-size, 20px);
    font-weight: var(--mc-card-title-font-weight, 600);
    line-height: var(--mc-card-title-line-height, 30px);
  }
  h3 img {
    width: 20px;
    height: 20px;
    flex: none;
  }
  dl {
    display: grid;
    grid-template-columns: repeat(var(--key-value-columns, 3), minmax(0, 1fr));
    gap: 12px 24px;
    margin: 0;
  }
  .entry {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
  }
  dt {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: none;
    color: #595959;
    font-size: 14px;
    line-height: 22px;
  }
  .item-icon {
    width: 12px;
    height: 12px;
    flex: none;
    background: var(--item-icon-color);
    -webkit-mask: var(--item-icon-mask) center / contain no-repeat;
    mask: var(--item-icon-mask) center / contain no-repeat;
  }
  dt::after {
    content: '：';
  }
  dd {
    min-width: 0;
    margin: 0;
    overflow-wrap: anywhere;
    color: #191919;
    font-size: 14px;
    line-height: 22px;
  }
  .counter-strip {
    text-shadow: 0 1px 5px rgb(0 0 0 / 0.05);
  }
  .counter-strip dl {
    width: 390px;
    max-width: 100%;
    grid-template-columns: repeat(4, minmax(0, 69px));
    justify-content: space-between;
    gap: 0;
  }
  .counter-strip .entry {
    width: 100%;
    max-width: 69px;
    align-items: center;
    flex-direction: column;
    gap: 2px;
    text-align: center;
  }
  .counter-strip dt::after {
    content: none;
  }
  .counter-strip dd {
    display: flex;
    align-items: baseline;
    justify-content: center;
    color: var(--mc-color-report-text, #191919);
    font-size: 28px;
    line-height: 34px;
  }
  .counter-strip dt {
    color: var(--mc-color-report-text, #191919);
    line-height: 20px;
  }
  .counter-strip .unit {
    margin-left: 2px;
    font-size: 14px;
    line-height: 20px;
  }
  .detail-summary {
    position: relative;
    box-sizing: border-box;
    display: flex;
    width: 100%;
    min-width: 0;
    height: 360px;
    flex: none;
    flex-direction: column;
    gap: 21px;
    padding: 16px 21px 43px;
    overflow: visible;
    background: #fff;
    border-radius: 16px;
  }
  .detail-summary > h3 {
    position: relative;
    z-index: 1;
    flex: none;
    margin: 0;
    color: #191919;
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
  }
  .summary-body {
    position: absolute;
    top: 50px;
    left: 22px;
    box-sizing: border-box;
    width: calc(100% - 46px);
    height: 284px;
    padding: 11px 0 17px 15px;
    overflow: hidden;
    color: #595959;
    background: rgb(0 0 0 / 0.03);
    border-radius: 8px;
    font-size: 14px;
    font-weight: 400;
    line-height: 32px;
  }
  .summary-body dl {
    display: block;
    width: 100%;
    margin: 0;
  }
  .summary-body .entry {
    display: flex;
    height: 32px;
    align-items: baseline;
    gap: 0;
    white-space: nowrap;
  }
  .summary-body dt,
  .summary-body dd {
    color: #595959;
    font-size: 14px;
    font-weight: 400;
    line-height: 32px;
  }
  .summary-body dt {
    gap: 0;
  }
  .summary-body dt::after {
    content: '：';
  }
  .detail-norm-matrix {
    box-sizing: border-box;
    width: 100%;
    min-height: 0;
    flex: none;
    padding: 0;
    background: transparent;
    border-radius: 0;
  }
  .detail-norm-matrix > h3 {
    margin: 0 0 12px 2px;
    color: #191919;
    font-size: 14px;
    font-weight: 500;
    line-height: 24px;
  }
  .detail-norm-matrix dl {
    box-sizing: border-box;
    width: 100%;
    height: 90px;
    gap: 0;
    overflow: hidden;
    border-left: 1px solid rgb(0 0 0 / 0.15);
  }
  .detail-norm-matrix .entry {
    display: flex;
    min-width: 0;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
  }
  .detail-norm-matrix dt,
  .detail-norm-matrix dd {
    box-sizing: border-box;
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: center;
    border-right: 1px solid rgb(0 0 0 / 0.15);
    border-bottom: 1px solid rgb(0 0 0 / 0.15);
    text-align: center;
  }
  .detail-norm-matrix dt {
    height: 32px;
    flex: 0 0 32px;
    border-top: 1px solid rgb(0 0 0 / 0.15);
    color: #595959;
    background: rgb(0 0 0 / 0.05);
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
  }
  .detail-norm-matrix dt::after {
    content: none;
  }
  .detail-norm-matrix dd {
    height: 58px;
    flex: 0 0 58px;
    gap: 8px;
    color: #191919;
    background: #fff;
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
  }
  .detail-norm-matrix dd::before {
    width: 8px;
    height: 8px;
    flex: 0 0 8px;
    background: #fe9902;
    border-radius: 50%;
    content: '';
  }
  /* responsive-contract: key-value-detail-norm-three-columns */
  @container mc-component-box (max-width: 900px) {
    .detail-norm-matrix dl {
      height: auto;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      overflow: visible;
    }
    .detail-norm-matrix .entry {
      height: 90px;
    }
    .detail-norm-matrix .entry:nth-child(n + 4) dt {
      border-top: 0;
    }
    .detail-norm-matrix dt,
    .detail-norm-matrix dd {
      padding-right: 4px;
      padding-left: 4px;
      overflow: hidden;
    }
    .detail-norm-matrix dt > span,
    .detail-norm-matrix dd {
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
  /* responsive-contract: key-value-detail-norm-two-columns */
  @container mc-component-box (max-width: 520px) {
    .detail-norm-matrix dl {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .detail-norm-matrix .entry:nth-child(n + 3) dt {
      border-top: 0;
    }
  }
</style>
