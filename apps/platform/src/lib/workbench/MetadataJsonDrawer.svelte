<script lang="ts">
  import { onMount } from 'svelte';
  import {
    copyMetadataJson,
    formatMetadataJson,
    metadataInitialSources
  } from './metadata-json';

  let {
    document,
    pageId,
    transient,
    onclose
  }: {
    document: Record<string, unknown>;
    pageId: string;
    transient: boolean;
    onclose: () => void;
  } = $props();

  type CopyState = 'idle' | 'copied' | 'error';

  let dialogEl: HTMLDialogElement | null = $state(null);
  let copyState = $state<CopyState>('idle');
  let includedInitialSourceIds = $state<string[]>([]);
  let resetTimer: ReturnType<typeof setTimeout> | null = null;
  let active = false;

  const initialSources = $derived(metadataInitialSources(document));
  const includedInitialSet = $derived(new Set(includedInitialSourceIds));
  const formattedDocument = $derived(
    formatMetadataJson(document, includedInitialSet)
  );
  const subtitle = $derived(
    `页面 ID：${pageId} · ${transient ? '临时页面态' : '未保存工作副本'}`
  );
  const copyLabel = $derived(
    copyState === 'copied' ? '已复制' : copyState === 'error' ? '复制失败' : '复制 JSON'
  );
  const copyIcon = $derived(
    copyState === 'copied' ? 'check' : copyState === 'error' ? 'warning' : 'copy'
  );

  $effect(() => {
    const available = new Set(initialSources.map((source) => source.id));
    const existing = includedInitialSourceIds.filter((id) => available.has(id));
    if (existing.length !== includedInitialSourceIds.length) {
      includedInitialSourceIds = existing;
    }
  });

  onMount(() => {
    active = true;
    const documentElement = globalThis.document.documentElement;
    const body = globalThis.document.body;
    const previousDocumentOverflow = documentElement.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyLeft = body.style.left;
    const previousBodyRight = body.style.right;
    const previousBodyWidth = body.style.width;
    const scrollX = globalThis.scrollX;
    const scrollY = globalThis.scrollY;

    documentElement.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = `-${scrollX}px`;
    body.style.right = '0';
    body.style.width = '100%';
    dialogEl?.showModal();

    return () => {
      active = false;
      documentElement.style.overflow = previousDocumentOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.left = previousBodyLeft;
      body.style.right = previousBodyRight;
      body.style.width = previousBodyWidth;
      globalThis.scrollTo(scrollX, scrollY);
      if (resetTimer !== null) clearTimeout(resetTimer);
    };
  });

  function scheduleCopyReset() {
    if (resetTimer !== null) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      copyState = 'idle';
      resetTimer = null;
    }, 1800);
  }

  async function copyDocument() {
    try {
      await copyMetadataJson(formattedDocument);
      if (!active) return;
      copyState = 'copied';
    } catch {
      if (!active) return;
      copyState = 'error';
    }
    scheduleCopyReset();
  }

  function setInitialIncluded(sourceId: string, included: boolean) {
    if (included) {
      if (!includedInitialSourceIds.includes(sourceId)) {
        includedInitialSourceIds = [...includedInitialSourceIds, sourceId];
      }
      return;
    }
    includedInitialSourceIds = includedInitialSourceIds.filter(
      (candidate) => candidate !== sourceId
    );
  }

  function handleCancel(event: Event) {
    event.preventDefault();
    onclose();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    onclose();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) onclose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<dialog
  class="metadata-json-drawer"
  bind:this={dialogEl}
  aria-labelledby="metadata-json-title"
  data-testid="metadata-json-drawer"
  oncancel={handleCancel}
  onclick={handleBackdropClick}
