<script lang="ts">
  import type { ValueFormatPreset } from '@metriccanvas/page';
  import {
    parseSemanticHtml,
    semanticDataPresentation,
    type SemanticHtmlNode
  } from './semantic-html';

  /**
   * `inline`:以行内流呈现(根与段落 display:inline,段落间以空格衔接)。
   * 调用方通过该展示属性声明意图,不得用选择器穿透本组件内部 DOM(ADR-0029)。
   */
  let {
    source,
    inline = false,
    format,
    visual
  }: {
    source: string;
    inline?: boolean;
    format?: ValueFormatPreset;
    visual?: 'signed';
  } = $props();
  const parsed = $derived(parseSemanticHtml(source));
</script>

{#snippet renderNodes(items: SemanticHtmlNode[])}
  {#each items as node}
    {#if node.type === 'text'}
      {node.value}
    {:else if node.type === 'data'}
      {@const presentation = semanticDataPresentation(node, format, visual)}
      <data
        class="semantic-data-value"
        class:tone-positive={presentation.tone === 'positive'}
        class:tone-negative={presentation.tone === 'negative'}
        class:tone-neutral={presentation.tone === 'neutral'}
      >{presentation.text}</data>
    {:else if node.tag === 'div'}
      {#if inline}
        <span class={node.classes.join(' ')}>{@render renderNodes(node.children)}</span>
      {:else}
        <div class={node.classes.join(' ')}>{@render renderNodes(node.children)}</div>
      {/if}
    {:else if node.tag === 'span'}
      <span class={node.classes.join(' ')}>{@render renderNodes(node.children)}</span>
    {:else if node.tag === 'strong'}
      <strong class={node.classes.join(' ')}>{@render renderNodes(node.children)}</strong>
    {:else if node.tag === 'p'}
      {#if inline}
        <span class={['semantic-inline-paragraph', ...node.classes].join(' ')}
          >{@render renderNodes(node.children)}</span
        >
      {:else}
        <p class={node.classes.join(' ')}>{@render renderNodes(node.children)}</p>
      {/if}
    {:else}
      <br />
    {/if}
  {/each}
{/snippet}

{#if parsed.ok}
  {#if inline}
    <span class="semantic-html inline">{@render renderNodes(parsed.document.nodes)}</span>
  {:else}
    <div class="semantic-html">{@render renderNodes(parsed.document.nodes)}</div>
  {/if}
{:else}
  <span class="semantic-html-error">内容格式不受支持</span>
{/if}

<style>
  .semantic-html :global(p) {
    margin: 0;
  }
  .semantic-html :global(p + p) {
    margin-top: var(--mc-semantic-paragraph-gap, 0);
  }
  .semantic-html.inline {
    display: inline;
  }
  .semantic-html.inline :global(.semantic-inline-paragraph + .semantic-inline-paragraph)::before {
    content: ' ';
  }
  .semantic-html :global(.detail-title) {
    min-width: 0;
    color: var(--mc-semantic-title-color, var(--mc-color-report-text, #191919));
    font-size: var(--mc-semantic-font-size, 12px);
    font-weight: 600;
    line-height: var(--mc-semantic-line-height, 18px);
  }
  .semantic-html :global(.detail-value) {
    font-size: var(--mc-semantic-font-size, 12px);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    line-height: var(--mc-semantic-line-height, 18px);
  }
  .semantic-html :global(.semantic-data-value) {
    font-variant-numeric: tabular-nums;
  }
  .semantic-html :global(.detail-description),
  .semantic-html :global(.detail-meta) {
    color: var(--mc-semantic-description-color, var(--mc-color-report-description, #595959));
    font-size: var(--mc-semantic-font-size, 12px);
    line-height: var(--mc-semantic-line-height, 18px);
  }
  .semantic-html :global(.tone-positive) {
    color: var(--mc-color-positive, #52c41a);
  }
  .semantic-html :global(.tone-negative) {
    color: var(--mc-color-negative, #f5222d);
  }
  .semantic-html :global(.tone-neutral) {
    color: var(--mc-color-muted, #71717a);
  }
  .semantic-html-error {
    color: var(--mc-color-negative, #f5222d);
  }
</style>
