<script lang="ts">
  import { readAuthoringIntegration } from './dialogue/authoring-integration';
  import { createAuthoringLanguageRecovery, type TrustedLanguageRecoveryPort } from './workbench/authoring-language-recovery';
  import { createAuthoringLanguage, type LanguagePort } from './workbench/authoring-language';
  import PublicationReview from './workbench/PublicationReview.svelte';
  import { createAuthoringPublication, unavailablePublicationPort, unavailableHumanConfirmation, type PublicationPort, type HumanConfirmationPort } from './workbench/authoring-publication';
  import AuthoringHistory from './workbench/AuthoringHistory.svelte';
  import { onMount, tick, untrack } from 'svelte';
  import { resolve } from '$app/paths';
  import { pageAuthoringPort, pageSavePort } from '$lib/page-assets';
  import { createAuthoringCoordinator, type AuthoringPort, type DraftRef } from './workbench/authoring-coordinator';
  import { MetricCanvas, type AuthoringIntent } from '@metriccanvas/metric-canvas';
  import { createWorkbenchDqeGateway } from './workbench/data-gateway';
  import { workbenchPageViewModel } from './workbench/transient-page';
  import {
    changeComponentType, componentCandidatesFor,
    editComponent, locatorOfComponent, moveComponent,
    type ComponentLocator, type DocumentEditResult
  } from './workbench/document-edit';
  import { propertyControls, editProperty } from './workbench/property-edit';
  import Inspector from './workbench/Inspector.svelte';
  import MetadataJsonDrawer from './workbench/MetadataJsonDrawer.svelte';
  import RevisionPreview from './RevisionPreview.svelte';
  import PanguDialogue from './dialogue/PanguDialogue.svelte';
  import { listenForSavedDrafts, unavailableDraftReader, type ReadSavedDraft, type DialogueAdapter } from './dialogue/port';
  import { readPageAssetsRuntimeConfig as readRuntimeConfig } from './runtime-config';
  import { listenForApplyPage } from './workbench/apply-page';
  import { createIndexedAuthoringStorage } from './workbench/authoring-storage';
  import { unavailableStableSave, type StableSavePort, type DurableAuthoringState } from './workbench/authoring-sync';
  let { dialogueAdapter, readSavedDraft, authoringPort = pageAuthoringPort, stableSavePort = authoringPort === pageAuthoringPort ? pageSavePort : unavailableStableSave, languagePort = readAuthoringIntegration()?.language, onLanguageReady, languageRecoveryPort, onLanguageRecoveryReady, publicationPort = unavailablePublicationPort, humanConfirmation = unavailableHumanConfirmation }: {
    publicationPort?: PublicationPort; humanConfirmation?: HumanConfirmationPort;
    languageRecoveryPort?: TrustedLanguageRecoveryPort; onLanguageRecoveryReady?: (api: ReturnType<typeof createAuthoringLanguageRecovery>) => void;
    languagePort?: LanguagePort; onLanguageReady?: (api: ReturnType<typeof createAuthoringLanguage>) => void;
    dialogueAdapter?: DialogueAdapter; readSavedDraft?: ReadSavedDraft; authoringPort?: AuthoringPort; stableSavePort?: StableSavePort;
  } = $props();
  const coordinator = untrack(() => createAuthoringCoordinator({
    port: {
      ...authoringPort,
      capabilities: { ...authoringPort.capabilities, exactDraftRead: !!readSavedDraft || authoringPort.capabilities.exactDraftRead },
      readSavedDraft: readSavedDraft ?? authoringPort.readSavedDraft ?? unavailableDraftReader
    },
    identity: () => {
      const config = readRuntimeConfig();
      return { actorId: config?.operatorId ?? '', workspaceId: config?.workspaceId ?? '' };
    }
  }));
  let publication = $state<ReturnType<typeof createAuthoringPublication> | null>(null);
  let publicationOpen = $state(false);
  let publicationBusy = $state(false);
  let language = $state<ReturnType<typeof createAuthoringLanguage> | null>(null);
  let languageState = $state<ReturnType<ReturnType<typeof createAuthoringLanguage>['snapshot']> | null>(null);
  let languageRecovery = $state<ReturnType<typeof createAuthoringLanguageRecovery> | null>(null);
  let recoveryState = $state<ReturnType<ReturnType<typeof createAuthoringLanguageRecovery>['snapshot']> | null>(null);
  let authoring = $state(coordinator.snapshot());
  const currentDraft = $derived(authoring.draft);
  const baseRevisionId = $derived(authoring.ref?.revisionId ?? null);
  const savePending = $derived(authoring.save?.status === 'pending' || authoring.languageLocked || publicationBusy);
  const saveBlocked = $derived(savePending || authoring.save?.status === 'unknown' ||
    (authoring.save?.status === 'rejected' && authoring.save.code === 'REVISION_CONFLICT'));
  const loading = $derived(authoring.loading);
  const saveNotice = $derived(authoring.save?.status === 'saved' ? `已保存修订 R${authoring.save.revision.revisionNumber}` : '');
  let saveError = $state('');
  let editError = $state('');
  let retainDimensionValues = $state(true);
  let metadataOpen = $state(false);
  let previewOpen = $state(false);
  let historyOpen = $state(false);
  let previewRef = $state<DraftRef | null>(null);
  let metadataEntryEl: HTMLButtonElement | null = $state(null);
  let flushingInput = false;
  let workbenchElement: HTMLDivElement;
  let selectedComponent = $state<ComponentLocator | null>(null);
  const dataGateway = createWorkbenchDqeGateway();

  // Coordinator owns the working copy; UI only projects snapshots and forwards intents.
  onMount(() => {
    const pageId = new URLSearchParams(window.location.search).get('page');
    let syncEnabled = false;
    const enableSync = () => {
      if (syncEnabled) return;
      syncEnabled = true;
      coordinator.enableAutoSync({ storage: createIndexedAuthoringStorage<DurableAuthoringState>(), port: stableSavePort });
    };
    const resume = async (targetPageId: string | null) => { enableSync(); if (targetPageId) await coordinator.load(targetPageId, {resourceId:new URLSearchParams(window.location.search).get('resource') ?? undefined}); };
    if (languageRecoveryPort) {
      languageRecovery = createAuthoringLanguageRecovery({ coordinator, port: languageRecoveryPort,
        identity: () => { const config = readRuntimeConfig(); return { actorId: config?.operatorId ?? '', workspaceId: config?.workspaceId ?? '' }; },
        currentPageId: () => new URLSearchParams(window.location.search).get('page'), resume, protectSaved: enableSync });
      languageRecovery.subscribe(value => { recoveryState = value; });
      void languageRecovery.check(pageId);
      onLanguageRecoveryReady?.(languageRecovery);
    } else void resume(pageId);
    coordinator.setOnline(navigator.onLine);
    const online = () => coordinator.setOnline(true);
    const offline = () => coordinator.setOnline(false);
    window.addEventListener('online', online); window.addEventListener('offline', offline);
    if (publicationPort.available) publication = createAuthoringPublication({ port: publicationPort, human: humanConfirmation, scope: coordinator.scope, synchronizedRef: coordinator.requireSynchronizedRef, identity: () => { const config = readRuntimeConfig(); return { actorId: config?.operatorId ?? '', workspaceId: config?.workspaceId ?? '' }; } });
    publication?.subscribe(value => { publicationBusy = value.phase === 'busy' || value.phase === 'unknown'; });
    const unsubscribe = coordinator.subscribe((snapshot) => { authoring = snapshot; publication?.invalidate(); });
    let disconnectAuthoring: void | (() => void);
    if (languagePort) {
      language = createAuthoringLanguage({ coordinator, port: languagePort, target: window,
        selection: () => currentDocument && selectedComponent ? { pageId: String(currentDocument.id), componentId: selectedComponent.componentId } : null,
        flushPendingInput: () => {
          const input = document.activeElement;
          if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) || !workbenchElement?.contains(input)) return;
          flushingInput = true;
          try { input.dispatchEvent(new Event('change', { bubbles: true })); input.blur(); } finally { flushingInput = false; }
        },
        identity: () => { const config = readRuntimeConfig(); return { actorId: config?.operatorId ?? '', workspaceId: config?.workspaceId ?? '' }; } });
      language.subscribe((value) => { languageState = value; });
      onLanguageReady?.(language);
      disconnectAuthoring = readAuthoringIntegration()?.connect?.(language);
    }
    const stop = languagePort ? () => {} : listenForSavedDrafts({
      target: window, read: coordinator.readSavedDraft,
      captureIdentity: () => {
        const identity = readRuntimeConfig();
        return JSON.stringify([identity?.operatorId, identity?.workspaceId]);
      },
      captureScope: coordinator.scope,
      onpage: (draft) => {
        const accepted = coordinator.acceptSavedDraft(draft);
        if (accepted) { previewOpen = false; saveError = ''; relocateSelection(); }
        return accepted;
      },
      onerror: (message) => { saveError = message; }
    });
    const stopApplyPage = listenForApplyPage({
      target: window,
      captureIdentity: () => {
        const config = readRuntimeConfig();
        return JSON.stringify([config?.operatorId, config?.workspaceId]);
      },
      onpreview: (previewJson) => {
        if (languagePort || publicationBusy || languageRecoveryPort) {
          saveError = '当前受控操作尚未完成，暂不能应用页面通知。'; return;
        }
        if (coordinator.applyPreview(previewJson)) {
          previewOpen = false; saveError = ''; editError = ''; relocateSelection();
        }
      },
      onapply: async (pageId) => {
        if (languagePort || publicationBusy || languageRecoveryPort) {
          saveError = '当前受控操作尚未完成，暂不能应用页面通知。'; return;
        }
        saveError = '';
        await coordinator.load(pageId, { refreshCurrent: true });
        if (!coordinator.snapshot().error) { previewOpen = false; relocateSelection(); }
      },
      onerror: (message) => { saveError = message; }
    });
    return () => { disconnectAuthoring?.(); window.removeEventListener('online', online); window.removeEventListener('offline', offline); stopApplyPage(); stop(); language?.dispose(); languageRecovery?.dispose(); publication?.dispose(); unsubscribe(); coordinator.dispose(); };
  });

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
    if (!currentDocument || !pageModel || pageModel.transient || saveBlocked) return;
    saveError = '';
    await coordinator.save();
  }

  function relocateSelection() {
    if (selectedComponent && currentDraft) selectedComponent = locatorOfComponent(currentDraft.canvasDocument, selectedComponent.componentId);
  }

  function applyDocumentEdit(result: DocumentEditResult) {
    if (result.ok) {
      if (coordinator.replaceDraft(result.draft)) { relocateSelection(); editError = ''; }
    } else editError = result.message;
  }

  /** 画布创作意图分发:选中进检查器,重排与标题/宽度编辑走本地文档改写。 */
  function handleAuthoringIntent(intent: AuthoringIntent) {
    if (intent.type === 'select_component') {
      selectedComponent = intent.locator;
      return;
    }
    if ((savePending && !flushingInput) || !currentDraft) return;
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

<div bind:this={workbenchElement} class="workbench" data-testid="workbench">
  <div class="docbar" data-testid="workbench-contextbar" data-contract-critical>
    <div class="l">
      <strong class="canvas-title">页面画布</strong>
      {#if pageModel}
        <span class="badge" class:transient={pageModel.transient}>
          {pageModel.transient ? '临时页面态' : authoring.dirty ? '未保存工作副本' : '已保存页面修订'}
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
      {#if publicationPort.available}<button class="btn" disabled={!authoring.ref || authoring.languageLocked} onclick={() => publicationOpen = !publicationOpen}>发布评审</button>
      {:else}<button class="btn" disabled={!authoring.ref || authoring.dirty || saveBlocked || authoring.sync?.phase === 'saving'} onclick={async () => { if (!window.confirm('发布当前页面？后续保存编辑会将当前记录改为草稿。')) return; try { await coordinator.publish(); } catch (error) { saveError = String(error); } }}>发布页面</button>{/if}
      <button class="btn" disabled={!authoring.sync?.canUndo || loading || savePending} onclick={async () => { try { await coordinator.undo(); editError = ''; } catch (error) { editError = String(error); } }}>撤销上一步</button>
      {#if authoringPort.assets && authoring.ref}<a class="btn" href={`${resolve('/manage/pages/[pageId]', {pageId:authoring.ref.pageId})}?resource=${encodeURIComponent(authoring.ref.resourceId)}`}>页面历史</a>{:else}<button class="btn" disabled={!authoring.ref} onclick={() => historyOpen = !historyOpen}>页面历史</button>{/if}
      {#if baseRevisionId}
        <button class="btn" onclick={() => { previewRef = authoring.ref ? { ...authoring.ref } : null; previewOpen = !previewOpen; }}>当前修订预览</button>
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
        {#if authoring.sync}
          {#if stableSavePort.delivery !== 'single'}<label class="stat"><input type="checkbox" bind:checked={retainDimensionValues} disabled={savePending} onchange={(event) => coordinator.setRetainDimensionValues(event.currentTarget.checked)} />保存时保留维度取值</label>{/if}
          {#if authoring.sync.pending > 0 && stableSavePort.delivery !== 'single'}<button type="button" class="btn" disabled={authoring.sync.phase === 'saving'} onclick={() => coordinator.retrySync()}>核实并重试同步</button>{/if}
        {:else}
          <button type="button" class="btn" disabled={saveBlocked} onclick={saveRevision}>
            {savePending ? '保存中…' : baseRevisionId ? '保存新修订' : '保存首个修订'}
          </button>
        {/if}
      {/if}
    </div>
  </div>

  <aside class="chat" aria-label="分析会话" data-testid="workbench-track">
    <PanguDialogue adapter={dialogueAdapter} />

  </aside>

  <main class="canvas" aria-label="页面画布" data-testid="workbench-track">
    {#if historyOpen}{#key authoring.ref?.resourceId}<AuthoringHistory list={coordinator.listHistory} restore={coordinator.restoreRevision} />{/key}{/if}
    {#if recoveryState}
      <p class="notice" role="status" data-testid="language-recovery-status">{recoveryState.message || '正在检查未决操作…'}</p>
      {#if !recoveryState.summary}
        <button class="btn" disabled={recoveryState.busy} onclick={() => languageRecovery?.check(new URLSearchParams(window.location.search).get('page'))}>再次检查恢复</button>
      {:else}
        <button class="btn" disabled={recoveryState.busy || recoveryState.phase === 'opened'} onclick={() => languageRecovery?.recover()}>查询原操作</button>
        <button class="btn" disabled={recoveryState.busy || recoveryState.summary.cancelRequested || !recoveryState.locked} onclick={() => languageRecovery?.cancel()}>取消未完成操作</button>
        {#if recoveryState.summary.status === 'not-applied' && !recoveryState.summary.cancelRequested}<button class="btn" disabled={recoveryState.busy} onclick={() => languageRecovery?.retryOriginal()}>重试原操作</button>{/if}
        {#if recoveryState.summary.status === 'saved'}<button class="btn" disabled={recoveryState.busy || !recoveryState.locked} onclick={() => languageRecovery?.openSaved()}>打开已保存修订</button>{/if}
      {/if}
    {/if}
    {#if languageState}
      <p class="notice" role="status" data-testid="language-status">{languageState.message}</p>
      {#if languageState.operations.length}<ul aria-label="本轮操作结果">{#each languageState.operations as operation}<li>{operation.id}：{operation.status}</li>{/each}</ul>{/if}
      {#if ['synchronizing', 'running', 'reading', 'unknown'].includes(languageState.phase)}<button class="btn" onclick={() => language?.cancel()}>停止接收本轮结果</button>{/if}
      {#if ['unknown', 'cancelled', 'recovered'].includes(languageState.phase) && authoring.languageLocked}<button class="btn" onclick={() => language?.lookup()}>查询本轮保存结果</button>{/if}
      {#if languageState.recovery}<button class="btn" onclick={() => { previewRef = languageState!.recovery; previewOpen = true; }}>查看取消后已保存修订</button><a class="linkish" href={resolve('/manage')}>返回页面目录重新打开</a>{/if}
    {/if}
    {#if saveNotice}<p class="notice">{saveNotice}</p>{/if}
    {#if authoring.sync?.lastSaved?.revision?.isDraft === false}<p role="status">当前页面已发布。</p>{/if}
    {#if authoring.sync}
      {#if authoring.sync.protection === 'failed'}
        <p class="error" role="alert">浏览器保护失败，请勿关闭页面。{authoring.sync.message}</p>
      {:else if authoring.sync.pending > 0}
        <p class="notice" role="status">{authoring.sync.protection === 'protected' ? '已在浏览器保护' : '正在保护到浏览器'}，待同步 {authoring.sync.pending} 个操作。{authoring.sync.message}</p>
      {:else if authoring.sync.lastSaved}
        <p class="notice" role="status">服务端已保存修订 R{authoring.sync.lastSaved.revisionNumber}</p>
      {/if}
    {/if}
    {#if saveError || authoring.error}<p class="error" role="alert">{saveError || authoring.error}</p>{/if}
    {#if authoring.save?.status === 'unknown'}<p class="error" role="alert">保存结果未确定，已暂停再次保存。{authoring.save.message} 工作副本仅在本页内存中，尚无浏览器恢复保护。</p>{/if}
    {#if authoring.save?.status === 'rejected'}<p class="error" role="alert">{authoring.save.code}：{authoring.save.message}</p>{/if}
    {#if editError}<p class="error" role="alert">{editError}</p>{/if}

    <div class="page-scroll">
      {#if publicationOpen && publication}
        <PublicationReview {publication} />
      {:else if previewOpen && previewRef}
        <p class="notice">正在预览已保存修订；再次点击“当前内容预览”返回工作副本。</p>
        <RevisionPreview pageId={previewRef.pageId} revisionId={previewRef.revisionId}
          readRevision={(_pageId, _revisionId, signal) => coordinator.preview(previewRef!, signal)} />
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
      properties={propertyControls(currentDraft, selectedComponent)}
      onPropertyEdit={(edit) => { if (currentDraft && selectedComponent && !previewOpen && !loading) applyDocumentEdit(editProperty(currentDraft, selectedComponent, edit)); }}
      candidates={typeCandidates}
      fieldRows={selectedFieldRows}
      busy={savePending || previewOpen || loading}
      onSelectType={selectComponentType}
      onSelectComponent={selectComponentFromList}
      onEdit={(edit) => {
        if ((!savePending || flushingInput) && currentDraft && selectedComponent) {
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
      --analysis-rail-w: 480px;
      grid-template-columns: var(--analysis-rail-w) minmax(0, 1fr);
    }
    .inspector-track {
      display: none;
    }
  }
</style>
