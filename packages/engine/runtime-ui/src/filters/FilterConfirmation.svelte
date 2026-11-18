<svelte:options css="injected" />
<script lang="ts">
  import type { DimensionValuesSnapshot } from '../../../runtime/src';
  import { hierarchyTreeStatus } from './hierarchy-tree';

  let { required = false, disabled = false, preparing = false, candidates, onconfirm, onretry }: {
    required?: boolean;
    disabled?: boolean;
    preparing?: boolean;
    candidates?: DimensionValuesSnapshot;
    onconfirm: () => void;
    onretry?: () => void;
  } = $props();

  const candidateMessage = $derived(candidates && hierarchyTreeStatus(candidates));
</script>

<span class="confirmation" data-filter-confirmation>
  {#if preparing}
    <span role="status">等待筛选条件准备</span>
  {:else if candidates?.status === 'idle' || candidates?.status === 'loading'}
    <span role="status">正在加载候选项</span>
  {:else if candidateMessage}
    <span role={candidates?.status === 'error' ? 'alert' : 'status'}>{candidateMessage}</span>
    {#if onretry && candidates?.status !== 'empty'}
      <button type="button" {disabled} onclick={onretry}>重试</button>
    {/if}
  {:else}
    <span role="status">筛选范围已变更，请重新选择</span>
    {#if !required}
      <button type="button" {disabled} onclick={onconfirm}>确认不限</button>
    {/if}
  {/if}
</span>

<style>
  .confirmation {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    color: var(--mc-color-text-secondary, #52525b);
    font-size: 12px;
    line-height: 20px;
  }
  button {
    color: var(--mc-color-text, #191919);
    background: transparent;
    border: 1px solid var(--mc-color-border, #d4d4d8);
    border-radius: 4px;
    font: inherit;
    padding: 1px 6px;
    cursor: pointer;
  }
  button:disabled { opacity: .6; cursor: default; }
</style>
