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

<section class="field-text" class:quote={props.variant === 'quote'}>
  {#if props.title}<h3>{props.title}</h3>{/if}
  {#if semantic}
    <SemanticHtml source={semantic.source} format={semantic.format} />
  {:else}
    <p>{formatValue(value, resolved.format)}</p>
  {/if}
</section>

<style>
  .field-text {
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
</style>
