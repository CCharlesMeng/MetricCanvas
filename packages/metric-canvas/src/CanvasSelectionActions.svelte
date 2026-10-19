<script lang="ts">
  import { observeSelectionActions } from './selection-actions';
  let { target, title, componentId, index, count, allowDelete = false, onmove, ondelete }: {
    target: HTMLElement | null;
    title: string;
    componentId: string;
    index: number;
    count: number;
    allowDelete?: boolean;
    onmove: (delta: number) => void;
    ondelete: () => void;
  } = $props();
  let actions = $state<HTMLDivElement>();
  $effect(() => {
    if (!target || !actions) return;
    return observeSelectionActions(target, actions);
  });
</script>

<div bind:this={actions} class="selection-actions" popover="manual" role="group" aria-label={`组件操作 ${componentId}`}>
  <span class="selection-title" title={title}>{title}</span>
  <button type="button" aria-label="上移组件" disabled={index <= 0} onclick={() => onmove(-1)}>↑ 上移</button>
  <button type="button" aria-label="下移组件" disabled={index < 0 || index >= count - 1} onclick={() => onmove(1)}>↓ 下移</button>
  {#if allowDelete}<span class="separator" aria-hidden="true"></span><button type="button" class="delete" aria-label={`删除组件 ${componentId}`} onclick={ondelete}>删除</button>{/if}
</div>

<style>
  .selection-actions { position: fixed; inset: auto; margin: 0; padding: 6px; visibility: hidden; border: 1px solid #d5e4fa; border-radius: 7px; background: linear-gradient(115deg, #f9fcff, #fff 65%); box-shadow: 0 2px 8px rgb(35 93 178 / .055); color: #68778a; font: 11px/1.5 Helvetica, Arial, "PingFang SC", "Microsoft YaHei", sans-serif; box-sizing: border-box; }
  .selection-actions:popover-open { display: flex; align-items: center; gap: 5px; }
  .selection-title { min-width: 0; max-width: 160px; padding: 0 8px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: #707d90; }
  button { flex: none; padding: 6px; border: 0; border-radius: 4px; background: transparent; color: inherit; font: inherit; cursor: pointer; white-space: nowrap; }
  button:hover:not(:disabled) { background: #edf5ff; }
  button:disabled { opacity: .4; cursor: not-allowed; }
  button:focus-visible { outline: 2px solid #246fe3; outline-offset: 1px; }
  .delete { color: #c64c4c; }
  .delete:hover:not(:disabled) { background: #fff1f0; }
  .separator { flex: none; width: 1px; height: 16px; background: #e8ebf0; }
</style>
