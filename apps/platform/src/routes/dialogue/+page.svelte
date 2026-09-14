<script lang="ts">
  import { dev } from '$app/environment';
  import { onMount } from 'svelte';
  import PanguDialogue from '$lib/dialogue/PanguDialogue.svelte';
  import PageAuthoringWorkbench from '$lib/PageAuthoringWorkbench.svelte';
  import { createDialogueFixture } from '$lib/dialogue/fixture-adapter';
  import { createStableSaveFixture, createAuthoringHistoryFixture, type SyncFixtureMode } from '$lib/workbench/authoring-sync-fixture';
  import { listenForSavedDrafts } from '$lib/dialogue/port';
  let fixture = $state<ReturnType<typeof createDialogueFixture> | null>(null);
  let embedded = $state(false);
  let historyFixture = $state(false);
  const historyPort = createAuthoringHistoryFixture();
  let syncMode = $state<SyncFixtureMode>('delay');
  const stableSavePort = createStableSaveFixture(() => syncMode);
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
    <label><input type="checkbox" bind:checked={historyFixture} disabled={embedded} />启用历史替身</label>
    <p role="status">受控替身结果：{result}</p>
    <label>同步替身场景<select aria-label="同步替身场景" bind:value={syncMode}><option value="delay">延迟成功</option><option value="lost-ack">提交后丢回执</option><option value="conflict">基线冲突</option><option value="offline">未提交断网</option></select></label>
    {#if embedded}
      <PageAuthoringWorkbench authoringPort={historyFixture ? historyPort : undefined} dialogueAdapter={fixture.adapter} readSavedDraft={fixture.read} {stableSavePort} />
    {:else}
      <PanguDialogue adapter={fixture.adapter} />
    {/if}
  </div>
{:else}
  <p>独立对话验收入口仅供开发环境使用。</p>
{/if}
<style>.dialogue-lab { height: 100%; display: flex; flex-direction: column; } label, p { padding: 8px; margin: 0; }</style>
