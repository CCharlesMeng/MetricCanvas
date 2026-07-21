<script lang="ts">
  import { onMount } from 'svelte';
  import type {
    AgentEvent,
    AgentInteraction,
    AgentMessage
  } from '@metriccanvas/agent-runner';
  import type {
    CatalogSnapshot,
    DataSource,
    Page,
    StructuredQuery
  } from '@metriccanvas/page';
  import {
    authoringRenderMessage,
    parseAuthoringRuntimeMessage,
    type AuthoringComponentLocator,
    type AuthoringIntent
  } from '@metriccanvas/runtime';
  import {
    listEditableComponents,
    type EditableComponent
  } from './page-editor';
  import {
    createPageWorkspace,
    reducePageWorkspace,
    workspaceIsDirty,
    type PageWorkspace
  } from './page-workspace';

  interface Revision {
    pageId: string;
    revisionId: string;
    revisionNumber: number;
    document: Page;
  }

  interface AgentResponse {
    messages?: AgentMessage[];
    events?: AgentEvent[];
    interaction?: AgentInteraction;
    document?: Record<string, unknown>;
    runtimeOrigin?: string;
    error?: { code: string; message: string };
  }

  interface PublishRequest {
    requestId: string;
    pageId: string;
    revisionId: string;
    expiresAt: string;
    confirmationUrl: string;
  }

  const DEFAULT_INTENT =
    '创建销售经营概览：展示成交总额和订单量、区域对比、成交趋势、渠道占比和区域明细';

  let workspace = $state<PageWorkspace | null>(null);
  let catalog = $state<CatalogSnapshot | null>(null);
  let metadataVersion = $state('');
  let messages = $state<AgentMessage[]>([]);
  let latestEvents = $state<AgentEvent[]>([]);
  let interaction = $state<AgentInteraction | null>(null);
  let confirmedPageIds = $state<string[]>([]);
  let input = $state(DEFAULT_INTENT);
  let pageIdInput = $state('');
  let selectedDataSourceId = $state('');
  let inspectorTab = $state<'component' | 'source'>('component');
  let runId = $state('');
  let bridgeSession = $state('');
  let runtimeOrigin = $state('http://localhost:5173');
  let bridgeReady = $state(false);
  let canvasMode = $state<'authoring' | 'preview'>('authoring');
  let previewedRevisionId = $state<string | null>(null);
  let publishRequest = $state<PublishRequest | null>(null);
  let pending = $state(false);
  let saving = $state(false);
  let publishing = $state(false);
  let error = $state('');
  let notice = $state('');
  let iframe = $state<HTMLIFrameElement>();

  const components = $derived(
    workspace ? listEditableComponents(workspace.current) : []
  );
  const selected = $derived(
    workspace?.selected
      ? components.find(
          (component) =>
            component.locator.sectionId === workspace?.selected?.sectionId &&
            component.locator.componentId === workspace?.selected?.componentId
        ) ?? null
      : null
  );
  const querySources = $derived(
    workspace
      ? Object.entries(workspace.current.dataSources).flatMap(([id, source]) =>
          source.source.type === 'query' ? [{ id, source }] : []
        )
      : []
  );
  const selectedSource = $derived(
    querySources.find((candidate) => candidate.id === selectedDataSourceId) ??
      querySources[0] ??
      null
  );
  const dirty = $derived(workspace ? workspaceIsDirty(workspace) : false);
  const pageIdConfirmed = $derived(
    Boolean(
      workspace &&
        (workspace.baseRevisionId !== null || confirmedPageIds.includes(workspace.current.id))
    )
  );
  const precisePreviewUrl = $derived(
    workspace?.baseRevisionId
      ? `${runtimeOrigin.replace(/\/+$/u, '')}/pages/${encodeURIComponent(workspace.current.id)}?revision=${encodeURIComponent(workspace.baseRevisionId)}`
      : ''
  );
  const authoringUrl = $derived(
    bridgeSession
      ? `${runtimeOrigin.replace(/\/+$/u, '')}/authoring?session=${encodeURIComponent(bridgeSession)}`
      : ''
  );
  const visibleMessages = $derived(
    messages.flatMap((message) =>
      (message.role === 'user' || message.role === 'assistant') && message.content.trim()
        ? [{ role: message.role, content: message.content }]
        : []
    )
  );
  const validationStatus = $derived.by(() => {
    const validation = [...latestEvents]
      .reverse()
      .find(
        (event) =>
          event.type === 'tool_finished' && event.call.name === 'validate_page'
      );
    if (!validation || validation.type !== 'tool_finished') return null;
    const result = validation.result.structuredContent;
    return isRecord(result) && typeof result.valid === 'boolean'
      ? { valid: result.valid, errors: Array.isArray(result.errors) ? result.errors.length : 0 }
      : null;
  });

  onMount(() => {
    runId = crypto.randomUUID();
    bridgeSession = crypto.randomUUID();
    void loadCatalog();
    const receive = (event: MessageEvent) => {
      if (!iframe?.contentWindow || event.source !== iframe.contentWindow) return;
      if (event.origin !== safeOrigin(runtimeOrigin)) return;
      const message = parseAuthoringRuntimeMessage(event.data, bridgeSession);
      if (!message) return;
      if (message.type === 'ready') {
        bridgeReady = true;
        sendDocumentToRuntime();
      } else {
        applyAuthoringIntent(message.intent);
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  });

  $effect(() => {
    const document = workspace?.current;
    const selection = workspace?.selected;
    const ready = bridgeReady;
    const mode = canvasMode;
    if (document && ready && mode === 'authoring') {
      queueMicrotask(() => sendDocumentToRuntime());
    }
  });

  async function loadCatalog() {
    try {
      const response = await fetch('/api/catalog', { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as {
        version: string;
        snapshot: CatalogSnapshot;
      };
      metadataVersion = payload.version;
      catalog = payload.snapshot;
    } catch (cause) {
      error = `元数据目录加载失败：${cause instanceof Error ? cause.message : String(cause)}`;
    }
  }

  async function submit() {
    const text = input.trim();
    if (!text || pending) return;
    const outgoing: AgentMessage[] = [...messages, { role: 'user', content: text }];
    input = '';
    await executeAgent(outgoing);
  }

  async function executeAgent(outgoing: AgentMessage[]) {
    pending = true;
    error = '';
    notice = '';
    latestEvents = [];
    messages = outgoing;
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          runId,
          messages: outgoing,
          confirmations: confirmedPageIds.map((pageId) => ({ kind: 'page_id', pageId })),
          ...(workspace ? { draft: workspace.current } : {}),
          ...(workspace?.selected ? { target: workspace.selected } : {})
        })
      });
      const payload = (await response.json()) as AgentResponse;
      if (!response.ok || !payload.messages || !payload.events) {
        throw new Error(
          payload.error
            ? `${payload.error.code}: ${payload.error.message}`
            : `HTTP ${response.status}`
        );
      }
      messages = payload.messages;
      latestEvents = payload.events;
      interaction = payload.interaction ?? null;
      if (payload.runtimeOrigin) runtimeOrigin = payload.runtimeOrigin;
      if (payload.document) applyAgentDocument(payload.document);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      pending = false;
    }
  }

  function applyAgentDocument(document: Record<string, unknown>) {
    const page = document as unknown as Page;
    if (workspace) {
      workspace = reducePageWorkspace(workspace, {
        type: 'apply_agent_document',
        document: page
      });
    } else {
      workspace = createPageWorkspace({
        document: page,
        baseRevisionId: null,
        revisionNumber: null
      });
      const first = listEditableComponents(page)[0];
      if (first) {
        workspace = reducePageWorkspace(workspace, {
          type: 'select_component',
          locator: first.locator
        });
        syncSelectedSource(first);
      }
    }
    canvasMode = 'authoring';
    previewedRevisionId = null;
    publishRequest = null;
  }

  function confirmPageId() {
    if (!workspace || interaction?.kind !== 'confirm_page_id') return;
    confirmedPageIds = Array.from(new Set([...confirmedPageIds, workspace.current.id]));
    interaction = null;
    notice = `看板页面 id ${workspace.current.id} 已确认；点击保存才会形成 R1。`;
  }

  async function openExistingPage() {
    const pageId = pageIdInput.trim();
    if (!pageId || pending) return;
    pending = true;
    error = '';
    notice = '';
    try {
      const response = await fetch(`/api/pages/${encodeURIComponent(pageId)}`);
      const payload = (await response.json()) as {
        revision?: Revision;
        runtimeOrigin?: string;
        error?: { code?: string; message?: string };
      };
      if (!response.ok || !payload.revision) {
        throw new Error(
          `${payload.error?.code ?? 'LOAD_FAILED'}: ${payload.error?.message ?? `HTTP ${response.status}`}`
        );
      }
      workspace = createPageWorkspace({
        document: payload.revision.document,
        baseRevisionId: payload.revision.revisionId,
        revisionNumber: payload.revision.revisionNumber
      });
      const first = listEditableComponents(payload.revision.document)[0];
      if (first) {
        workspace = reducePageWorkspace(workspace, {
          type: 'select_component',
          locator: first.locator
        });
        syncSelectedSource(first);
      }
      runtimeOrigin = payload.runtimeOrigin ?? runtimeOrigin;
      confirmedPageIds = Array.from(new Set([...confirmedPageIds, pageId]));
      interaction = null;
      messages = [
        {
          role: 'assistant',
          content: `已打开 ${pageId} 的当前最新页面修订 R${payload.revision.revisionNumber}。人工编辑和 Agent 调整会共用当前未保存工作副本。`,
          toolCalls: []
        }
      ];
      latestEvents = [];
      canvasMode = 'authoring';
      previewedRevisionId = null;
      publishRequest = null;
      bridgeReady = false;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      pending = false;
    }
  }

  function dispatch(command: Parameters<typeof reducePageWorkspace>[1]) {
    if (!workspace) return;
    workspace = reducePageWorkspace(workspace, command);
    canvasMode = 'authoring';
    previewedRevisionId = null;
    publishRequest = null;
    notice = '';
  }

  function applyAuthoringIntent(intent: AuthoringIntent) {
    if (!workspace) return;
    if (intent.type === 'select_component') {
      dispatch({ type: 'select_component', locator: intent.locator });
      const editable = components.find((component) => sameLocator(component.locator, intent.locator));
      if (editable) syncSelectedSource(editable);
    } else if (intent.type === 'move_component') {
      dispatch({ type: 'move_component', locator: intent.locator, before: intent.before });
    } else {
      dispatch({ type: 'edit_component', locator: intent.locator, edit: intent.edit });
    }
  }

  function syncSelectedSource(component: EditableComponent) {
    if (!workspace) return;
    const sourceId = workspace.current.sections
      .find((section) => section.id === component.locator.sectionId)
      ?.components.find((candidate) => candidate.id === component.locator.componentId)
      ?.data?.main;
    if (sourceId && workspace.current.dataSources[sourceId]?.source.type === 'query') {
      selectedDataSourceId = sourceId;
    }
  }

  function selectFromInspector(component: EditableComponent) {
    dispatch({ type: 'select_component', locator: component.locator });
    syncSelectedSource(component);
  }

  function sendDocumentToRuntime() {
    if (
      !workspace ||
      !bridgeReady ||
      canvasMode !== 'authoring' ||
      !iframe?.contentWindow
    ) {
      return;
    }
    iframe.contentWindow.postMessage(
      authoringRenderMessage(
        bridgeSession,
        $state.snapshot(workspace.current),
        workspace.selected
          ? ($state.snapshot(workspace.selected) as AuthoringComponentLocator)
          : null
      ),
      safeOrigin(runtimeOrigin)
    );
  }

  function authoringFrameLoaded() {
    if (!workspace || canvasMode !== 'authoring') return;
    bridgeReady = true;
    queueMicrotask(() => sendDocumentToRuntime());
  }

  async function saveRevision() {
    if (!workspace || saving || !pageIdConfirmed) return;
    if (workspace.baseRevisionId !== null && !dirty) return;
    saving = true;
    error = '';
    notice = '';
    try {
      const response = await fetch(
        `/api/pages/${encodeURIComponent(workspace.current.id)}/revisions`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            baseRevisionId: workspace.baseRevisionId,
            document: workspace.current,
            idempotencyKey: crypto.randomUUID()
          })
        }
      );
      const payload = (await response.json()) as {
        revision?: Revision;
        runtimeOrigin?: string;
        error?: { code?: string; message?: string; validationErrors?: unknown[] };
      };
      if (!response.ok || !payload.revision) {
        const details = payload.error?.validationErrors?.length
          ? `（${payload.error.validationErrors.length} 个校验问题）`
          : '';
        throw new Error(
          `${payload.error?.code ?? 'SAVE_FAILED'}: ${payload.error?.message ?? `HTTP ${response.status}`}${details}`
        );
      }
      runtimeOrigin = payload.runtimeOrigin ?? runtimeOrigin;
      workspace = reducePageWorkspace(workspace, {
        type: 'mark_saved',
        revisionId: payload.revision.revisionId,
        revisionNumber: payload.revision.revisionNumber,
        document: payload.revision.document
      });
      previewedRevisionId = null;
      publishRequest = null;
      notice = `页面校验通过，已保存不可变页面修订 R${payload.revision.revisionNumber}。`;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      saving = false;
    }
  }

  function showPrecisePreview() {
    if (!workspace?.baseRevisionId || dirty) return;
    previewedRevisionId = workspace.baseRevisionId;
    canvasMode = 'preview';
    notice = `右侧已切换到 R${workspace.revisionNumber} 的统一运行时精确预览。`;
  }

  async function requestPublish() {
    if (
      !workspace?.baseRevisionId ||
      dirty ||
      previewedRevisionId !== workspace.baseRevisionId ||
      publishing
    ) {
      return;
    }
    publishing = true;
    error = '';
    try {
      const response = await fetch(
        `/api/pages/${encodeURIComponent(workspace.current.id)}/publish`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            revisionId: workspace.baseRevisionId,
            idempotencyKey: crypto.randomUUID()
          })
        }
      );
      const payload = (await response.json()) as {
        request?: PublishRequest;
        error?: { code?: string; message?: string };
      };
      if (!response.ok || !payload.request) {
        throw new Error(
          `${payload.error?.code ?? 'PUBLISH_FAILED'}: ${payload.error?.message ?? `HTTP ${response.status}`}`
        );
      }
      publishRequest = payload.request;
      notice = '发布租约已取得；仍需打开确认页并明确批准。';
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      publishing = false;
    }
  }

  function undo() {
    dispatch({ type: 'undo' });
  }

  function redo() {
    dispatch({ type: 'redo' });
  }

  function showInspector(tab: 'component' | 'source') {
    inspectorTab = tab;
  }

  function editSelected(edit: { title?: string; detail?: string; span?: number }) {
    if (!selected) return;
    dispatch({ type: 'edit_component', locator: selected.locator, edit });
  }

  function applyQuery(query: StructuredQuery) {
    if (!workspace || !selectedSource || !catalog) return;
    dispatch({
      type: 'edit_query_data_source',
      dataSourceId: selectedSource.id,
      query: normalizeQuery(query),
      catalog
    });
  }

  function toggleMetric(code: string, checked: boolean) {
    const query = selectedQuery();
    if (!query) return;
    const metrics = checked
      ? Array.from(new Set([...query.metrics, code]))
      : query.metrics.filter((metric) => metric !== code);
    if (metrics.length === 0) return;
    applyQuery({ ...query, metrics });
  }

  function toggleDimension(code: string, checked: boolean) {
    const query = selectedQuery();
    if (!query) return;
    const current = query.dimensions ?? [];
    const dimensions = checked
      ? Array.from(new Set([...current, code]))
      : current.filter((dimension) => dimension !== code);
    applyQuery({ ...query, ...(dimensions.length ? { dimensions } : { dimensions: undefined }) });
  }

  function selectedQuery(): StructuredQuery | null {
    return selectedSource?.source.source.type === 'query'
      ? structuredClone(selectedSource.source.source.query)
      : null;
  }

  function normalizeQuery(query: StructuredQuery): StructuredQuery {
    if (!catalog) return query;
    const metricDefinitions = query.metrics.flatMap((code) => {
      const metric = catalog?.metrics.find((candidate) => candidate.code === code);
      return metric ? [metric] : [];
    });
    const aggregationOptions = metricDefinitions.reduce<string[] | null>(
      (shared, metric) =>
        shared === null
          ? [...metric.availableAggregations]
          : shared.filter((value) => metric.availableAggregations.includes(value)),
      null
    ) ?? [];
    const aggregation =
      query.aggregation && aggregationOptions.includes(query.aggregation)
        ? query.aggregation
        : aggregationOptions[0];
    const fields = [...(query.dimensions ?? []), ...query.metrics];
    const orderBy = (query.orderBy ?? []).filter((rule) => fields.includes(rule.field));
    return {
      ...query,
      ...(aggregation ? { aggregation } : { aggregation: undefined }),
      ...(orderBy.length
        ? { orderBy }
        : { orderBy: [{ field: query.metrics[0]!, direction: 'desc' }] })
    };
  }

  function metricCompatible(code: string): boolean {
    const metric = catalog?.metrics.find((candidate) => candidate.code === code);
    const query = selectedQuery();
    return Boolean(
      metric &&
        (query?.dimensions ?? []).every((dimension) =>
          metric.availableDimensions.includes(dimension)
        )
    );
  }

  function dimensionCompatible(code: string): boolean {
    const query = selectedQuery();
    return Boolean(
      query &&
        query.metrics.every((metricCode) =>
          catalog?.metrics
            .find((metric) => metric.code === metricCode)
            ?.availableDimensions.includes(code)
        )
    );
  }

  function aggregationOptions(): string[] {
    const query = selectedQuery();
    if (!query || !catalog) return [];
    return query.metrics.reduce<string[] | null>((shared, code) => {
      const values =
        catalog?.metrics.find((metric) => metric.code === code)?.availableAggregations ?? [];
      return shared === null ? [...values] : shared.filter((value) => values.includes(value));
    }, null) ?? [];
  }

  function sameLocator(
    left: { sectionId: string; componentId: string },
    right: { sectionId: string; componentId: string }
  ) {
    return left.sectionId === right.sectionId && left.componentId === right.componentId;
  }

  function safeOrigin(value: string): string {
    try {
      return new URL(value).origin;
    } catch {
      return 'http://localhost:5173';
    }
  }

  function valueOf(event: Event): string {
    return (event.currentTarget as HTMLInputElement | HTMLSelectElement).value;
  }

  function checkedOf(event: Event): boolean {
    return (event.currentTarget as HTMLInputElement).checked;
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
</script>

<svelte:head><title>单页页面搭建工作台 · MetricCanvas</title></svelte:head>

<div class="authoring-workbench">
  <aside class="control-column">
    <header class="workbench-header">
      <div>
        <span class="eyebrow">页面搭建工作台</span>
        <h1>{workspace?.current.id ?? '创建看板页面'}</h1>
        <p>
          {workspace?.revisionNumber ? `基于 R${workspace.revisionNumber}` : '尚未保存'}
          · {workspace?.baseRevisionId === null ? '待保存为 R1' : dirty ? '有未保存修改' : '工作副本与基线一致'}
        </p>
      </div>
      <div class="history-actions">
        <button type="button" aria-label="撤销" onclick={undo} disabled={!workspace?.past.length}>↶</button>
        <button type="button" aria-label="重做" onclick={redo} disabled={!workspace?.future.length}>↷</button>
      </div>
      <div class="save-row">
        <button
          type="button"
          class="save"
          onclick={() => void saveRevision()}
          disabled={!workspace || saving || !pageIdConfirmed || (workspace.baseRevisionId !== null && !dirty)}
        >{saving ? '正在校验并保存…' : workspace?.baseRevisionId ? '保存新页面修订' : '保存 R1'}</button>
      </div>
    </header>

    <section class="existing-page">
      <input bind:value={pageIdInput} placeholder="打开已有看板页面 id" onkeydown={(event) => { if (event.key === 'Enter') void openExistingPage(); }} />
      <button type="button" onclick={() => void openExistingPage()} disabled={pending || !pageIdInput.trim()}>打开</button>
    </section>

    <section class="conversation-panel">
      <div class="panel-heading">
        <div><span class="eyebrow">AI COPILOT</span><h2>继续描述你的调整</h2></div>
        <span class="provider"><i></i>{pending ? '执行中' : 'scripted fake / DeepSeek'}</span>
      </div>
      <div class="messages" aria-live="polite">
        {#if visibleMessages.length === 0}
          <div class="assistant-message">
            描述这张看板页面要回答的问题。Agent 会先检索数据服务目录并生成未保存工作副本。
          </div>
        {/if}
        {#each visibleMessages as message}
          <div class:assistant-message={message.role === 'assistant'} class:user-message={message.role === 'user'}>
            <small>{message.role === 'assistant' ? 'Agent' : '你'}</small>
            <p>{message.content}</p>
          </div>
        {/each}
        {#if interaction?.kind === 'confirm_page_id' && workspace}
          <div class="identity-gate">
            <strong>确认看板页面 id</strong>
            <code>{workspace.current.id}</code>
            <p>保存 R1 后不可更名。确认不会保存，仍需点击上方“保存 R1”。</p>
            <button type="button" onclick={confirmPageId}>确认页面 id</button>
          </div>
        {/if}
      </div>
      {#if latestEvents.length > 0}
        <div class="tool-strip">
          {#each latestEvents.filter((event) => event.type === 'tool_finished') as event}
            {#if event.type === 'tool_finished'}
              <span class:error-tool={event.result.isError === true}>{event.result.isError === true ? '!' : '✓'} {event.call.name}</span>
            {/if}
          {/each}
          {#if validationStatus}<strong class:invalid={!validationStatus.valid}>{validationStatus.valid ? '校验通过' : `${validationStatus.errors} 个问题`}</strong>{/if}
        </div>
      {/if}
      <div class="target-context">
        <span>正在调整</span>
        <strong>{selected ? `${selected.typeLabel} / ${selected.locator.componentId}` : '整张看板页面'}</strong>
        <small>结构化定位随请求发送；不会自动执行或保存。</small>
      </div>
      <div class="composer">
        <textarea bind:value={input} rows="3" placeholder="描述如何调整当前组件或整张页面…"></textarea>
        <button type="button" onclick={() => void submit()} disabled={pending || !input.trim()}>{pending ? '执行中…' : '应用调整 ↑'}</button>
      </div>
    </section>

    <section class="inspector-panel">
      <div class="tabs">
        <button class:active={inspectorTab === 'component'} type="button" onclick={() => showInspector('component')}>组件</button>
        <button class:active={inspectorTab === 'source'} type="button" onclick={() => showInspector('source')}>页面数据源</button>
      </div>

      {#if inspectorTab === 'component'}
        <div class="component-list" aria-label="组件列表">
          {#each components as component (component.locator.sectionId + component.locator.componentId)}
            <button class:selected={selected && sameLocator(selected.locator, component.locator)} type="button" onclick={() => selectFromInspector(component)}>
              <span>{component.typeLabel}</span><strong>{component.title || component.locator.componentId}</strong><small>{component.span}/12</small>
            </button>
          {/each}
        </div>
        {#if selected}
          <div class="property-form">
            <label>标题<input value={selected.title} onchange={(event) => editSelected({ title: valueOf(event) })} /></label>
            {#if selected.detailLabel}<label>{selected.detailLabel}<input value={selected.detail} onchange={(event) => editSelected({ detail: valueOf(event) })} /></label>{/if}
            <label>网格跨度 <span>{selected.span}/12</span><input type="range" min="1" max="12" value={selected.span} oninput={(event) => editSelected({ span: Number(valueOf(event)) })} /></label>
            <p>也可以直接点击右侧画布组件，在画布内改标题、调整跨度或拖动排序。</p>
          </div>
        {/if}
      {:else}
        <div class="source-select">
          <label>页面数据源<select bind:value={selectedDataSourceId}>{#each querySources as candidate}<option value={candidate.id}>{candidate.id}</option>{/each}</select></label>
        </div>
        {#if selectedSource && selectedQuery() && catalog}
          {@const query = selectedQuery()!}
          <div class="query-editor">
            <fieldset><legend>指标</legend>{#each catalog.metrics as metric}<label class:disabled={!metricCompatible(metric.code)}><input type="checkbox" checked={query.metrics.includes(metric.code)} disabled={!query.metrics.includes(metric.code) && !metricCompatible(metric.code)} onchange={(event) => toggleMetric(metric.code, checkedOf(event))} /><span><strong>{metric.name}</strong><code>{metric.code}</code></span></label>{/each}</fieldset>
            <fieldset><legend>维度</legend>{#each catalog.dimensions as dimension}<label class:disabled={!dimensionCompatible(dimension.code)}><input type="checkbox" checked={(query.dimensions ?? []).includes(dimension.code)} disabled={!(query.dimensions ?? []).includes(dimension.code) && !dimensionCompatible(dimension.code)} onchange={(event) => toggleDimension(dimension.code, checkedOf(event))} /><span><strong>{dimension.name}</strong><code>{dimension.code}</code></span></label>{/each}</fieldset>
            <div class="query-grid">
              <label>聚合<select value={query.aggregation ?? ''} onchange={(event) => applyQuery({ ...query, aggregation: valueOf(event) })}>{#each aggregationOptions() as aggregation}<option value={aggregation}>{aggregation}</option>{/each}</select></label>
              <label>排序字段<select value={query.orderBy?.[0]?.field ?? query.metrics[0]} onchange={(event) => applyQuery({ ...query, orderBy: [{ field: valueOf(event), direction: query.orderBy?.[0]?.direction ?? 'desc' }] })}>{#each [...(query.dimensions ?? []), ...query.metrics] as field}<option value={field}>{field}</option>{/each}</select></label>
              <label>方向<select value={query.orderBy?.[0]?.direction ?? 'desc'} onchange={(event) => applyQuery({ ...query, orderBy: [{ field: query.orderBy?.[0]?.field ?? query.metrics[0]!, direction: valueOf(event) as 'asc' | 'desc' }] })}><option value="desc">desc</option><option value="asc">asc</option></select></label>
              <label>limit<input type="number" min="1" max="1000" value={query.limit ?? 100} onchange={(event) => applyQuery({ ...query, limit: Number(valueOf(event)) })} /></label>
            </div>
            <p class="catalog-proof">元数据版本 <code>{metadataVersion.slice(0, 12)}…</code> · 修改会同步字段契约与组件数据绑定。</p>
          </div>
        {:else}<p class="empty">当前没有可编辑的 query 页面数据源。</p>{/if}
      {/if}
    </section>

    <footer class="lifecycle-panel">
      <div><span>页面修订</span><strong>{workspace?.revisionNumber ? `R${workspace.revisionNumber}` : '未保存'}</strong></div>
      <button type="button" onclick={showPrecisePreview} disabled={!workspace?.baseRevisionId || dirty}>精确预览</button>
      <button type="button" onclick={() => void requestPublish()} disabled={!workspace?.baseRevisionId || dirty || previewedRevisionId !== workspace.baseRevisionId || publishing}>{publishing ? '申请中…' : '申请发布'}</button>
      {#if publishRequest}<a href={publishRequest.confirmationUrl} target="_blank" rel="noreferrer">核对并确认发布 ↗</a>{/if}
    </footer>
  </aside>

  <main class="canvas-column">
    <header class="canvas-toolbar">
      <div><i class:dirty></i><strong>统一运行时</strong><span>{canvasMode === 'authoring' ? '未保存工作副本' : `精确预览 · R${workspace?.revisionNumber}`}</span></div>
      <div class="mode-switch"><button class:active={canvasMode === 'authoring'} type="button" onclick={() => (canvasMode = 'authoring')} disabled={!workspace}>编辑画布</button><button class:active={canvasMode === 'preview'} type="button" onclick={showPrecisePreview} disabled={!workspace?.baseRevisionId || dirty}>精确预览</button></div>
    </header>
    {#if error}<div class="error" role="alert">{error}</div>{/if}
    {#if notice}<div class="notice" role="status">{notice}</div>{/if}
    {#if !workspace}
      <div class="canvas-empty"><span>✦</span><h2>从左侧业务诉求开始</h2><p>生成后无需离开页面，即可点击、拖动、直接编辑并继续让 Agent 调整。</p></div>
    {:else if canvasMode === 'authoring' && authoringUrl}
      <iframe bind:this={iframe} title="统一运行时编辑画布" src={authoringUrl} onload={authoringFrameLoaded}></iframe>
    {:else if canvasMode === 'preview' && precisePreviewUrl}
      <iframe bind:this={iframe} title={`R${workspace.revisionNumber} 统一运行时精确预览`} src={precisePreviewUrl}></iframe>
    {/if}
  </main>
</div>

<style>
  .authoring-workbench { display: grid; height: calc(100vh - 54px); grid-template-columns: minmax(390px, 38%) minmax(620px, 62%); overflow: hidden; background: #eef1f6; }
  .control-column { display: flex; min-width: 0; min-height: 0; flex-direction: column; background: #fff; border-right: 1px solid #dde2ea; }
  .workbench-header { display: grid; grid-template-columns: 1fr auto; gap: 8px 12px; padding: 14px 18px 12px; border-bottom: 1px solid #e3e7ed; }
  h1, h2, p { margin: 0; } h1 { font-size: 17px; } h2 { font-size: 15px; }
  .eyebrow { display: block; margin-bottom: 4px; color: #6558d9; font-size: 9px; font-weight: 900; letter-spacing: .1em; }
  .workbench-header p { margin-top: 3px; color: #7a8497; font-size: 10px; }
  .history-actions { display: flex; gap: 5px; }
  button { cursor: pointer; font: inherit; } button:disabled { cursor: not-allowed; opacity: .42; }
  .history-actions button, .existing-page button { width: 34px; height: 32px; color: #4b5568; background: #fff; border: 1px solid #d6dce6; border-radius: 6px; }
  .save-row { grid-column: 1 / -1; }
  .save { width: 100%; padding: 9px; color: #fff; background: #4f46e5; border: 0; border-radius: 7px; font-size: 11px; font-weight: 800; }
  .existing-page { display: grid; grid-template-columns: 1fr auto; gap: 6px; padding: 9px 18px; border-bottom: 1px solid #edf0f4; }
  .existing-page input, .property-form input, .source-select select, .query-grid input, .query-grid select { width: 100%; min-height: 32px; padding: 6px 8px; color: #273146; background: #fff; border: 1px solid #d5dbe5; border-radius: 6px; font: inherit; font-size: 10px; }
  .existing-page button { width: auto; padding-inline: 12px; }
  .conversation-panel { display: flex; min-height: 270px; flex: 1 1 48%; flex-direction: column; padding: 14px 18px; overflow: hidden; }
  .panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 9px; }
  .provider { display: flex; align-items: center; gap: 5px; color: #7a8497; font-size: 8px; }.provider i { width: 6px; height: 6px; background: #22c55e; border-radius: 50%; }
  .messages { display: flex; min-height: 80px; flex: 1; flex-direction: column; gap: 8px; overflow: auto; }
  .assistant-message, .user-message { max-width: 90%; padding: 9px 10px; color: #3f4a5f; background: #f0f2f7; border-radius: 10px 10px 10px 3px; font-size: 10px; line-height: 1.5; }
  .user-message { align-self: flex-end; color: #fff; background: #554dcc; border-radius: 10px 10px 3px 10px; }.assistant-message small, .user-message small { display: block; margin-bottom: 2px; opacity: .65; font-size: 7px; font-weight: 900; text-transform: uppercase; }
  .identity-gate { display: grid; gap: 6px; padding: 10px; color: #594f31; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; font-size: 9px; }.identity-gate code { font-size: 12px; font-weight: 800; }.identity-gate button { justify-self: start; padding: 6px 9px; color: #fff; background: #a16207; border: 0; border-radius: 5px; }
  .tool-strip { display: flex; flex-wrap: wrap; gap: 4px; padding-top: 7px; }.tool-strip span, .tool-strip strong { padding: 3px 6px; color: #216e4e; background: #ecfdf3; border-radius: 999px; font-size: 8px; }.tool-strip .error-tool, .tool-strip .invalid { color: #991b1b; background: #fef2f2; }
  .target-context { display: grid; gap: 2px; padding: 8px 10px; margin-top: 8px; color: #4b43aa; background: #f0efff; border: 1px solid #ddd9ff; border-radius: 7px; }.target-context span, .target-context small { color: #787496; font-size: 8px; }.target-context strong { font-size: 10px; }
  .composer { position: relative; margin-top: 7px; }.composer textarea { width: 100%; resize: none; padding: 9px 96px 9px 9px; color: #273146; background: #fbfcfe; border: 1px solid #ccd3df; border-radius: 8px; outline: 0; font: inherit; font-size: 10px; line-height: 1.45; }.composer textarea:focus { background: #fff; border-color: #6c63dc; box-shadow: 0 0 0 3px rgb(99 102 241 / .12); }.composer button { position: absolute; right: 7px; bottom: 7px; padding: 6px 9px; color: #fff; background: #4f46e5; border: 0; border-radius: 5px; font-size: 9px; font-weight: 800; }
  .inspector-panel { flex: 1 1 42%; min-height: 250px; padding: 10px 18px 14px; overflow: auto; border-top: 1px solid #e3e7ed; }
  .tabs { display: grid; grid-template-columns: 1fr 1.3fr; padding: 3px; margin-bottom: 9px; background: #eff1f5; border-radius: 7px; }.tabs button { padding: 7px; color: #727c8e; background: transparent; border: 0; border-radius: 5px; font-size: 9px; font-weight: 800; }.tabs button.active { color: #31394a; background: #fff; box-shadow: 0 1px 3px rgb(15 23 42 / .1); }
  .component-list { display: flex; gap: 5px; padding-bottom: 8px; overflow-x: auto; }.component-list button { display: grid; min-width: 108px; gap: 2px; padding: 7px 8px; color: #596377; text-align: left; background: #fff; border: 1px solid #dce1e9; border-radius: 6px; }.component-list button.selected { color: #4338ca; background: #f2f1ff; border-color: #7770e5; }.component-list span, .component-list small { font-size: 7px; }.component-list strong { overflow: hidden; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
  .property-form { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }.property-form label, .source-select label, .query-grid label { display: grid; gap: 4px; color: #5f687b; font-size: 9px; font-weight: 800; }.property-form label:last-of-type { grid-column: 1 / -1; }.property-form label span { float: right; color: #4f46e5; }.property-form input[type='range'] { padding: 0; accent-color: #4f46e5; }.property-form p { grid-column: 1 / -1; color: #8a93a4; font-size: 8px; }
  .query-editor { display: grid; gap: 8px; }.query-editor fieldset { display: flex; gap: 5px; padding: 7px; overflow-x: auto; border: 1px solid #e0e4eb; border-radius: 6px; }.query-editor legend { padding: 0 4px; color: #697386; font-size: 8px; font-weight: 900; }.query-editor fieldset label { display: flex; min-width: 102px; align-items: center; gap: 5px; padding: 5px; background: #f8f9fb; border-radius: 5px; font-size: 8px; }.query-editor fieldset label.disabled { opacity: .45; }.query-editor fieldset span { display: grid; }.query-editor fieldset code { color: #8a93a5; font-size: 7px; }.query-editor input[type='checkbox'] { accent-color: #4f46e5; }
  .query-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }.catalog-proof, .empty { color: #7c8698; font-size: 8px; }.catalog-proof code { color: #4f46e5; }
  .lifecycle-panel { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 6px; padding: 9px 18px 12px; border-top: 1px solid #dfe4ec; }.lifecycle-panel div { display: grid; }.lifecycle-panel span { color: #8a93a4; font-size: 7px; }.lifecycle-panel strong { font-size: 10px; }.lifecycle-panel button, .lifecycle-panel a { padding: 7px 9px; color: #4f46e5; background: #fff; border: 1px solid #cfcbed; border-radius: 6px; font-size: 8px; font-weight: 800; text-decoration: none; }.lifecycle-panel a { grid-column: 1 / -1; color: #fff; text-align: center; background: #4f46e5; }
  .canvas-column { display: flex; min-width: 0; min-height: 0; flex-direction: column; padding: 0; overflow: hidden; }
  .canvas-toolbar { display: flex; min-height: 44px; align-items: center; justify-content: space-between; padding: 0 14px; background: #fafbfc; border-bottom: 1px solid #dce1e8; }.canvas-toolbar > div { display: flex; align-items: center; gap: 7px; color: #727c8d; font-size: 9px; }.canvas-toolbar i { width: 7px; height: 7px; background: #22c55e; border-radius: 50%; }.canvas-toolbar i.dirty { background: #f59e0b; }.canvas-toolbar strong { color: #424b5e; }.mode-switch { padding: 3px; background: #eef0f4; border-radius: 6px; }.mode-switch button { padding: 5px 8px; color: #7a8496; background: transparent; border: 0; border-radius: 4px; font-size: 8px; }.mode-switch button.active { color: #3730a3; background: #fff; box-shadow: 0 1px 3px rgb(15 23 42 / .1); }
  iframe { width: 100%; min-height: 0; flex: 1; border: 0; background: #fafafa; }
  .canvas-empty { display: grid; min-height: 0; flex: 1; place-content: center; justify-items: center; gap: 7px; color: #7a8496; text-align: center; }.canvas-empty span { display: grid; width: 46px; height: 46px; place-items: center; color: #fff; background: #4f46e5; border-radius: 14px; font-size: 20px; box-shadow: 0 12px 30px rgb(79 70 229 / .24); }.canvas-empty h2 { color: #3f485a; }.canvas-empty p { max-width: 360px; font-size: 10px; }
  .error, .notice { position: absolute; top: 105px; right: 18px; z-index: 20; max-width: 420px; padding: 9px 12px; color: #991b1b; background: #fef2f2; border: 1px solid #fecaca; border-radius: 7px; box-shadow: 0 8px 24px rgb(15 23 42 / .12); font-size: 9px; }.notice { top: 105px; color: #166534; background: #f0fdf4; border-color: #bbf7d0; }
  @media (max-width: 980px) { .authoring-workbench { height: auto; min-height: calc(100vh - 54px); grid-template-columns: 1fr; overflow: visible; }.control-column { min-height: 760px; }.canvas-column { min-height: 760px; }.query-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
