<svelte:options css="injected" />
<script lang="ts">
  import type { Component } from '@metriccanvas/page/internal';
  import type { Snippet } from 'svelte';
  import { installRowAlignment } from './row-alignment';
  import { metricBefore, type SectionLayoutItem } from './metric-connections';

  let { item, cell, contained = false, onbeforeselect }: {
    item: SectionLayoutItem;
    cell: Snippet<[Component, number, string?]>;
    contained?: boolean;
    onbeforeselect?: (component: Component, index: number) => void;
  } = $props();
  let box = $state<HTMLDivElement | null>(null);
  let grid = $state<HTMLDivElement | null>(null);
  let stacked = $state(false);
  const columns = $derived(item.members.map(({ component }, index) =>
    `${index ? 'max-content ' : ''}minmax(0, ${component.layout.span}fr)`).join(' '));

  $effect(() => grid ? installRowAlignment(grid) : undefined);
  $effect(() => {
    const target = box, content = grid;
    if (!target || !content) return;
    const members = item.members;
    const gaps = members.slice(1).map(member => metricBefore(member.component)?.gap ?? 8);
    let active = true;
    const measure = () => {
      if (!active) return;
      const texts = [...content.querySelectorAll<HTMLElement>(':scope > .connector')];
      const reserved = texts.reduce((sum, node, index) => sum + node.getBoundingClientRect().width +
        2 * gaps[index], 0);
      const minimumSpan = Math.min(...members.map(member => member.component.layout.span));
      // 144px 是连接行的最小卡片空间预算；内容自身的响应仍归指标卡。
      // 使用外框内的实际内容宽度，边框和内边距不计入卡片空间预算。
      stacked = (content.getBoundingClientRect().width - reserved) * minimumSpan / item.span < 144;
    };
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    for (const text of content.querySelectorAll(':scope > .connector')) observer.observe(text);
    void document.fonts?.ready.then(measure);
    measure();
    return () => { active = false; observer.disconnect(); };
  });
</script>

<div class="connection-row" class:contained data-metric-connection-row={item.id} style={`grid-column:span ${item.span}`} bind:this={box}>
  <div class="connection-grid" class:stacked style={`--connection-columns:${columns}`} bind:this={grid}>
    {#each item.members as member, index (member.component.id)}
      {#if index > 0}
        {@const before = metricBefore(member.component)!}
        {#if onbeforeselect}
          <button type="button" class="connector" data-metric-connector={member.component.id}
            style={`--connector-gap:${before.gap ?? 8}px;grid-column:${stacked ? 1 : index * 2}`}
            title={before.text} aria-label={before.text} onclick={() => onbeforeselect?.(member.component, member.index)}>{before.text}</button>
        {:else}
          <span class="connector" data-metric-connector={member.component.id}
            style={`--connector-gap:${before.gap ?? 8}px;grid-column:${stacked ? 1 : index * 2}`}
            title={before.text} aria-label={before.text}>{before.text}</span>
        {/if}
      {/if}
      {@render cell(member.component, member.index, String(stacked ? 1 : index * 2 + 1))}
    {/each}
  </div>
</div>

<style>
  .connection-row {
    box-sizing:border-box;
    min-width:0;
    width:100%;
    padding:20px;
    border:0;
    border-radius:16px;
    background:rgba(255, 255, 255, 1);
    container:mc-connection-row / inline-size;
  }
  .connection-row.contained { padding:0; border-radius:0; background:transparent; }
  .connection-grid { display:grid; grid-template-columns:var(--connection-columns); align-items:stretch; gap:0; min-width:0; }
  .connector { display:block; align-self:center; justify-self:center; box-sizing:border-box; max-inline-size:min(12em, 20cqi); margin:0 var(--connector-gap); padding:0; border:0; background:transparent; color:var(--mc-color-text,#191919); font:inherit; font-size:16px; font-weight:500; line-height:24px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  button.connector { cursor:pointer; }
  button.connector:focus-visible { outline:2px solid var(--mc-color-primary); outline-offset:2px; }
  .stacked { grid-template-columns:minmax(0,1fr); }
  .stacked > .connector { margin:var(--connector-gap) 0; }
  @container mc-runtime (max-width:760px) {
    .connection-grid { grid-template-columns:minmax(0,1fr); }
    .connector { grid-column:1 / -1!important; margin:var(--connector-gap) 0; }
  }
  @media print { .connector { break-after:avoid; } }
</style>
