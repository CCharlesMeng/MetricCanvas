<script lang="ts" module>
  /** 已解析的跳转链接:href 由运行时按筛选状态当前值组装(组件不感知序列化机制) */
  export interface TextBlockLink {
    label: string;
    href: string;
  }
</script>

<script lang="ts">
  /**
   * 文本组件(纯渲染):标题/说明静态文案 + 带参跳转链接。
   * 无查询、无数据快照;文案是页面文档里的字面量,不支持表达式(ADR-0003)。
   */
  interface Props {
    heading?: string;
    body?: string;
    links?: TextBlockLink[];
  }

  let { heading, body, links = [] }: Props = $props();
</script>

<div class="text-block">
  {#if heading}<h3 class="heading">{heading}</h3>{/if}
  {#if body}<p class="body">{body}</p>{/if}
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
