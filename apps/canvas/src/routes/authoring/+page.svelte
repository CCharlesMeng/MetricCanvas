<script lang="ts">
  import { page } from '$app/state';
  import {
    authoringIntentMessage,
    authoringReadyMessage,
    parseAuthoringHostMessage,
    type AuthoringComponentLocator,
    type AuthoringIntent
  } from '@metriccanvas/runtime';
  import { onMount } from 'svelte';
  import PageView from '../pages/[pageId]/+page.svelte';

  const platformOrigin = import.meta.env.VITE_PLATFORM_URL
    ? new URL(import.meta.env.VITE_PLATFORM_URL).origin
    : 'http://localhost:5174';
  const sessionId = $derived(page.url.searchParams.get('session') ?? '');

  let document = $state<unknown>();
  let selected = $state<AuthoringComponentLocator>();

  onMount(() => {
    if (!sessionId) return;
    const receive = (event: MessageEvent) => {
      if (event.origin !== platformOrigin || event.source !== window.parent) return;
      const message = parseAuthoringHostMessage(event.data, sessionId);
      if (!message) return;
      document = message.document;
      selected = message.selected;
    };
    window.addEventListener('message', receive);
    window.parent.postMessage(authoringReadyMessage(sessionId), platformOrigin);
    return () => window.removeEventListener('message', receive);
  });

  function sendIntent(intent: AuthoringIntent) {
    window.parent.postMessage(authoringIntentMessage(sessionId, intent), platformOrigin);
  }
</script>

<svelte:head><title>页面搭建画布 · MetricCanvas</title></svelte:head>

{#if !sessionId}
  <div class="authoring-empty">authoring session 不能为空。</div>
{:else if document === undefined}
  <div class="authoring-empty"><span></span>等待页面搭建工作台发送未保存工作副本…</div>
{:else}
  <PageView {document} authoring={{ selected, onintent: sendIntent }} />
{/if}

<style>
  .authoring-empty {
    display: flex;
    min-height: 70vh;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: #71717a;
    font-size: 14px;
  }
  .authoring-empty span {
    width: 14px;
    height: 14px;
    border: 2px solid #d4d4d8;
    border-top-color: #4f46e5;
    border-radius: 50%;
    animation: spin 700ms linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
