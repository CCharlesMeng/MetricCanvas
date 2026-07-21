<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import type { Page } from '@metriccanvas/page';
  import { runtimePreviewUrl } from '$lib/management-state';
  import {
    commitPageEdit,
    createPageEditorHistory,
    editComponent,
    listEditableComponents,
    moveComponent,
    redoPageEdit,
    undoPageEdit,
    type ComponentEdit,
    type ComponentLocator,
    type PageEditorHistory
  } from '$lib/page-editor';

  interface Revision {
    pageId: string;
    revisionId: string;
    revisionNumber: number;
    document: Page;
  }

  let history = $state<PageEditorHistory | null>(null);
  let baseRevision = $state<Revision | null>(null);
  let runtimeOrigin = $state('');
  let selectedKey = $state('');
  let loading = $state(true);
  let saving = $state(false);
  let error = $state('');
  let saveMessage = $state('');

  const pageId = $derived(page.params.pageId ?? '');
  const draft = $derived(history?.current ?? null);
  const components = $derived(draft ? listEditableComponents(draft) : []);
  const selected = $derived(
    components.find((component) => locatorKey(component.locator) === selectedKey) ?? null
  );
  const dirty = $derived(
    Boolean(
      history &&
        baseRevision &&
        JSON.stringify(history.current) !== JSON.stringify(baseRevision.document)
    )
  );

  onMount(() => {
    void loadLatest();
  });

  async function loadLatest() {
    loading = true;
    error = '';
    saveMessage = '';
    try {
      const response = await fetch(`/api/pages/${encodeURIComponent(pageId)}`);
      if (!response.ok) throw new Error(await responseMessage(response));
      const payload = (await response.json()) as {
        revision: Revision;
        runtimeOrigin: string;
      };
      baseRevision = payload.revision;
      runtimeOrigin = payload.runtimeOrigin;
      history = createPageEditorHistory(payload.revision.document);
      const first = listEditableComponents(payload.revision.document)[0];
      selectedKey = first ? locatorKey(first.locator) : '';
    } catch (cause) {
      error = cause instanceof Error ? cause.message : '页面修订加载失败';
    } finally {
      loading = false;
    }
  }

  function applyComponentEdit(edit: ComponentEdit) {
    if (!history || !selected) return;
    history = commitPageEdit(
      history,
      editComponent(history.current, selected.locator, edit)
    );
    saveMessage = '';
  }

  function changeOrder(direction: -1 | 1) {
    if (!history || !selected) return;
    history = commitPageEdit(
      history,
      moveComponent(history.current, selected.locator, direction)
    );
    saveMessage = '';
  }

  function undo() {
    if (!history) return;
    history = undoPageEdit(history);
    saveMessage = '';
  }

  function redo() {
    if (!history) return;
    history = redoPageEdit(history);
    saveMessage = '';
  }

  async function saveRevision() {
    if (!history || !baseRevision || !dirty || saving) return;
    saving = true;
    error = '';
    saveMessage = '';
    try {
      const response = await fetch(
        `/api/pages/${encodeURIComponent(pageId)}/revisions`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            baseRevisionId: baseRevision.revisionId,
            document: history.current,
            idempotencyKey: crypto.randomUUID()
          })
        }
      );
      const payload = (await response.json()) as {
        revision?: Revision;
        error?: { code?: string; message?: string; validationErrors?: unknown[] };
      };
      if (!response.ok || !payload.revision) {
        const detail = payload.error?.validationErrors?.length
          ? `（${payload.error.validationErrors.length} 个校验问题）`
          : '';
        throw new Error(
          `${payload.error?.code ?? 'SAVE_FAILED'}: ${payload.error?.message ?? `HTTP ${response.status}`}${detail}`
        );
      }
      baseRevision = payload.revision;
      history = createPageEditorHistory(payload.revision.document);
      saveMessage = `页面文档校验通过，已保存为 R${payload.revision.revisionNumber}。`;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : '页面修订保存失败';
    } finally {
      saving = false;
    }
  }

  function locatorKey(locator: ComponentLocator): string {
    return `${locator.sectionId}/${locator.componentId}`;
  }

  function valueOf(event: Event): string {
    return (event.currentTarget as HTMLInputElement | HTMLTextAreaElement).value;
  }

  async function responseMessage(response: Response): Promise<string> {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    return payload?.error?.message ?? `HTTP ${response.status}`;
  }
