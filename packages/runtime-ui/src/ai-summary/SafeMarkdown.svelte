<script lang="ts">
  import { parseSafeMarkdown, type MarkdownInline } from './markdown';

  let { content }: { content: string } = $props();
  const blocks = $derived(parseSafeMarkdown(content));
</script>

{#snippet inline(parts: MarkdownInline[])}
  {#each parts as part}
    {#if part.type === 'strong'}<strong>{part.value}</strong>
    {:else if part.type === 'code'}<code>{part.value}</code>
    {:else if part.type === 'link'}<a href={part.href} target={part.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{part.value}</a>
    {:else}{part.value}{/if}
  {/each}
{/snippet}

<div class="safe-markdown">
  {#each blocks as block}
    {#if block.type === 'heading'}
      <div class={`heading h${block.level}`}>{@render inline(block.content)}</div>
    {:else if block.type === 'paragraph'}
      <p>{@render inline(block.content)}</p>
    {:else if block.type === 'quote'}
      <blockquote>{@render inline(block.content)}</blockquote>
    {:else if block.type === 'code'}
      <pre><code>{block.value}</code></pre>
    {:else if block.ordered}
      <ol>{#each block.items as item}<li>{@render inline(item)}</li>{/each}</ol>
    {:else}
      <ul>{#each block.items as item}<li>{@render inline(item)}</li>{/each}</ul>
    {/if}
  {/each}
</div>

<style>
  .safe-markdown { display: grid; gap: 6px; }
  p, blockquote, ol, ul, pre { margin: 0; }
  .heading { color: inherit; font-weight: 850; line-height: 1.35; }
  .h1 { font-size: 1.15em; }
  .h2 { font-size: 1.08em; }
  .h3 { font-size: 1.02em; }
  ol, ul { display: grid; gap: 3px; padding-left: 16px; }
  blockquote { padding-left: 8px; border-left: 2px solid #aaa5e7; }
  pre { overflow-x: auto; padding: 7px; background: rgb(255 255 255 / 0.62); border-radius: 5px; }
  code { padding: 1px 3px; background: rgb(255 255 255 / 0.68); border-radius: 3px; font: 0.92em/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
  a { color: #4338ca; text-decoration: underline; text-underline-offset: 2px; }
</style>
