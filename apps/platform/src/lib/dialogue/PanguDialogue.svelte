<script lang="ts">
  import type { DialogueAdapter } from './port';
  import { panguDialogueAdapter } from './runtime';
  import { attachDialogue } from './lifecycle';

  let { adapter = panguDialogueAdapter }: { adapter?: DialogueAdapter } = $props();
  let element: HTMLDivElement;
  let error = $state('');

  $effect(() => {
    error = '';
    return attachDialogue(adapter, element, (cause) => {
      error = cause instanceof Error ? cause.message : String(cause);
    });
  });
</script>

<div bind:this={element} aria-label="盘古助手"></div>
{#if error}
  <p role="alert">对话加载失败：{error}</p>
{/if}