</script>

<svelte:head>
  <title>编辑看板页面 | MetricCanvas</title>
</svelte:head>

<section class="editor-page">
  <div class="topbar">
    <div>
      <a href={`/manage/pages/${encodeURIComponent(pageId)}`}>← 返回页面修订</a>
      <p class="eyebrow">页面修订编辑</p>
      <h1>{pageId}</h1>
    </div>
    <div class="toolbar" aria-label="编辑历史与保存">
      <button class="secondary" type="button" onclick={undo} disabled={!history?.past.length}>
        ← 撤销
      </button>
      <button class="secondary" type="button" onclick={redo} disabled={!history?.future.length}>
        重做 →
      </button>
      <button type="button" onclick={saveRevision} disabled={!dirty || saving}>
        {saving ? '正在校验并保存…' : '校验并保存新修订'}
      </button>
    </div>
  </div>

  {#if loading}
    <p class="muted">加载当前最新页面修订…</p>
  {:else if !history || !baseRevision}
    <div class="error"><p>{error || '页面修订不可用'}</p><button onclick={loadLatest}>重试</button></div>
  {:else}
    <div class="statusbar">
      <span>编辑基线 <strong>R{baseRevision.revisionNumber}</strong></span>
      <span class:dirty>{dirty ? '工作副本有未保存修改' : '工作副本与基线一致'}</span>
      <span>{components.length} 个组件</span>
    </div>

    {#if error}<div class="error" role="alert">{error}</div>{/if}
    {#if saveMessage}<div class="success" role="status">{saveMessage}</div>{/if}

    <div class="workspace">
      <aside class="component-panel">
        <div class="panel-heading">
          <span class="step">1</span>
          <div><h2>组件</h2><p>选择要修改的页面组件</p></div>
        </div>
        <ol>
          {#each components as component (locatorKey(component.locator))}
            <li class:selected={locatorKey(component.locator) === selectedKey}>
              <button
                type="button"
                onclick={() => (selectedKey = locatorKey(component.locator))}
              >
                <span class="component-type">{component.typeLabel}</span>
                <strong>{component.title || component.locator.componentId}</strong>
                <small>{component.locator.componentId} · {component.span}/12</small>
              </button>
            </li>
          {/each}
        </ol>
      </aside>

      <main class="property-panel">
        {#if selected}
          <section>
            <div class="panel-heading">
              <span class="step">2</span>
              <div><h2>内容</h2><p>{selected.typeLabel} · {selected.locator.componentId}</p></div>
            </div>
            <label>
              标题
              <input
                value={selected.title}
                required={selected.type === 'reportHeader'}
                oninput={(event) => applyComponentEdit({ title: valueOf(event) })}
              />
            </label>
            {#if selected.detailLabel}
              <label>
                {selected.detailLabel}
                <textarea
                  rows="4"
                  oninput={(event) => applyComponentEdit({ detail: valueOf(event) })}
                >{selected.detail}</textarea>
              </label>
            {:else}
              <p class="hint">这一组件的首个切片只开放标题编辑；指标和维度仍由 Agent 受治理地修改。</p>
            {/if}
          </section>

          <section>
            <div class="panel-heading">
              <span class="step">3</span>
              <div><h2>布局</h2><p>12 列自动流网格</p></div>
            </div>
            <label>
              网格跨度
              <select
                value={String(selected.span)}
                onchange={(event) =>
                  applyComponentEdit({ span: Number((event.currentTarget as HTMLSelectElement).value) })}
              >
                {#each Array.from({ length: 12 }, (_, index) => index + 1) as span}
                  <option value={span}>{span} / 12</option>
                {/each}
              </select>
            </label>
            <div class="order-actions">
              <button
                class="secondary"
                type="button"
                disabled={selected.position === 0}
                onclick={() => changeOrder(-1)}
              >向前移动</button>
              <button
                class="secondary"
                type="button"
                disabled={selected.position === selected.count - 1}
                onclick={() => changeOrder(1)}
              >向后移动</button>
            </div>
          </section>
        {:else}
          <div class="empty">当前页面没有可编辑组件。</div>
        {/if}
      </main>

      <aside class="preview-panel">
        <div class="panel-heading">
          <span class="step">4</span>
          <div><h2>精确预览</h2><p>固定到已保存的 R{baseRevision.revisionNumber}</p></div>
        </div>
        {#if dirty}
          <p class="preview-note">工作副本尚未成为页面修订；校验并保存后，预览会切换到新修订。</p>
        {/if}
        <iframe
          title={`R${baseRevision.revisionNumber} 统一运行时精确预览`}
          src={runtimePreviewUrl(runtimeOrigin, pageId, baseRevision.revisionId)}
        ></iframe>
      </aside>
    </div>
  {/if}
</section>

<style>
  .editor-page { max-width: 1680px; margin: 0 auto; padding: 24px 24px 64px; }
  .topbar { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 18px; }
  .topbar a { color: #3f3f46; font-size: 13px; }
  .eyebrow { margin: 18px 0 4px; color: #52525b; font-size: 11px; font-weight: 800; letter-spacing: .08em; }
  h1, h2, p { margin-top: 0; }
  h1 { margin-bottom: 0; font-size: 26px; }
  h2 { margin-bottom: 2px; font-size: 15px; }
  .toolbar, .order-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  button { border: 1px solid #27272a; border-radius: 7px; padding: 9px 13px; color: #fff; background: #27272a; font: inherit; cursor: pointer; }
  button.secondary { color: #27272a; background: #fff; }
  button:disabled { cursor: not-allowed; opacity: .42; }
  .statusbar { display: flex; flex-wrap: wrap; gap: 18px; padding: 11px 14px; margin-bottom: 14px; border: 1px solid #e4e4e7; border-radius: 8px; background: #fff; color: #52525b; font-size: 13px; }
  .statusbar .dirty { color: #9a3412; font-weight: 700; }
  .workspace { display: grid; grid-template-columns: minmax(220px, 280px) minmax(280px, 360px) minmax(480px, 1fr); gap: 14px; align-items: start; }
  .component-panel, .property-panel > section, .preview-panel, .error, .success, .empty { padding: 16px; border: 1px solid #e4e4e7; border-radius: 10px; background: #fff; }
  .property-panel { display: grid; gap: 14px; }
  .panel-heading { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 14px; }
  .panel-heading p { margin-bottom: 0; color: #71717a; font-size: 12px; }
  .step { display: grid; place-items: center; flex: 0 0 25px; height: 25px; border-radius: 999px; color: #fff; background: #27272a; font-size: 12px; font-weight: 800; }
  .component-panel ol { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
  .component-panel li button { display: grid; width: 100%; gap: 3px; padding: 11px; color: #27272a; text-align: left; background: #fafafa; border-color: #e4e4e7; }
  .component-panel li.selected button { background: #eef2ff; border-color: #6366f1; }
  .component-type { color: #6366f1; font-size: 11px; font-weight: 800; }
  .component-panel small { overflow: hidden; color: #71717a; text-overflow: ellipsis; white-space: nowrap; }
  label { display: grid; gap: 6px; margin-top: 12px; color: #3f3f46; font-size: 13px; font-weight: 700; }
  input, textarea, select { width: 100%; border: 1px solid #d4d4d8; border-radius: 7px; padding: 9px 10px; color: #18181b; background: #fff; font: inherit; font-weight: 400; }
  textarea { resize: vertical; }
  .order-actions { margin-top: 14px; }
  .hint, .preview-note { margin: 12px 0 0; color: #71717a; font-size: 12px; line-height: 1.6; }
  .preview-note { padding: 9px 11px; margin: -2px 0 12px; color: #92400e; background: #fffbeb; border-radius: 7px; }
  iframe { width: 100%; min-height: 680px; border: 1px solid #d4d4d8; border-radius: 8px; background: #fff; }
  .error { margin-bottom: 14px; color: #991b1b; background: #fef2f2; border-color: #fecaca; }
  .success { margin-bottom: 14px; color: #166534; background: #f0fdf4; border-color: #bbf7d0; }
  .muted { color: #71717a; }
  @media (max-width: 1180px) { .workspace { grid-template-columns: 260px minmax(0, 1fr); } .preview-panel { grid-column: 1 / -1; } }
  @media (max-width: 720px) { .topbar { align-items: stretch; flex-direction: column; } .workspace { grid-template-columns: 1fr; } .preview-panel { grid-column: auto; } iframe { min-height: 520px; } }
</style>
