<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { resolve } from '$app/paths';
  import { pageAssets } from '$lib/page-assets';
  import { MetricCanvas, type AuthoringIntent } from '@metriccanvas/metric-canvas';
  import { createWorkbenchDqeGateway } from './workbench/data-gateway';
  import { workbenchPageViewModel } from './workbench/transient-page';
  import {
    changeComponentType, componentCandidatesFor, createCanvasAuthoringDraft,
    editComponent, locatorOfComponent, moveComponent,
    type ComponentLocator, type CanvasAuthoringDraft, type DocumentEditResult
  } from './workbench/document-edit';
  import Inspector from './workbench/Inspector.svelte';
  import MetadataJsonDrawer from './workbench/MetadataJsonDrawer.svelte';
  import RevisionPreview from './RevisionPreview.svelte';

  let currentDraft = $state<CanvasAuthoringDraft | null>(null);
  let baseRevisionId = $state<string | null>(null);
  let savePending = $state(false);
  let loading = $state(false);
  let saveNotice = $state('');
  let saveError = $state('');
  let editError = $state('');
  let metadataOpen = $state(false);
  let previewOpen = $state(false);
  let metadataEntryEl: HTMLButtonElement | null = $state(null);
  let selectedComponent = $state<ComponentLocator | null>(null);
  const dataGateway = createWorkbenchDqeGateway();

  // 已保存页面通过页面资产客户端进入工作台，不依赖旧分析会话检查点。
  onMount(() => {
    const pageId = new URLSearchParams(window.location.search).get('page');
    if (pageId) void loadPage(pageId);
  });

  async function loadPage(pageId: string) {
    loading = true;
    try {
      const revision = await pageAssets.getLatest(pageId);
      if (replaceCurrentDocument({ ...revision.document })) baseRevisionId = revision.revisionId;
    } catch (cause) {
      saveError = cause instanceof Error ? cause.message : String(cause);
    } finally {
      loading = false;
    }
  }
  const currentDocument = $derived(currentDraft?.pageDocument ?? null);
  const canvasDocument = $derived(currentDraft?.canvasDocument ?? null);
  const pageModel = $derived(
    currentDocument ? workbenchPageViewModel(currentDocument) : null
  );
  const selectedView = $derived(
    selectedComponent === null
      ? null
      : (pageModel?.components.find(
          (component) => component.componentId === selectedComponent?.componentId
        ) ?? null)
  );
  const typeCandidates = $derived(
    currentDocument && selectedView?.dataSourceId
      ? componentCandidatesFor(currentDocument, selectedView.dataSourceId)
      : []
  );
  const selectedSpan = $derived.by(() => {
    if (!canvasDocument || !selectedComponent) return null;
    const sections = Array.isArray(canvasDocument.sections)
      ? (canvasDocument.sections as Array<Record<string, unknown>>)
      : [];
    for (const section of sections) {
      if (section.id !== selectedComponent.sectionId) continue;
      const components = Array.isArray(section.components)
        ? (section.components as Array<Record<string, unknown>>)
        : [];
      const component = components.find(
        (candidate) => candidate.id === selectedComponent?.componentId
      );
      const layout = component?.layout;
      if (typeof layout === 'object' && layout !== null) {
        const span = (layout as { span?: unknown }).span;
        return typeof span === 'number' ? span : null;
      }
    }
    return null;
  });
  const selectedColumnCount = $derived.by(() => {
    if (!canvasDocument || !selectedComponent) return 12;
    const sections = Array.isArray(canvasDocument.sections)
      ? (canvasDocument.sections as Array<Record<string, unknown>>)
      : [];
    const section = sections.find((candidate) => candidate.id === selectedComponent?.sectionId);
    return Array.isArray(section?.columnTracks) ? section.columnTracks.length : 12;
  });
  const selectedFieldRows = $derived.by(() => {
    if (!currentDocument || !selectedView?.dataSourceId) return [];
    const dataSources = currentDocument.dataSources;
    if (typeof dataSources !== 'object' || dataSources === null) return [];
    const dataSource = (dataSources as Record<string, unknown>)[selectedView.dataSourceId];
    if (typeof dataSource !== 'object' || dataSource === null) return [];
    const fields = (dataSource as { fields?: unknown }).fields;
    if (typeof fields !== 'object' || fields === null) return [];
    return Object.entries(fields as Record<string, Record<string, unknown>>).map(
      ([fieldId, field]) => ({
        fieldId,
        label: typeof field.label === 'string' ? field.label : fieldId,
        role: typeof field.role === 'string' ? field.role : '',
        type: typeof field.type === 'string' ? field.type : ''
      })
    );
  });

  async function saveRevision() {
    if (!currentDocument || !pageModel || pageModel.transient || savePending) return;
    savePending = true;
    saveError = '';
    try {
      const revision = await pageAssets.saveRevision(pageModel.pageId, {
        baseRevisionId,
        document: currentDocument,
        idempotencyKey: crypto.randomUUID(),
        pageIdConfirmed: true
      });
      baseRevisionId = revision.revisionId;
      saveNotice =
        `已保存修订 R${revision.revisionNumber}，数据上下文版本：` +
        `${revision.dataContextVersion ?? '未记录'}`;
    } catch (cause) {
      saveError = cause instanceof Error ? cause.message : String(cause);
    } finally {
      savePending = false;
    }
  }

  /** 文档替换后按组件 id 重定位选中项；组件已消失则清除检查器上下文。 */
  function replaceCurrentDocument(document: Record<string, unknown>): boolean {
    const result = createCanvasAuthoringDraft(document);
    if (!result.ok) {
      editError = result.message;
      return false;
    }
    currentDraft = result.draft;
    if (selectedComponent) {
      selectedComponent = locatorOfComponent(
        result.draft.canvasDocument,
        selectedComponent.componentId
      );
    }
    editError = '';
    return true;
  }

  function applyDocumentEdit(result: DocumentEditResult) {
    if (result.ok) {
      currentDraft = result.draft;
      if (selectedComponent) {
        selectedComponent = locatorOfComponent(
          result.draft.canvasDocument,
          selectedComponent.componentId
        );
      }
      editError = '';
    } else {
      editError = result.message;
    }
  }

  /** 画布创作意图分发:选中进检查器,重排与标题/宽度编辑走本地文档改写。 */
  function handleAuthoringIntent(intent: AuthoringIntent) {
    if (intent.type === 'select_component') {
      selectedComponent = intent.locator;
      return;
    }
    if (savePending || !currentDraft) return;
    if (intent.type === 'move_component') {
      const result = moveComponent(currentDraft, intent.locator, intent.destination);
      applyDocumentEdit(result);
      if (result.ok) {
        selectedComponent = locatorOfComponent(
          result.draft.canvasDocument,
          intent.locator.componentId
        );
      }
    } else if (intent.type === 'edit_component') {
      applyDocumentEdit(editComponent(currentDraft, intent.locator, intent.edit));
    }
  }

  /** 组件形态切换通过浏览器局部构造即时改写工作副本。 */
  function selectComponentType(type: string) {
    if (savePending || !currentDraft || !selectedComponent || !selectedView?.dataSourceId) return;
    const result = changeComponentType(
      currentDraft,
      selectedComponent,
      type as Parameters<typeof changeComponentType>[2]
    );
    applyDocumentEdit(result);
  }

  function selectComponentFromList(componentId: string) {
    if (!canvasDocument) return;
    selectedComponent = locatorOfComponent(canvasDocument, componentId);
  }

  function closeMetadataDrawer() {
    metadataOpen = false;
    void tick().then(() => metadataEntryEl?.focus());
  }