>
  <header class="metadata-json-header">
    <div class="metadata-json-heading">
      <h2
        id="metadata-json-title"
        data-contract-part
        data-contract-header-item
      >metadata.json</h2>
      <p
        class="metadata-json-subtitle"
        role="note"
        aria-label="页面信息"
        title={subtitle}
        data-contract-part
        data-contract-header-item
        data-testid="metadata-json-subtitle"
      >{subtitle}</p>
    </div>
    <div class="metadata-json-actions" data-testid="metadata-json-header-actions">
      <button
        type="button"
        class="icon-button"
        aria-label={copyLabel}
        title={copyLabel}
        data-icon={copyIcon}
        data-copy-state={copyState}
        data-serialization-source="metadata-json-projection"
        data-contract-header-item
        data-testid="metadata-json-copy"
        onclick={copyDocument}
      >
        {#if copyState === 'copied'}
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="m4.5 10.5 3.2 3.2 7.8-8" />
          </svg>
        {:else if copyState === 'error'}
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 3 18 17H2L10 3Z" />
            <path d="M10 7.4v4.5M10 14.5v.1" />
          </svg>
        {:else}
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <rect x="7" y="3" width="9" height="11" rx="2" />
            <path d="M13 14v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1" />
          </svg>
        {/if}
      </button>
      <button
        type="button"
        class="icon-button"
        aria-label="关闭 metadata.json"
        title="关闭 metadata.json"
        data-icon="close"
        data-contract-header-item
        data-testid="metadata-json-close"
        onclick={onclose}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="m5 5 10 10M15 5 5 15" />
        </svg>
      </button>
    </div>
  </header>

  <div
    class="metadata-json-body"
    data-testid="metadata-json-body"
  >
    {#if initialSources.length > 0}
      <section
        class="metadata-initial-options"
        aria-labelledby="metadata-initial-title"
        aria-describedby="metadata-initial-help"
        data-testid="metadata-initial-options"
      >
        <div class="metadata-initial-heading">
          <h3 id="metadata-initial-title">内嵌初始行</h3>
          <p id="metadata-initial-help">
            默认不包含；勾选后会在 metadata.json 中冻结该页面数据源的当前结果。
          </p>
        </div>
        <div class="metadata-initial-list">
          {#each initialSources as source (source.id)}
            <label
              class="metadata-initial-source"
              data-metadata-initial-source={source.id}
              data-initial-rows={source.emptyRows ? 'empty' : 'present'}
            >
              <input
                type="checkbox"
                checked={includedInitialSourceIds.includes(source.id)}
                onchange={(event) =>
                  setInitialIncluded(source.id, event.currentTarget.checked)}
              />
              <code>{source.id}</code>
            </label>
          {/each}
        </div>
      </section>
    {/if}
    <pre
      role="region"
      aria-label="页面文档 JSON"
      data-serialization-source="metadata-json-projection"
      data-json-indent="2"
      data-contract-part
      data-testid="metadata-json-code"
    ><code>{formattedDocument}</code></pre>
  </div>

  {#if copyState !== 'idle'}
    <span class="sr-only" role="status" aria-live="polite">{copyLabel}</span>
  {/if}
</dialog>

<style>
  .metadata-json-drawer {
    position: fixed;
    inset: 0 0 0 auto;
    display: flex;
    flex-direction: column;
    width: min(720px, 92vw);
    max-width: none;
    height: 100dvh;
    max-height: none;
    padding: 0;
    margin: 0;
    color: var(--text);
    background: var(--surface);
    border: 0;
    border-left: 1px solid var(--line);
    box-shadow: -18px 0 48px rgb(24 24 27 / 18%);
  }

  .metadata-json-drawer::backdrop {
    background: rgb(24 24 27 / 42%);
  }

  .metadata-json-drawer:not([open]) {
    display: none;
  }

  .metadata-json-header {
    display: flex;
    flex: none;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    min-width: 0;
    padding: 18px 20px;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }

  .metadata-json-heading {
    min-width: 0;
  }

  h2 {
    margin: 0;
    font-size: 16px;
    line-height: 1.4;
  }

  .metadata-json-subtitle {
    max-width: 100%;
    margin: 4px 0 0;
    overflow-x: hidden;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .metadata-json-actions {
    display: flex;
    flex: none;
    gap: 6px;
  }

  .icon-button {
    display: grid;
    flex: none;
    place-items: center;
    width: 34px;
    height: 34px;
    padding: 0;
    color: var(--muted);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 9px;
    cursor: pointer;
    transition:
      color 0.15s ease,
      background 0.15s ease,
      border-color 0.15s ease;
  }

  .icon-button:hover {
    color: var(--text);
    background: var(--bg);
    border-color: var(--muted);
  }

  .icon-button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .icon-button[data-copy-state='copied'] {
    color: #15803d;
  }

  .icon-button[data-copy-state='error'] {
    color: #b91c1c;
  }

  .icon-button svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .metadata-json-body {
    flex: 1;
    min-width: 0;
    min-height: 0;
    padding: 18px 20px 28px;
    overflow-x: auto;
    overflow-y: auto;
    background: var(--bg);
  }

  .metadata-initial-options {
    display: grid;
    gap: 12px;
    min-width: 0;
    margin: 0 0 18px;
    padding: 14px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 10px;
  }

  .metadata-initial-heading {
    display: grid;
    gap: 4px;
  }

  .metadata-initial-heading h3,
  .metadata-initial-heading p {
    margin: 0;
  }

  .metadata-initial-heading h3 {
    color: var(--text);
    font-size: 13px;
    line-height: 1.4;
  }

  .metadata-initial-heading p {
    color: var(--muted);
    font-size: 12px;
    line-height: 1.5;
  }

  .metadata-initial-list {
    display: grid;
    gap: 8px;
  }

  .metadata-initial-source {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 9px;
    padding: 9px 10px;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 8px;
    cursor: pointer;
  }

  .metadata-initial-source:focus-within {
    border-color: var(--accent);
    outline: 2px solid color-mix(in srgb, var(--accent) 18%, transparent);
    outline-offset: 1px;
  }

  .metadata-initial-source input {
    width: 16px;
    height: 16px;
    flex: none;
    margin: 0;
    accent-color: var(--accent);
  }

  .metadata-initial-source code {
    min-width: 0;
    color: var(--text);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    line-height: 1.4;
    overflow-wrap: anywhere;
    white-space: normal;
  }

  pre {
    width: max-content;
    min-width: 100%;
    margin: 0;
    color: var(--text);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    line-height: 1.65;
    tab-size: 2;
    white-space: pre;
  }

  code {
    font: inherit;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 720px) {
    .metadata-json-drawer {
      width: 100vw;
    }
  }
</style>
