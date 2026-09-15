<script lang="ts">
  import { dev } from '$app/environment';
  import PageAuthoringWorkbench from '$lib/PageAuthoringWorkbench.svelte';
  import type { TrustedLanguageRecoveryPort } from '$lib/workbench/authoring-language-recovery';
  import type { LanguagePort, createAuthoringLanguage } from '$lib/workbench/authoring-language';
  import type { DialogueAdapter } from '$lib/dialogue/port';
  import { confirmedPageAssetCapabilities, type AuthoringPort } from '$lib/workbench/authoring-coordinator';
  let language: ReturnType<typeof createAuthoringLanguage> | null = null;
  async function request(path: string, value: unknown, signal?: AbortSignal) {
    if (!dev) throw Error('Development fixture only');
    const response = await fetch(`/__fixtures/language-recovery/${path}`, { method: 'POST', body: JSON.stringify(value), headers: { 'Content-Type': 'application/json' }, signal });
    if (!response.ok) throw Error('恢复替身请求失败');
    return response.json();
  }
  const recovery: TrustedLanguageRecoveryPort = {
    loadPending: (scope, signal) => request('loadPending', scope, signal),
    recover: (recoveryRef, attemptId, signal) => request('recover', { recoveryRef, attemptId }, signal),
    cancel: (recoveryRef, signal) => request('cancel', { recoveryRef }, signal),
    retryOriginal: (recoveryRef, attemptId, signal) => request('retryOriginal', { recoveryRef, attemptId }, signal),
    readVerified: (recoveryRef, ref, signal) => request('readVerified', { recoveryRef, ref }, signal)
  };
  const authoring: AuthoringPort = {
    capabilities: confirmedPageAssetCapabilities,
    getLatest: (pageId, signal) => request('latest', { pageId }, signal),
    getRevision: (pageId, revisionId, signal) => request('revision', { pageId, revisionId }, signal),
    saveRevision: (pageId, command) => request('save', { pageId, command })
  };
  const languagePort: LanguagePort = {
    prepare: (value, signal) => request('prepare', value, signal),
    run: (context, prompt, signal) => request('run', { context, prompt }, signal),
    lookup: (context, signal) => request('lookup', context, signal),
    read: (draftId, signal) => request('read', { draftId }, signal)
  };
  const dialogue: DialogueAdapter = { async mount(element) {
    const note = document.createElement('p'); note.textContent = '确定性恢复端口替身，不连接生产服务。';
    const start = document.createElement('button'); start.textContent = '测试开始新轮'; start.onclick = () => { void language?.start('修改当前页'); };
    element.append(note, start); return () => element.replaceChildren();
  } };
</script>
{#if dev}
  <PageAuthoringWorkbench dialogueAdapter={dialogue} authoringPort={authoring} {languagePort} languageRecoveryPort={recovery} onLanguageReady={value => { language = value; }} />
{:else}
  <p>恢复验收入口仅供开发环境使用。</p>
{/if}