</script>
<svelte:head>
  <title>MetricCanvas 页面搭建工作台</title>
</svelte:head>

<div class="workbench" data-testid="workbench">
  <div class="docbar" data-testid="workbench-contextbar" data-contract-critical>
    <div class="l">
      <strong class="canvas-title">页面画布</strong>
      {#if pageModel}
        <span class="badge" class:transient={pageModel.transient}>
          {pageModel.transient ? '临时页面态' : '未保存工作副本'}
        </span>
        {#if pageModel.adHocFormulas.length > 0}
          <!-- 临时指标与已定义指标视觉可区分(ADR-0036、#67):文档含现场
               生成的 formula 口径时,结果区常驻警示徽标。 -->
          <span class="badge adhoc" title={pageModel.adHocFormulas.join(';')}>
            临时指标 ×{pageModel.adHocFormulas.length}
          </span>
        {/if}
        <code class="page-id">{pageModel.pageId}</code>
        <span class="stat">组件 {pageModel.components.length}</span>
        <span class="stat">页面数据源 {pageModel.dataSourceCount}</span>
      {:else}
        <span class="badge idle">尚无页面文档</span>
      {/if}
    </div>
    <div class="r" data-testid="document-actions">
      {#if baseRevisionId}
        <button class="btn" onclick={() => (previewOpen = !previewOpen)}>精确修订预览</button>
      {/if}
      <button
        type="button"
        class="btn"
        bind:this={metadataEntryEl}
        data-testid="metadata-json-entry"
        disabled={!currentDocument}
        title={currentDocument ? '查看元数据' : '页面文档生成后可查看'}
        onclick={() => (metadataOpen = true)}
      >
        查看元数据
      </button>
      {#if pageModel && !pageModel.transient}
        <button type="button" class="btn" disabled={savePending} onclick={saveRevision}>
          {savePending ? '保存中…' : baseRevisionId ? '保存新修订' : '保存首个修订'}
        </button>
      {/if}
    </div>
  </div>

  <aside class="chat" aria-label="分析会话" data-testid="workbench-track">
    <header class="chat-header"><h1>分析与搭建</h1></header>
    <div class="thread">
      <div class="thread-empty" role="status" data-testid="chat-unavailable">
        <h2>公共 Chat 暂不可用</h2>
        <p>对话服务尚未接通。你可以从页面目录打开已保存页面，继续人工页面搭建。</p>
        <a class="linkish" href={resolve('/manage')}>打开页面目录</a>
      </div>
    </div>
    <div class="composer">
      <div class="composer-box">
        <textarea rows="1" aria-label="AI 输入" placeholder="公共 Chat 暂不可用" disabled></textarea>
        <button class="action send" type="button" aria-label="发送" disabled>↑</button>
      </div>
    </div>
  </aside>

  <main class="canvas" aria-label="页面画布" data-testid="workbench-track">
    {#if saveNotice}<p class="notice">{saveNotice}</p>{/if}
    {#if saveError}<p class="error" role="alert">{saveError}</p>{/if}
    {#if editError}<p class="error" role="alert">{editError}</p>{/if}

    <div class="page-scroll">
      {#if previewOpen && pageModel && baseRevisionId}
        <p class="notice">正在预览已保存修订；再次点击“精确修订预览”返回工作副本。</p>
        <RevisionPreview pageId={pageModel.pageId} revisionId={baseRevisionId} />
      {:else if currentDocument}
        <MetricCanvas
          document={currentDocument}
          {dataGateway}
          enabled={!savePending}
          selected={selectedComponent ?? undefined}
          draftSections={currentDraft?.authoringSections}
          inlineControls={false}
          onintent={handleAuthoringIntent}
        />
      {:else}
        <div class="empty">
          <h2>{loading ? '正在加载页面文档…' : '从页面目录打开页面'}</h2>
          <p>
            已保存页面可在这里调整组件与布局，并显式保存为新修订。
          </p>
        </div>
      {/if}
    </div>
  </main>

  <aside
    class="inspector-track"
    aria-label="检查器"
    data-testid="workbench-track"
    data-contract-critical
  >
    <Inspector
      {pageModel}
      selected={selectedComponent}
      {selectedView}
      {selectedSpan}
      {selectedColumnCount}
      candidates={typeCandidates}
      fieldRows={selectedFieldRows}
      busy={savePending || previewOpen}
      onSelectType={selectComponentType}
      onSelectComponent={selectComponentFromList}
      onEdit={(edit) => {
        if (!savePending && currentDraft && selectedComponent) {
          applyDocumentEdit(editComponent(currentDraft, selectedComponent, edit));
        }
      }}
    />
  </aside>

  {#if metadataOpen && currentDocument && pageModel}
    <MetadataJsonDrawer
      document={currentDocument}
      pageId={pageModel.pageId}
      transient={pageModel.transient}
      onclose={closeMetadataDrawer}
    />
  {/if}
</div>

<style>
  .workbench {
    display: grid;
    grid-template-columns: var(--analysis-rail-w) minmax(0, 1fr) var(--inspector-rail-w);
    grid-template-rows: var(--contextbar-h) minmax(0, 1fr);
    height: 100%;
    min-height: 0;
    min-width: 0;
    background: var(--bg);
    overflow: hidden;
  }
  .chat {
    grid-column: 1;
    grid-row: 2;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    color: var(--text);
    background: var(--surface);
    border-right: 1px solid var(--line);
  }
  .chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 40px;
    padding: 7px 10px 7px 13px;
    border-bottom: 1px solid var(--line);
  }
  .chat-header h1 {
    margin: 0;
    color: var(--text);
    font-size: 12.5px;
    font-weight: 650;
    letter-spacing: -0.01em;
  }

  .thread {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
    padding: 12px 13px;
    overflow-y: auto;
  }
  .thread-empty {
    display: grid;
    gap: 7px;
    margin-top: 12cqh;
    color: var(--muted);
    font-size: 11px;
    line-height: 1.55;
    text-align: left;
  }
  .thread-empty h2 {
    margin: 0;
    color: var(--text);
    font-size: 13px;
    letter-spacing: -0.01em;
  }
  .thread-empty p {
    margin: 0;
    max-width: 26rem;
  }

  /* 执行过程:linkish 切换 + 展开区虚线分隔(原型 v2)。 */

  @keyframes dot-bounce {
    0%,
    60%,
    100% {
      opacity: 0.35;
      transform: translateY(0);
    }
    30% {
      opacity: 1;
      transform: translateY(-3px);
    }
  }
  .linkish {
    padding: 0;
    color: var(--accent-strong);
    background: none;
    border: 0;
    font-size: 11.5px;
    cursor: pointer;
    transition: color 0.15s ease;
  }
  .linkish:hover {
    color: var(--accent-strong);
    text-decoration: underline;
  }

  .composer {
    display: grid;
    gap: 5px;
    padding: 8px 10px 9px;
    background: var(--surface);
    border-top: 1px solid var(--line);
  }

  /* 紧凑输入容器：单行约 32px，1～4 行增高，第 5 行内部滚动。 */
  .composer-box {
    display: flex;
    align-items: flex-end;
    gap: 5px;
    padding: 3px 4px 3px 9px;
    background: var(--surface-subtle);
    border: 1px solid var(--control-line);
    border-radius: 8px;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }
  .composer-box:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 16%, transparent);
  }
  .composer-box textarea {
    flex: 1;
    min-width: 0;
    height: auto;
    max-height: 74px;
    padding: 5px 0;
    overflow-x: hidden;
    overflow-y: hidden;
    color: var(--text);
    border: 0;
    resize: none;
    background: none;
    font-size: 11px;
    line-height: 16px;
  }
  .composer-box textarea::placeholder {
    color: var(--faint);
  }
  .composer-box textarea:focus {
    outline: none;
  }
  .composer .action {
    display: grid;
    flex: none;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    cursor: pointer;
    transition:
      background 0.15s ease,
      transform 0.1s ease,
      opacity 0.15s ease;
  }
  .composer .action:active:not(:disabled) {
    transform: scale(0.94);
  }

  .composer .send {
    color: var(--text-on-strong);
    background: var(--accent);
  }
  .composer .send:hover:not(:disabled) {
    background: var(--accent-strong);
  }
  .composer .send:disabled {
    background: var(--control-line);
    cursor: not-allowed;
  }


  .canvas {
    grid-column: 2;
    grid-row: 2;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    background: var(--bg);
  }
  .inspector-track {
    grid-column: 3;
    grid-row: 2;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--surface);
    border-left: 1px solid var(--line);
  }
  .inspector-track :global(.inspector) {
    width: 100%;
    height: 100%;
  }
  .docbar {
    grid-column: 1 / -1;
    grid-row: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    height: var(--contextbar-h);
    min-width: 0;
    padding: 0 10px 0 13px;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }
  .docbar .l,
  .docbar .r {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }
  .docbar .r {
    flex: none;
  }
  .canvas-title {
    flex: none;
    color: var(--text);
    font-size: 11.5px;
    font-weight: 650;
  }
  .badge {
    padding: 2px 7px;
    color: #3730a3;
    background: #eef2ff;
    border-radius: 5px;
    font-size: 9.5px;
    font-weight: 650;
  }
  .badge.transient {
    color: #92400e;
    background: #fef3c7;
  }
  .badge.adhoc {
    color: #92400e;
    background: #fef3c7;
    border: 1px solid #fde68a;
  }
  .badge.idle {
    color: #71717a;
    background: #f4f4f5;
  }
  .page-id {
    max-width: 160px;
    overflow: hidden;
    color: #3f3f46;
    font-size: 10.5px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .stat {
    color: #71717a;
    font-size: 10.5px;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.4;
      transform: scale(0.75);
    }
  }

  .btn {
    height: 28px;
    padding: 0 9px;
    color: var(--text);
    background: var(--surface);
    border: 1px solid #d4d4d8;
    border-radius: 6px;
    font-size: 10.5px;
    font-weight: 550;
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      box-shadow 0.15s ease,
      transform 0.1s ease;
  }
  .btn:hover:not(:disabled) {
    border-color: #a1a1aa;
    box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
  }
  .btn:active:not(:disabled) {
    transform: translateY(1px);
  }
  .btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .notice {
    margin: 0;
    padding: 6px 12px;
    color: #166534;
    background: #f0fdf4;
    border-bottom: 1px solid #dcfce7;
    font-size: 10.5px;
  }
  .error {
    margin: 0;
    padding: 6px 12px;
    color: #b91c1c;
    background: #fef2f2;
    border-bottom: 1px solid #fecaca;
    font-size: 10.5px;
  }
  .page-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  /* 运行中的骨架屏:预示即将出现的看板网格,shimmer 呼吸。 */

  @keyframes shimmer {
    to {
      background-position: -200% 0;
    }
  }
  .empty {
    display: grid;
    place-content: center;
    min-height: 60cqh;
    text-align: center;
    color: #71717a;
  }
  .empty h2 {
    margin: 0 0 8px;
    font-size: 18px;
    color: #3f3f46;
  }
  .empty p {
    margin: 0;
    max-width: 42rem;
    font-size: 13px;
    line-height: 1.7;
  }
  @container platform (max-width: 1100px) {
    .docbar .stat,
    .page-id {
      display: none;
    }
  }
  @container platform (max-width: 760px) {
    .workbench {
      --analysis-rail-w: 250px;
      grid-template-columns: var(--analysis-rail-w) minmax(0, 1fr);
    }
    .inspector-track {
      display: none;
    }
  }
</style>
