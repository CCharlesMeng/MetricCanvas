<script lang="ts">
  import type { SemanticHtmlNode } from './semantic-html';

  let { nodes }: { nodes: SemanticHtmlNode[] } = $props();
</script>

{#snippet renderNodes(items: SemanticHtmlNode[])}
  {#each items as node}
    {#if node.type === 'text'}
      {node.value}
    {:else if node.tag === 'div'}
      <div class={node.classes.join(' ')}>{@render renderNodes(node.children)}</div>
    {:else if node.tag === 'span'}
      <span class={node.classes.join(' ')}>{@render renderNodes(node.children)}</span>
    {:else if node.tag === 'strong'}
      <strong class={node.classes.join(' ')}>{@render renderNodes(node.children)}</strong>
    {:else if node.tag === 'p'}
      <p class={node.classes.join(' ')}>{@render renderNodes(node.children)}</p>
    {:else}
      <br />
    {/if}
  {/each}
{/snippet}

<div class="semantic-html">{@render renderNodes(nodes)}</div>

<style>
  .semantic-html :global(.detail-title) {
    min-width: 0;
    color: var(--mc-color-report-text, #191919);
    font-size: 12px;
    font-weight: 600;
    line-height: 18px;
  }
  .semantic-html :global(.detail-value) {
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    line-height: 18px;
  }
  .semantic-html :global(.detail-description),
  .semantic-html :global(.detail-meta) {
    color: var(--mc-color-report-description, #595959);
    font-size: 12px;
    line-height: 18px;
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
</style>
