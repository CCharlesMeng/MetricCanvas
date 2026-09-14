<script lang="ts">
  import { dev } from '$app/environment';
  import { onMount } from 'svelte';
  import PanguDialogue from '$lib/dialogue/PanguDialogue.svelte';
  import PageAuthoringWorkbench from '$lib/PageAuthoringWorkbench.svelte';
  import { createDialogueFixture } from '$lib/dialogue/fixture-adapter';
  import { listenForSavedDrafts } from '$lib/dialogue/port';
  let fixture = $state<ReturnType<typeof createDialogueFixture> | null>(null);
  let embedded = $state(false);
  let result = $state('尚无页面');
  onMount(() => {
    if (!dev) return;
    fixture = createDialogueFixture(window);
    return listenForSavedDrafts({ target: window, read: fixture.read,
      onpage: (draft) => { result = draft.ref.revisionId; }, onerror: (message) => { result = message; }
    });
  });
</script>
{#if dev && fixture}
  <div class="dialogue-lab">
    <label><input type="checkbox" bind:checked={embedded} />嵌入工作台</label>
    <p role="status">受控替身结果：{result}</p>
    {#if embedded}
      <PageAuthoringWorkbench dialogueAdapter={fixture.adapter} readSavedDraft={fixture.read} />
    {:else}
      <PanguDialogue adapter={fixture.adapter} />
    {/if}
  </div>
{:else}
  <p>独立对话验收入口仅供开发环境使用。</p>
{/if}
<style>.dialogue-lab { height: 100%; display: flex; flex-direction: column; } label, p { padding: 8px; margin: 0; }</style>
