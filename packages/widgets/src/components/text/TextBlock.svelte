<script lang="ts" module>
  /** 已解析的跳转链接:href 由运行时按筛选状态当前值组装(组件不感知序列化机制) */
  export interface TextBlockLink {
    label: string;
    href: string;
    onclick?: (event: MouseEvent) => void;
  }
</script>

<script lang="ts">
  import type { TextProps } from '@metriccanvas/page';

  /**
   * 文本组件(纯渲染):标题/说明静态文案 + 带参跳转链接。
   * 无查询、无数据快照;文案是页面文档里的字面量,不支持表达式(ADR-0003)。
   */
  interface Props {
    props: Omit<TextProps, 'links'>;
    /** 页面声明的链接经统一运行时解析为 href 后传入。 */
    links?: TextBlockLink[];
  }

  let { props, links = [] }: Props = $props();
</script>

<div class:insight={props.variant === 'insight'} class="text-block">
  {#if props.title && !props.body && links.length === 0}
    <span class="heading">{props.title}</span>
  {:else if props.title}<h3 class="heading">{props.title}</h3>{/if}
  {#if props.body}<p class="body">{props.body}</p>{/if}
  {#if links.length > 0}
    <nav class="links">
      {#each links as link (link.label + link.href)}
        <a href={link.href} onclick={link.onclick}>{link.label} →</a>
      {/each}
    </nav>
  {/if}
</div>

<style>
  .text-block {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    min-height: 0;
  }
  .text-block.insight {
    box-sizing: border-box;
    justify-content: flex-start;
    gap: 0;
    padding: 15px 18px 15px 15px;
    border-radius: 16px;
    background: var(--mc-color-surface, #fff);
  }
  .heading {
    margin: 0;
    color: var(--mc-text-heading-color, #18181b);
    font-size: var(--mc-text-heading-font-size, 16px);
    font-weight: var(--mc-text-heading-font-weight, 600);
    line-height: var(--mc-text-heading-line-height, normal);
    text-align: var(--mc-text-heading-text-align, start);
  }
  .body {
    margin: 0;
    font-size: 13px;
    color: #52525b;
    line-height: 1.6;
    white-space: pre-line;
  }
  .insight .heading {
    margin: 0 0 15px 5px;
    color: #121e3b;
    font-size: 20px;
    font-weight: 600;
    line-height: 25px;
    text-align: left;
  }
  .insight .body {
    padding: 9px 27px 12px 12px;
    color: #191919;
    background: var(--mc-color-surface-subtle, #f1f4ff);
    border-radius: 8px;
    font-size: 18px;
    font-weight: 400;
    line-height: 30px;
  }
  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-top: 2px;
  }
  .links a {
    font-size: 13px;
    color: #2563eb;
    text-decoration: none;
  }
  .links a:hover {
    text-decoration: underline;
  }
</style>
