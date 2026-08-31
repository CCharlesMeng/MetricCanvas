<script lang="ts">
  import type { FieldTextProps } from '@metriccanvas/page';
  import type { MainDataSlots } from '../../shared/component-data';
  import { fieldValue, resolveField, semanticHtmlFieldPresentation } from '../../shared/component-data';
  import SemanticHtml from '../../shared/SemanticHtml.svelte';
  import { formatValue } from '../../shared/value-format';

  /**
   * 字段长文本(纯渲染):正文来自数据字段而不是页面文档。
   * 只读第一行;semanticHtml 字段交给受控语义 HTML 渲染,其余按纯文本呈现
   * 并保留换行。
   */
  interface Props {
    data: MainDataSlots;
    props: FieldTextProps;
  }

  let { data, props }: Props = $props();

  const resolved = $derived(resolveField(props.field, data));
  const value = $derived(fieldValue(props.field, data));
  const semantic = $derived(semanticHtmlFieldPresentation(resolved, value));
</script>

<section
  class="field-text"
  class:quote={props.variant === 'quote'}
  class:narrative={
    props.variant === 'narrativeShort' ||
    props.variant === 'narrativeMeeting' ||
    props.variant === 'narrativeRisk' ||
    props.variant === 'narrativeProgress'
  }
  class:narrative-short={props.variant === 'narrativeShort'}
  class:narrative-long={
    props.variant === 'narrativeMeeting' ||
    props.variant === 'narrativeRisk' ||
    props.variant === 'narrativeProgress'
  }
  class:narrative-meeting={props.variant === 'narrativeMeeting'}
  class:narrative-risk={props.variant === 'narrativeRisk'}
  class:narrative-progress={props.variant === 'narrativeProgress'}
>
  {#if props.title}<h3>{props.title}</h3>{/if}
  {#if semantic}
    <SemanticHtml source={semantic.source} format={semantic.format} />
  {:else}
    <p>{formatValue(value, resolved.format)}</p>
  {/if}
</section>

<style>
  .field-text {
    box-sizing: border-box;
    width: 100%;
    flex: 1;
    min-width: 0;
    padding: 15px 19px;
    background: var(--mc-color-surface, #fff);
    border-radius: 12px;
  }
  .field-text.quote {
    background: var(--mc-color-surface-subtle, #f1f4ff);
    border-left: 3px solid var(--mc-color-report-header-accent, #2098ff);
    border-radius: 0 12px 12px 0;
  }
  h3 {
    margin: 0 0 8px;
    color: var(--mc-card-title-color, #121e3b);
    font-size: var(--mc-card-title-font-size, 16px);
    font-weight: var(--mc-card-title-font-weight, 600);
    line-height: var(--mc-card-title-line-height, 24px);
  }
  /* 正文承载区经 --mc-field-text-body-* 可被页面布局形态覆写:报表形态里
     正文直接落在卡面上,看板形态把它收进一块浅底圆角内容区。 */
  p {
    padding: var(--mc-field-text-body-padding, 0);
    margin: 0;
    color: #191919;
    background: var(--mc-field-text-body-surface, transparent);
    border-radius: var(--mc-field-text-body-radius, 0);
    font-size: 14px;
    /* 正文行高两档形态取值不同:看板 28(冻结基线 R3-3,用户 2026-08-24 决定),
       报表 24。定义点与同族其余 --mc-field-text-body-* 一起落在统一运行时的
       看板形态块里,这里的缺省值即报表档。 */
    line-height: var(--mc-field-text-body-line-height, 24px);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .field-text.narrative {
    box-sizing: border-box;
    display: flex;
    width: 100%;
    min-width: 0;
    min-height: 180px;
    flex: none;
    flex-direction: column;
    gap: 12px;
    overflow: hidden;
    background: #fff;
    border-radius: 16px;
  }
  .narrative-short {
    min-height: 180px;
    padding: 16px clamp(16px, 3cqi, 24px) 20px clamp(16px, 2.7cqi, 21px);
  }
  .narrative-long {
    min-height: 204px;
    padding: 16px clamp(16px, 3cqi, 24px) 18px clamp(16px, 2.7cqi, 21px);
  }
  .narrative > h3 {
    flex: 0 0 24px;
    margin: 0;
    color: #191919;
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
  }
  .narrative > p {
    box-sizing: border-box;
    width: 100%;
    min-height: 128px;
    flex: none;
    margin: 0;
    padding: 14px 17px 10px;
    overflow: visible;
    color: #191919;
    background: rgb(0 0 0 / 0.03);
    border-radius: 8px;
    font-size: 14px;
    font-weight: 400;
    line-height: 28px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .narrative-long > p {
    min-height: 152px;
  }
</style>
