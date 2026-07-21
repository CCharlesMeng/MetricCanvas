<script lang="ts" module>
  /** 已解析的跳转链接:href 由运行时按筛选状态当前值组装(组件不感知序列化机制) */
  export interface TextBlockLink {
    label: string;
    href: string;
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
  {#if props.heading}<h3 class="heading">{props.heading}</h3>{/if}
  {#if props.body}<p class="body">{props.body}</p>{/if}
  {#if links.length > 0}
    <nav class="links">
      {#each links as link (link.label + link.href)}
        <a href={link.href}>{link.label} →</a>
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
    padding: 18px 14px;
    border-radius: 8px;
    background: #f1f4ff;
  }
  .heading {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #18181b;
  }
  .body {
    margin: 0;
    font-size: 13px;
    color: #52525b;
    line-height: 1.6;
    white-space: pre-line;
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
