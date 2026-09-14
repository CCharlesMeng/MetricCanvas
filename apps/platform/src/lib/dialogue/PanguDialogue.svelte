<script lang="ts">
  import { onMount } from 'svelte';
  import type { DialogueAdapter } from './port';
  import { panguDialogueAdapter } from './runtime';
  let { adapter = panguDialogueAdapter }: { adapter?: DialogueAdapter } = $props();
  let container: HTMLDivElement;
  let error = $state('');
  onMount(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void adapter.mount(container).then((destroy) => {
      if (disposed) destroy(); else cleanup = destroy;
    }).catch((cause: unknown) => {
      if (!disposed) error = cause instanceof Error ? cause.message : String(cause);
    });
    return () => { disposed = true; cleanup?.(); };
  });
</script>
<div class="dialogue" aria-label="盘古对话模块">
  {#if error}
    <div role="status" data-testid="chat-unavailable"><h2>公共 Chat 暂不可用</h2><p>{error}</p><p>你可以从页面目录打开已保存页面，继续人工页面搭建。</p></div>
  {/if}
  <div class="mount" bind:this={container}></div>
</div>
<style>
  .dialogue { height: 100%; min-height: 0; display: flex; flex-direction: column; background: var(--surface); color: var(--text); }
  .mount { flex: 1; min-height: 0; }
  [role='status'] { padding: 20px; font-size: 13px; color: var(--muted); }
  h2 { font-size: 16px; color: var(--text); }
</style>
