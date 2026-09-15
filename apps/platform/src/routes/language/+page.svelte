<script lang="ts">
  import { dev } from '$app/environment';
  import PageAuthoringWorkbench from '$lib/PageAuthoringWorkbench.svelte';
  import type { DialogueAdapter } from '$lib/dialogue/port';
  import type { LanguagePort, createAuthoringLanguage } from '$lib/workbench/authoring-language';
  import { confirmedPageAssetCapabilities, type AuthoringPort } from '$lib/workbench/authoring-coordinator';
  import { pageAuthoringPort } from '$lib/page-assets';
  let openedPage = false;
  let language: ReturnType<typeof createAuthoringLanguage> | null = null;
  async function request(path: string, value: unknown, signal?: AbortSignal) {
    if (!dev) throw Error('Development fixture only');
    const result = await fetch(`/__fixtures/language/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value), signal });
    if (!result.ok) throw Error('替身请求失败');
    return result.json();
  }
  const port: LanguagePort = {
    prepare: (requestBody, signal) => request('prepare', requestBody, signal),
    run: (context, prompt, signal) => request('run', { context, prompt }, signal),
    lookup: (context, signal) => request('lookup', { context }, signal),
    read: async (draftId, signal) => { const result = await request('read', { draftId }, signal); openedPage = true; return result; }
  };
  const authoringPort: AuthoringPort = {
    ...pageAuthoringPort, capabilities: { ...confirmedPageAssetCapabilities, exactRead: true, latestRead: true },
    getLatest: (pageId, signal) => request('latest', { pageId }, signal),
    getRevision: (pageId, revisionId, signal) => request('revision', { ref: { pageId, revisionId, resourceId: 'resource-opaque' } }, signal)
  };
  const adapter: DialogueAdapter = {
    async mount(element) {
      const label = document.createElement('p'); label.textContent = '确定性 Relay 替身：调用真实内容与生命周期 MCP，非真实盘古。';
      const input = document.createElement('input'); input.setAttribute('aria-label', '替身语言场景'); input.value = 'create';
      const button = document.createElement('button'); button.textContent = '执行语言场景';
      button.onclick = () => { void language?.start(input.value, { mode: openedPage ? 'existing' : 'new' }); };
      element.append(label, input, button);
      return () => element.replaceChildren();
    }
  };
</script>
{#if dev}
  <PageAuthoringWorkbench dialogueAdapter={adapter} languagePort={port} {authoringPort} onLanguageReady={(value) => { language = value; }} />
{:else}
  <p>语言组合验收入口仅供开发环境使用。</p>
{/if}
