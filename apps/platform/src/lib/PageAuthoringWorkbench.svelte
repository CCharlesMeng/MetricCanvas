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
    type BoundComponentInsertion,
    type DimensionedVisualizationKind,
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

  type InspectorMode = 'component' | 'dataSource' | 'add';
  type MobilePane = 'copilot' | 'canvas' | 'inspector';
  type AddComponentKind = BoundComponentInsertion['kind'];

  const DEFAULT_INTENT =
    '创建销售经营概览：展示成交总额和订单量、区域对比、成交趋势、渠道占比和区域明细';
  const ADD_COMPONENT_KINDS = [
    'metric_card',
    'bar_chart',
    'line_chart',
    'pie_chart',
    'ranking_card',
    'table'
  ] as const satisfies readonly AddComponentKind[];

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
  let addComponentKind = $state<AddComponentKind>('metric_card');
  let addMetricCode = $state('');
  let addDimensionCode = $state('');
  let addDataSourceChoice = $state('new');
  let addSectionId = $state('');
  let addSpan = $state(6);
  let addAggregation = $state('');
  let inspectorMode = $state<InspectorMode>('component');
  let inspectorOpen = $state(true);
  let mobilePane = $state<MobilePane>('copilot');
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
  const addMetricOptions = $derived(catalog?.metrics ?? []);
  const addMetric = $derived(
    addMetricOptions.find((metric) => metric.code === addMetricCode) ??
      addMetricOptions[0] ??
      null
  );
  const addNeedsDimension = $derived(addComponentKind !== 'metric_card');
  const addDimensionOptions = $derived(
    catalog && addMetric
      ? catalog.dimensions.filter((dimension) =>
          addMetric.availableDimensions.includes(dimension.code)
        )
      : []
  );
  const addDimension = $derived(
    addDimensionOptions.find((dimension) => dimension.code === addDimensionCode) ??
      addDimensionOptions[0] ??
      null
  );
  const addReusableSources = $derived(
    querySources.filter(({ source }) =>
      Boolean(
        addMetric &&
          source.fields[addMetric.code]?.role === 'metric' &&
          source.source.type === 'query' &&
          source.source.query.metrics.includes(addMetric.code) &&
          (!addNeedsDimension ||
            (addDimension &&
              source.fields[addDimension.code]?.role === 'dimension' &&
              source.source.query.dimensions?.includes(addDimension.code)))
      )
    )
  );
  const addAggregationOptions = $derived(addMetric?.availableAggregations ?? []);
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
    const compactLayout = window.matchMedia('(max-width: 1179px)');
    if (compactLayout.matches) inspectorOpen = false;
    const closeInspectorForCompactLayout = (event: MediaQueryListEvent) => {
      if (event.matches) inspectorOpen = false;
    };
    compactLayout.addEventListener('change', closeInspectorForCompactLayout);
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
    return () => {
      compactLayout.removeEventListener('change', closeInspectorForCompactLayout);
      window.removeEventListener('message', receive);
    };
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
      revealInspector('component', true);
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
    revealInspector('component');
  }

  function revealInspector(mode: InspectorMode, switchOnSmallScreen = false) {
    inspectorMode = mode;
    inspectorOpen = true;
    if (switchOnSmallScreen && window.matchMedia('(max-width: 760px)').matches) {
      mobilePane = 'inspector';
    }
  }

  function closeInspector() {
    inspectorOpen = false;
    if (window.matchMedia('(max-width: 760px)').matches) mobilePane = 'canvas';
  }

  function openDataSourceInspector(dataSourceId: string | null) {
    if (!dataSourceId) return;
    selectedDataSourceId = dataSourceId;
    revealInspector('dataSource', true);
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

  function editSelected(edit: { title?: string; detail?: string; span?: number }) {
    if (!selected) return;
    dispatch({ type: 'edit_component', locator: selected.locator, edit });
  }

  function openComponentComposer() {
    if (!workspace || !catalog) return;
    addComponentKind = 'metric_card';
    addDataSourceChoice = 'new';
    addMetricCode = catalog.metrics[0]?.code ?? '';
    addDimensionCode = catalog.dimensions.find((dimension) =>
      catalog?.metrics[0]?.availableDimensions.includes(dimension.code)
    )?.code ?? '';
    addAggregation = preferredAggregation(catalog.metrics[0]);
    addSectionId = selected?.locator.sectionId ?? workspace.current.sections[0]?.id ?? '';
    addSpan = 6;
    revealInspector('add', true);
  }

  function chooseAddComponentKind(kind: AddComponentKind) {
    addComponentKind = kind;
    addSpan = kind === 'table' ? 12 : 6;
    if (kind !== 'metric_card' && !addDimensionOptions.some((item) => item.code === addDimensionCode)) {
      addDimensionCode = addDimensionOptions[0]?.code ?? '';
    }
    retainCompatibleAddSource();
  }

  function chooseAddDataSource(value: string) {
    addDataSourceChoice = value;
  }

  function chooseAddMetric(code: string) {
    addMetricCode = code;
    const metric = catalog?.metrics.find((candidate) => candidate.code === code);
    addAggregation = preferredAggregation(metric);
    if (!metric?.availableDimensions.includes(addDimensionCode)) {
      addDimensionCode = catalog?.dimensions.find((dimension) =>
        metric?.availableDimensions.includes(dimension.code)
      )?.code ?? '';
    }
    retainCompatibleAddSource();
  }

  function chooseAddDimension(code: string) {
    addDimensionCode = code;
    retainCompatibleAddSource();
  }

  function retainCompatibleAddSource() {
    if (
      addDataSourceChoice !== 'new' &&
      !addReusableSources.some((source) => source.id === addDataSourceChoice)
    ) {
      addDataSourceChoice = 'new';
    }
  }

  function addBoundComponent() {
    if (
      !workspace ||
      !catalog ||
      !addMetric ||
      !addSectionId ||
      (addNeedsDimension && !addDimension)
    ) return;
    const kindSlug = componentKindSlug(addComponentKind);
    const componentId = nextAvailableId(`${addMetric.code}-${kindSlug}`, componentIds());
    const dataSourceId =
      addDataSourceChoice === 'new'
        ? nextAvailableId(
            addNeedsDimension && addDimension
              ? `${addMetric.code}-by-${addDimension.code}`
              : `${addMetric.code}-summary`,
            Object.keys(workspace.current.dataSources)
          )
        : addDataSourceChoice;
    const afterComponentId =
      selected?.locator.sectionId === addSectionId
        ? selected.locator.componentId
        : undefined;
    const previous = workspace;
    const component: BoundComponentInsertion =
      addComponentKind === 'metric_card'
        ? {
            kind: 'metric_card',
            componentId,
            title: addMetric.name,
            metricCode: addMetric.code,
            span: addSpan
          }
        : {
            kind: addComponentKind as DimensionedVisualizationKind,
            componentId,
            title: `${addDimension!.name}${addMetric.name}`,
            metricCode: addMetric.code,
            dimensionCode: addDimension!.code,
            span: addSpan
          };
    dispatch({
      type: 'insert_bound_component',
      component,
      placement: { sectionId: addSectionId, ...(afterComponentId ? { afterComponentId } : {}) },
      dataSource:
        addDataSourceChoice === 'new'
          ? {
              mode: 'create_query',
              dataSourceId,
              aggregation: addAggregation
            }
          : { mode: 'reuse', dataSourceId },
      catalog
    });
    if (workspace === previous) {
      error = `无法添加${componentKindLabel(addComponentKind)}：请重新选择兼容的指标、维度或页面数据源。`;
      return;
    }
    dispatch({
      type: 'select_component',
      locator: { sectionId: addSectionId, componentId }
    });
    selectedDataSourceId = dataSourceId;
    revealInspector('component');
    notice = `已添加“${component.title}”${componentKindLabel(addComponentKind)}，并${addDataSourceChoice === 'new' ? '创建' : '复用'} query 页面数据源 ${dataSourceId}。`;
  }

  function componentKindSlug(kind: AddComponentKind): string {
    return {
      metric_card: 'card',
      bar_chart: 'bar',
      line_chart: 'line',
      pie_chart: 'pie',
      ranking_card: 'ranking',
      table: 'table'
    }[kind];
  }

  function componentKindLabel(kind: AddComponentKind): string {
    return {
      metric_card: '指标卡',
      bar_chart: '柱状图',
      line_chart: '折线图',
      pie_chart: '饼图',
      ranking_card: '排行卡',
      table: '明细表'
    }[kind];
  }

  function removeSelected() {
    if (!selected) return;
    const title = selected.title || selected.locator.componentId;
    dispatch({ type: 'remove_component', locator: selected.locator });
    notice = `已删除“${title}”；独占的页面数据源已一并清理，可撤销。`;
  }

  function componentIds(): string[] {
    return workspace?.current.sections.flatMap((section) =>
      section.components.map((component) => component.id)
    ) ?? [];
  }

  function nextAvailableId(base: string, existing: string[]): string {
    const normalized = base.toLowerCase().replace(/[^a-z0-9-]+/gu, '-').replace(/^-+|-+$/gu, '') || 'item';
    if (!existing.includes(normalized)) return normalized;
    let suffix = 2;
    while (existing.includes(`${normalized}-${suffix}`)) suffix += 1;
    return `${normalized}-${suffix}`;
  }

  function preferredAggregation(metric: CatalogSnapshot['metrics'][number] | undefined): string {
    if (!metric) return '';
    if (
      metric.availableAggregations.includes('avg') &&
      (metric.valueType === 'percent' || /rate|ratio|percent|率/iu.test(`${metric.code} ${metric.name}`))
    ) {
      return 'avg';
    }
    return metric.availableAggregations[0] ?? '';
  }

  function componentDataSourceId(component: EditableComponent): string | null {
    return workspace?.current.sections
      .find((section) => section.id === component.locator.sectionId)
      ?.components.find((candidate) => candidate.id === component.locator.componentId)
      ?.data?.main ?? null;
  }

  function componentDataSource(component: EditableComponent): DataSource | undefined {
    const dataSourceId = componentDataSourceId(component);
    return dataSourceId ? workspace?.current.dataSources[dataSourceId] : undefined;
  }

  function dataSourceSummary(source: DataSource | undefined): string {
    if (!source) return '未找到页面数据源';
    if (source.source.type === 'inline') return `固定数据 · ${source.source.rows.length} 行`;
    const metricNames = source.source.query.metrics.map(
      (code) => catalog?.metrics.find((metric) => metric.code === code)?.name ?? code
    );
    const dimensionNames = (source.source.query.dimensions ?? []).map(
      (code) => catalog?.dimensions.find((dimension) => dimension.code === code)?.name ?? code
    );
    return [metricNames.join('、'), dimensionNames.length ? `按${dimensionNames.join('、')}` : '', source.source.query.aggregation]
      .filter(Boolean)
      .join(' · ');
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
      ? (JSON.parse(JSON.stringify(selectedSource.source.source.query)) as StructuredQuery)
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

<div
  class="authoring-workbench"
  class:inspector-open={inspectorOpen}
  class:mobile-copilot={mobilePane === 'copilot'}
  class:mobile-canvas={mobilePane === 'canvas'}
  class:mobile-inspector={mobilePane === 'inspector'}
>
  <nav class="mobile-panes" aria-label="工作台区域">
    <button class:active={mobilePane === 'copilot'} type="button" onclick={() => (mobilePane = 'copilot')}>AI 协作</button>
    <button class:active={mobilePane === 'canvas'} type="button" onclick={() => (mobilePane = 'canvas')} disabled={!workspace}>画布</button>
    <button class:active={mobilePane === 'inspector'} type="button" onclick={() => { mobilePane = 'inspector'; inspectorOpen = true; }} disabled={!workspace}>检查器</button>
  </nav>
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

    <div class="workspace-scroll">
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
      </section>

    </div>

    <footer class="lifecycle-panel">
      <div><span>页面修订</span><strong>{workspace?.revisionNumber ? `R${workspace.revisionNumber}` : '未保存'}</strong></div>
      <button type="button" onclick={showPrecisePreview} disabled={!workspace?.baseRevisionId || dirty}>精确预览</button>
      <button type="button" onclick={() => void requestPublish()} disabled={!workspace?.baseRevisionId || dirty || previewedRevisionId !== workspace.baseRevisionId || publishing}>{publishing ? '申请中…' : '申请发布'}</button>
      {#if publishRequest}<a href={publishRequest.confirmationUrl} target="_blank" rel="noreferrer">核对并确认发布 ↗</a>{/if}
    </footer>

    <section class="composer-dock" aria-label="Agent 调整输入区">
      <div class="ai-quick-actions">
        <span>AI 与手动编辑共用当前工作副本</span>
        <button type="button" onclick={openComponentComposer} disabled={!workspace || !catalog}>＋ 手动添加</button>
      </div>
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
  </aside>

  <main class="canvas-column">
    <header class="canvas-toolbar">
      <div><i class:dirty></i><strong>统一运行时</strong><span>{canvasMode === 'authoring' ? '未保存工作副本' : `精确预览 · R${workspace?.revisionNumber}`}</span></div>
      <div class="canvas-actions">
        <div class="mode-switch"><button class:active={canvasMode === 'authoring'} type="button" onclick={() => (canvasMode = 'authoring')} disabled={!workspace}>编辑画布</button><button class:active={canvasMode === 'preview'} type="button" onclick={showPrecisePreview} disabled={!workspace?.baseRevisionId || dirty}>精确预览</button></div>
        <button class="inspector-toggle" type="button" onclick={() => { inspectorOpen = true; inspectorMode = 'component'; }} disabled={!workspace}>检查器</button>
      </div>
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

  <button class="inspector-backdrop" type="button" aria-label="关闭检查器" onclick={closeInspector}></button>

  <aside class="inspector-column" aria-label="统一检查器">
    <header class="inspector-toolbar">
      <div>
        <span>统一检查器</span>
        <strong>{inspectorMode === 'component' ? '组件属性' : inspectorMode === 'dataSource' ? '页面数据源' : '添加数据组件'}</strong>
      </div>
      <div class="inspector-toolbar-actions">
        {#if inspectorMode !== 'component'}<button type="button" onclick={() => revealInspector('component')}>返回</button>{/if}
        <button type="button" aria-label="关闭检查器" onclick={closeInspector}>×</button>
      </div>
    </header>

    <div class="inspector-scroll">
      <section class="inspector-panel">
        <nav class="inspector-modes" aria-label="检查器模式">
          <button class:active={inspectorMode === 'component'} type="button" onclick={() => revealInspector('component')}>组件</button>
          <button class:active={inspectorMode === 'dataSource'} type="button" onclick={() => revealInspector('dataSource')} disabled={querySources.length === 0}>页面数据源</button>
          <button class:active={inspectorMode === 'add'} type="button" onclick={openComponentComposer} disabled={!workspace || !catalog}>＋ 新增</button>
        </nav>

        {#if inspectorMode === 'component'}
          <div class="inspector-heading">
            <div><strong>页面内容</strong><span>{components.length} 个组件</span></div>
          </div>
          {#if components.length > 0}
            <div class="component-list" aria-label="组件列表">
              {#each components as component (component.locator.sectionId + component.locator.componentId)}
                <button class:selected={selected && sameLocator(selected.locator, component.locator)} type="button" onclick={() => selectFromInspector(component)}>
                  <span>{component.typeLabel}</span><strong>{component.title || component.locator.componentId}</strong><small>{component.span}/12</small>
                </button>
              {/each}
            </div>
          {/if}

          {#if selected}
            <div class="selection-summary"><span>{selected.typeLabel}</span><strong>{selected.title || selected.locator.componentId}</strong><small>选中组件与画布同步</small></div>
            <div class="property-form">
              <label>标题<input value={selected.title} onchange={(event) => editSelected({ title: valueOf(event) })} /></label>
              {#if selected.detailLabel}<label>{selected.detailLabel}<input value={selected.detail} onchange={(event) => editSelected({ detail: valueOf(event) })} /></label>{/if}
              <div class="span-field">
                <span>组件宽度 <small>当前 {selected.span}/12</small></span>
                <div class="span-control">
                  {#each [6, 12] as span}<button type="button" class:active={selected.span === span} onclick={() => editSelected({ span })}>{span}/12</button>{/each}
                </div>
              </div>
              <div class="selected-source">
                <span>绑定页面数据源</span>
                <strong>{componentDataSourceId(selected) ?? '无'}</strong>
                <p>{dataSourceSummary(componentDataSource(selected))}</p>
                {#if componentDataSourceId(selected)}<button type="button" onclick={() => openDataSourceInspector(componentDataSourceId(selected))}>编辑结构化查询 →</button>{/if}
              </div>
              <div class="danger-zone"><p>删除可撤销；独占的页面数据源会同步清理。</p><button type="button" class="remove" onclick={removeSelected}>删除组件</button></div>
            </div>
          {:else}
            <div class="inspector-empty"><span>◎</span><strong>未选中组件</strong><p>点击中央画布中的组件，在这里编辑属性和页面数据源。</p></div>
          {/if}
        {:else if inspectorMode === 'dataSource'}
          <div class="mode-intro"><strong>结构化查询</strong><p>修改会同步字段契约和组件数据绑定。</p></div>
          <div class="source-select">
            <label>页面数据源<select bind:value={selectedDataSourceId}>{#each querySources as candidate}<option value={candidate.id}>{candidate.id}</option>{/each}</select></label>
            {#if selectedSource}<p>{dataSourceSummary(selectedSource.source)}</p>{/if}
          </div>
          {#if selectedSource && selectedQuery() && catalog}
            {@const query = selectedQuery()!}
            <div class="query-editor">
              <fieldset><legend>指标</legend>{#each catalog.metrics as metric}<label class:disabled={!metricCompatible(metric.code)}><input type="checkbox" checked={query.metrics.includes(metric.code)} disabled={!query.metrics.includes(metric.code) && !metricCompatible(metric.code)} onchange={(event) => toggleMetric(metric.code, checkedOf(event))} /><span><strong>{metric.name}</strong><code>{metric.code}</code></span></label>{/each}</fieldset>
              <div class="query-grid primary-query-fields">
                <label>聚合方式<select value={query.aggregation ?? ''} onchange={(event) => applyQuery({ ...query, aggregation: valueOf(event) })}>{#each aggregationOptions() as aggregation}<option value={aggregation}>{aggregation}</option>{/each}</select></label>
              </div>
              <details class="advanced-query">
                <summary>维度、排序与限制</summary>
                <fieldset><legend>维度</legend>{#each catalog.dimensions as dimension}<label class:disabled={!dimensionCompatible(dimension.code)}><input type="checkbox" checked={(query.dimensions ?? []).includes(dimension.code)} disabled={!(query.dimensions ?? []).includes(dimension.code) && !dimensionCompatible(dimension.code)} onchange={(event) => toggleDimension(dimension.code, checkedOf(event))} /><span><strong>{dimension.name}</strong><code>{dimension.code}</code></span></label>{/each}</fieldset>
                <div class="query-grid">
                  <label>排序字段<select value={query.orderBy?.[0]?.field ?? query.metrics[0]} onchange={(event) => applyQuery({ ...query, orderBy: [{ field: valueOf(event), direction: query.orderBy?.[0]?.direction ?? 'desc' }] })}>{#each [...(query.dimensions ?? []), ...query.metrics] as field}<option value={field}>{field}</option>{/each}</select></label>
                  <label>方向<select value={query.orderBy?.[0]?.direction ?? 'desc'} onchange={(event) => applyQuery({ ...query, orderBy: [{ field: query.orderBy?.[0]?.field ?? query.metrics[0]!, direction: valueOf(event) as 'asc' | 'desc' }] })}><option value="desc">desc</option><option value="asc">asc</option></select></label>
                  <label>限制行数<input type="number" min="1" max="1000" value={query.limit ?? 100} onchange={(event) => applyQuery({ ...query, limit: Number(valueOf(event)) })} /></label>
                </div>
              </details>
              <p class="catalog-proof">元数据版本 <code>{metadataVersion.slice(0, 12)}…</code></p>
              {#if selected}<button class="return-to-component" type="button" onclick={() => revealInspector('component')}>← 返回绑定组件</button>{/if}
            </div>
          {:else}<div class="inspector-empty"><strong>没有可编辑的页面数据源</strong><p>当前看板页面尚未使用 query 页面数据源。</p></div>{/if}
        {:else if workspace && catalog}
          <div class="mode-intro"><strong>添加数据组件</strong><p>选择展示方式和数据组合，ID 与字段绑定将自动生成。</p></div>
          <div class="add-card-composer" aria-label="添加数据组件">
            <div class="component-kind-choice" aria-label="展示方式">
              {#each ADD_COMPONENT_KINDS as kind}
                <button type="button" class:active={addComponentKind === kind} onclick={() => chooseAddComponentKind(kind)}>{componentKindLabel(kind)}</button>
              {/each}
            </div>
            <div class="add-grid">
              <label>指标
                <select value={addMetricCode} onchange={(event) => chooseAddMetric(valueOf(event))}>
                  {#each addMetricOptions as metric}<option value={metric.code}>{metric.name}</option>{/each}
                </select>
              </label>
              {#if addNeedsDimension}
                <label>维度
                  <select value={addDimensionCode} onchange={(event) => chooseAddDimension(valueOf(event))}>
                    {#each addDimensionOptions as dimension}<option value={dimension.code}>{dimension.name}</option>{/each}
                  </select>
                </label>
              {/if}
              <label>页面数据源
                <select value={addDataSourceChoice} onchange={(event) => chooseAddDataSource(valueOf(event))}>
                  <option value="new">新建 query 页面数据源</option>
                  {#each addReusableSources as candidate}<option value={candidate.id}>复用 {candidate.id}</option>{/each}
                </select>
              </label>
              {#if addDataSourceChoice === 'new'}
                <label>聚合方式<select bind:value={addAggregation}>{#each addAggregationOptions as aggregation}<option value={aggregation}>{aggregation}</option>{/each}</select></label>
              {/if}
              <label>放入分区<select bind:value={addSectionId}>{#each workspace.current.sections as section}<option value={section.id}>{section.title ?? section.id}</option>{/each}</select></label>
            </div>
            <div class="layout-choice"><span>组件宽度</span>{#each [6, 12] as span}<button type="button" class:active={addSpan === span} onclick={() => (addSpan = span)}>{span}/12</button>{/each}</div>
            <div class="add-summary"><span>{componentKindLabel(addComponentKind)} · {addMetric?.name}{addNeedsDimension && addDimension ? ` / ${addDimension.name}` : ''}</span><span>{addDataSourceChoice === 'new' ? '自动创建 query 页面数据源' : `复用 ${addDataSourceChoice}`} · 绑定 main 数据槽</span></div>
            <button class="confirm-add" type="button" onclick={addBoundComponent} disabled={!addMetric || !addSectionId || (addNeedsDimension && !addDimension) || (addDataSourceChoice === 'new' && !addAggregation)}>添加到未保存工作副本</button>
          </div>
        {/if}
      </section>
    </div>
  </aside>
</div>

<style>
  .authoring-workbench { display: grid; height: calc(100vh - 54px); height: calc(100dvh - 54px); grid-template-columns: clamp(330px, 34vw, 470px) minmax(0, 1fr); overflow: hidden; background: #eef1f6; }
  .control-column { display: grid; min-width: 0; min-height: 0; grid-template-rows: auto auto minmax(0, 1fr) auto auto; overflow: hidden; background: #fff; border-right: 1px solid #dde2ea; }
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
  .existing-page input, .property-form input, .source-select select, .query-grid input, .query-grid select, .add-card-composer select { width: 100%; min-height: 32px; padding: 6px 8px; color: #273146; background: #fff; border: 1px solid #d5dbe5; border-radius: 6px; font: inherit; font-size: 10px; }
  .existing-page button { width: auto; padding-inline: 12px; }
  .workspace-scroll { min-height: 0; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
  .conversation-panel { display: flex; min-height: 0; flex-direction: column; padding: 14px 18px 12px; }
  .panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 9px; }
  .provider { display: flex; align-items: center; gap: 5px; color: #7a8497; font-size: 8px; }.provider i { width: 6px; height: 6px; background: #22c55e; border-radius: 50%; }
  .messages { display: flex; min-height: 80px; flex-direction: column; gap: 8px; }
  .assistant-message, .user-message { max-width: 90%; padding: 9px 10px; color: #3f4a5f; background: #f0f2f7; border-radius: 10px 10px 10px 3px; font-size: 10px; line-height: 1.5; }
  .user-message { align-self: flex-end; color: #fff; background: #554dcc; border-radius: 10px 10px 3px 10px; }.assistant-message small, .user-message small { display: block; margin-bottom: 2px; opacity: .65; font-size: 7px; font-weight: 900; text-transform: uppercase; }
  .identity-gate { display: grid; gap: 6px; padding: 10px; color: #594f31; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; font-size: 9px; }.identity-gate code { font-size: 12px; font-weight: 800; }.identity-gate button { justify-self: start; padding: 6px 9px; color: #fff; background: #a16207; border: 0; border-radius: 5px; }
  .tool-strip { display: flex; flex-wrap: wrap; gap: 4px; padding-top: 7px; }.tool-strip span, .tool-strip strong { padding: 3px 6px; color: #216e4e; background: #ecfdf3; border-radius: 999px; font-size: 8px; }.tool-strip .error-tool, .tool-strip .invalid { color: #991b1b; background: #fef2f2; }
  .composer-dock { position: relative; z-index: 5; padding: 9px 18px 12px; background: #fff; border-top: 1px solid #dfe4ec; box-shadow: 0 -8px 24px rgb(15 23 42 / .05); }
  .target-context { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 7px; padding: 7px 9px; color: #4b43aa; background: #f0efff; border: 1px solid #ddd9ff; border-radius: 7px; }.target-context span, .target-context small { color: #787496; font-size: 8px; }.target-context strong { overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }.target-context small { grid-column: 1 / -1; }
  .composer { position: relative; margin-top: 7px; }.composer textarea { display: block; width: 100%; resize: none; padding: 9px 96px 9px 9px; color: #273146; background: #fbfcfe; border: 1px solid #ccd3df; border-radius: 8px; outline: 0; font: inherit; font-size: 10px; line-height: 1.45; }.composer textarea:focus { background: #fff; border-color: #6c63dc; box-shadow: 0 0 0 3px rgb(99 102 241 / .12); }.composer button { position: absolute; right: 7px; bottom: 7px; padding: 6px 9px; color: #fff; background: #4f46e5; border: 0; border-radius: 5px; font-size: 9px; font-weight: 800; }
  .add-card-composer, .add-grid { display: grid; }
  .layout-choice { display: flex; align-items: center; gap: 5px; }.layout-choice > span { margin-right: auto; color: #5f687b; font-size: 8px; font-weight: 800; }.layout-choice button { padding: 5px 7px; color: #687286; background: #fff; border: 1px solid #d8dce6; border-radius: 5px; font-size: 8px; }.layout-choice button.active { color: #4338ca; background: #eeecff; border-color: #7770e5; font-weight: 900; }.add-summary { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; color: #747d8f; background: #fff; border-radius: 6px; font-size: 8px; }.confirm-add { width: 100%; color: #fff; background: #4f46e5; border: 0; border-radius: 6px; font-weight: 900; }
  .component-list { display: flex; gap: 5px; padding-bottom: 8px; overflow-x: auto; }.component-list button { display: grid; min-width: 132px; gap: 2px; padding: 7px 8px; color: #596377; text-align: left; background: #fff; border: 1px solid #dce1e9; border-radius: 6px; }.component-list button.selected { color: #4338ca; background: #f2f1ff; border-color: #7770e5; }.component-list span, .component-list small { overflow: hidden; font-size: 7px; text-overflow: ellipsis; white-space: nowrap; }.component-list strong { overflow: hidden; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
  .query-editor { display: grid; gap: 8px; }.query-editor fieldset { display: flex; gap: 5px; padding: 7px; overflow-x: auto; border: 1px solid #e0e4eb; border-radius: 6px; }.query-editor legend { padding: 0 4px; color: #697386; font-size: 8px; font-weight: 900; }.query-editor fieldset label { display: flex; min-width: 102px; align-items: center; gap: 5px; padding: 5px; background: #f8f9fb; border-radius: 5px; font-size: 8px; }.query-editor fieldset label.disabled { opacity: .45; }.query-editor fieldset span { display: grid; }.query-editor fieldset code { color: #8a93a5; font-size: 7px; }.query-editor input[type='checkbox'] { accent-color: #4f46e5; }
  .query-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }.catalog-proof { color: #7c8698; font-size: 8px; }.catalog-proof code { color: #4f46e5; }
  .lifecycle-panel { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 6px; padding: 8px 18px; background: #fafbfc; border-top: 1px solid #dfe4ec; }.lifecycle-panel div { display: grid; }.lifecycle-panel span { color: #8a93a4; font-size: 7px; }.lifecycle-panel strong { font-size: 10px; }.lifecycle-panel button, .lifecycle-panel a { padding: 7px 9px; color: #4f46e5; background: #fff; border: 1px solid #cfcbed; border-radius: 6px; font-size: 8px; font-weight: 800; text-decoration: none; }.lifecycle-panel a { grid-column: 1 / -1; color: #fff; text-align: center; background: #4f46e5; }
  .canvas-column { display: flex; min-width: 0; min-height: 0; flex-direction: column; padding: 0; overflow: hidden; }
  .canvas-toolbar { display: flex; min-height: 44px; align-items: center; justify-content: space-between; padding: 0 14px; background: #fafbfc; border-bottom: 1px solid #dce1e8; }.canvas-toolbar > div { display: flex; align-items: center; gap: 7px; color: #727c8d; font-size: 9px; }.canvas-toolbar i { width: 7px; height: 7px; background: #22c55e; border-radius: 50%; }.canvas-toolbar i.dirty { background: #f59e0b; }.canvas-toolbar strong { color: #424b5e; }.mode-switch { padding: 3px; background: #eef0f4; border-radius: 6px; }.mode-switch button { padding: 5px 8px; color: #7a8496; background: transparent; border: 0; border-radius: 4px; font-size: 8px; }.mode-switch button.active { color: #3730a3; background: #fff; box-shadow: 0 1px 3px rgb(15 23 42 / .1); }
  iframe { width: 100%; min-height: 0; flex: 1; border: 0; background: #fafafa; }
  .canvas-empty { display: grid; min-height: 0; flex: 1; place-content: center; justify-items: center; gap: 7px; color: #7a8496; text-align: center; }.canvas-empty span { display: grid; width: 46px; height: 46px; place-items: center; color: #fff; background: #4f46e5; border-radius: 14px; font-size: 20px; box-shadow: 0 12px 30px rgb(79 70 229 / .24); }.canvas-empty h2 { color: #3f485a; }.canvas-empty p { max-width: 360px; font-size: 10px; }
  .error, .notice { position: absolute; top: 105px; right: 18px; z-index: 20; max-width: 420px; padding: 9px 12px; color: #991b1b; background: #fef2f2; border: 1px solid #fecaca; border-radius: 7px; box-shadow: 0 8px 24px rgb(15 23 42 / .12); font-size: 9px; }.notice { top: 105px; color: #166534; background: #f0fdf4; border-color: #bbf7d0; }
  @media (max-width: 680px) { .authoring-workbench { height: auto; grid-template-columns: 1fr; overflow: visible; }.control-column { height: calc(100vh - 54px); height: calc(100dvh - 54px); }.canvas-column { min-height: 680px; }.add-grid, .query-grid { grid-template-columns: 1fr; }.add-grid label:last-child { grid-column: auto; } }

  /* Scheme A: persistent AI collaboration, runtime canvas, unified inspector. */
  .authoring-workbench { position: relative; grid-template-columns: clamp(300px, 25vw, 360px) minmax(0, 1fr) minmax(320px, 360px); }
  .authoring-workbench:not(.inspector-open) { grid-template-columns: clamp(300px, 25vw, 360px) minmax(0, 1fr); }
  .mobile-panes, .inspector-backdrop { display: none; }
  .authoring-workbench:not(.inspector-open) .inspector-column { display: none; }
  .control-column { grid-template-rows: auto auto minmax(0, 1fr) auto auto; }
  .workspace-scroll { display: flex; }
  .conversation-panel { flex: 1; }
  .messages { flex: 1; }
  .ai-quick-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 7px; color: #8a93a4; font-size: 8px; }
  .ai-quick-actions button { flex: none; padding: 5px 7px; color: #4f46e5; background: #f0efff; border: 0; border-radius: 6px; font-size: 8px; font-weight: 800; }

  .canvas-actions { display: flex; align-items: center; gap: 7px; }
  .inspector-toggle { display: none; padding: 6px 9px; color: #4f46e5; background: #fff; border: 1px solid #cfcbed; border-radius: 6px; font-size: 8px; font-weight: 800; }
  .authoring-workbench:not(.inspector-open) .inspector-toggle { display: block; }

  .inspector-column { display: flex; min-width: 0; min-height: 0; flex-direction: column; overflow: hidden; background: #fff; border-left: 1px solid #dce1e8; }
  .inspector-toolbar { display: flex; min-height: 54px; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; border-bottom: 1px solid #e3e7ed; }
  .inspector-toolbar > div:first-child { display: grid; gap: 2px; }
  .inspector-toolbar span { color: #7d8798; font-size: 8px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
  .inspector-toolbar strong { color: #30394c; font-size: 12px; }
  .inspector-toolbar-actions { display: flex; align-items: center; gap: 5px; }
  .inspector-toolbar-actions button { min-width: 28px; height: 28px; padding: 0 7px; color: #697386; background: #f6f7f9; border: 0; border-radius: 6px; font-size: 9px; }
  .inspector-toolbar-actions button:last-child { font-size: 15px; }
  .inspector-scroll { min-height: 0; flex: 1; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
  .inspector-panel { min-height: 100%; padding: 12px 14px 20px; border: 0; }
  .inspector-modes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; padding: 3px; margin-bottom: 16px; background: #f0f2f5; border-radius: 8px; }
  .inspector-modes button { min-width: 0; padding: 6px 4px; color: #747e90; background: transparent; border: 0; border-radius: 6px; font-size: 8px; font-weight: 800; }
  .inspector-modes button.active { color: #3730a3; background: #fff; box-shadow: 0 1px 3px rgb(15 23 42 / .1); }
  .inspector-heading { margin-bottom: 8px; }
  .component-list { display: grid; max-height: 146px; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; padding: 0 2px 10px 0; overflow-x: hidden; overflow-y: auto; }
  .component-list button { min-width: 0; padding: 7px 8px; }
  .selection-summary { display: grid; gap: 2px; padding: 10px 0 11px; border-top: 1px solid #edf0f4; }
  .selection-summary span { color: #6558d9; font-size: 7px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
  .selection-summary strong { overflow: hidden; color: #30394c; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
  .selection-summary small { color: #8a93a4; font-size: 8px; }
  .property-form { display: grid; grid-template-columns: 1fr; gap: 10px; }
  .property-form label, .source-select label, .query-grid label, .add-grid label { display: grid; grid-column: auto; gap: 5px; color: #5f687b; font-size: 9px; font-weight: 800; }
  .property-form label:last-of-type { grid-column: auto; }
  .property-form input, .source-select select, .query-grid input, .query-grid select, .add-card-composer select { width: 100%; min-height: 34px; padding: 7px 8px; color: #273146; background: #fff; border: 1px solid #d5dbe5; border-radius: 6px; font: inherit; font-size: 10px; }
  .span-field { display: grid; gap: 6px; }
  .span-field > span { display: flex; align-items: center; justify-content: space-between; color: #5f687b; font-size: 9px; font-weight: 800; }
  .span-field small { color: #8a93a4; font-size: 8px; font-weight: 500; }
  .span-control { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .span-control button { padding: 8px; color: #687286; background: #fff; border: 1px solid #d8dce6; border-radius: 6px; font-size: 9px; font-weight: 800; }
  .span-control button.active { color: #4338ca; background: #eeecff; border-color: #7770e5; }
  .selected-source { display: grid; grid-template-columns: 1fr; gap: 4px; padding: 10px; color: #7c8698; background: #f6f7fa; border: 1px solid #e6e9ee; border-radius: 8px; font-size: 8px; }
  .selected-source > span { color: #7c8698; font-size: 8px; }
  .selected-source strong { color: #343d4f; font-size: 10px; }
  .selected-source p { color: #737d8e; font-size: 8px; line-height: 1.5; }
  .selected-source button { justify-self: start; padding: 5px 7px; margin-top: 3px; color: #4f46e5; background: #fff; border: 1px solid #d7d3f3; border-radius: 5px; font-size: 8px; font-weight: 800; }
  .danger-zone { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 10px; margin-top: 2px; border-top: 1px solid #eceff3; }
  .danger-zone p { color: #929baa; font-size: 8px; line-height: 1.45; }
  .danger-zone .remove { flex: none; padding: 6px 8px; color: #b42318; background: #fff; border: 1px solid #f2c7c3; border-radius: 5px; font-size: 8px; }
  .inspector-empty { display: grid; justify-items: center; gap: 6px; padding: 42px 16px; color: #7d8797; text-align: center; }
  .inspector-empty > span { display: grid; width: 34px; height: 34px; place-items: center; color: #6558d9; background: #f0efff; border-radius: 10px; font-size: 17px; }
  .inspector-empty strong { color: #3f485a; font-size: 11px; }
  .inspector-empty p { max-width: 250px; font-size: 9px; line-height: 1.55; }
  .mode-intro { display: grid; gap: 3px; margin-bottom: 12px; }
  .mode-intro strong { color: #343d4f; font-size: 11px; }
  .mode-intro p { color: #858fa1; font-size: 8px; line-height: 1.5; }
  .source-select { display: grid; gap: 5px; padding: 10px; margin-bottom: 10px; background: #f6f7fa; border-radius: 8px; }
  .source-select p { color: #737d8e; font-size: 8px; line-height: 1.45; }
  .query-editor { display: grid; gap: 10px; }
  .query-editor fieldset { display: grid; max-height: 160px; grid-template-columns: 1fr; gap: 5px; padding: 8px; overflow-x: hidden; overflow-y: auto; }
  .query-editor fieldset label { min-width: 0; }
  .query-grid { grid-template-columns: 1fr; }
  .advanced-query { padding: 9px 10px; background: #fafbfc; border: 1px solid #e3e7ed; border-radius: 8px; }
  .advanced-query summary { color: #4b5568; cursor: pointer; font-size: 9px; font-weight: 800; }
  .advanced-query fieldset, .advanced-query .query-grid { margin-top: 10px; }
  .return-to-component { justify-self: start; padding: 6px 8px; color: #4f46e5; background: #fff; border: 1px solid #d7d3f3; border-radius: 5px; font-size: 8px; font-weight: 800; }
  .add-card-composer { gap: 12px; padding: 0; margin: 0; background: transparent; border: 0; border-radius: 0; box-shadow: none; }
  .component-kind-choice { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
  .component-kind-choice button { min-width: 0; padding: 7px 4px; color: #697386; background: #f5f6f8; border: 1px solid transparent; border-radius: 6px; font-size: 8px; font-weight: 800; }
  .component-kind-choice button.active { color: #4338ca; background: #eef2ff; border-color: #c7d2fe; }
  .add-grid { grid-template-columns: 1fr; gap: 10px; }
  .add-grid label:last-child { grid-column: auto; }
  .layout-choice { padding-top: 2px; }
  .layout-choice button { flex: 1; padding: 7px; }
  .add-summary { padding: 9px 10px; line-height: 1.45; }
  .confirm-add { padding: 10px; font-size: 10px; }

  @media (max-width: 1179px) and (min-width: 761px) {
    .authoring-workbench, .authoring-workbench:not(.inspector-open) { grid-template-columns: clamp(300px, 30vw, 360px) minmax(0, 1fr); }
    .authoring-workbench:not(.inspector-open) .inspector-column { display: flex; }
    .inspector-column { position: fixed; z-index: 31; top: 54px; right: 0; bottom: 0; width: min(360px, calc(100vw - 300px)); transform: translateX(102%); box-shadow: -16px 0 40px rgb(15 23 42 / .18); transition: transform .18s ease; }
    .authoring-workbench.inspector-open .inspector-column { transform: translateX(0); }
    .authoring-workbench.inspector-open .inspector-backdrop { position: fixed; z-index: 30; inset: 54px 0 0; display: block; background: rgb(15 23 42 / .2); border: 0; }
    .inspector-toggle { display: block; }
  }

  @media (max-width: 760px) {
    .authoring-workbench, .authoring-workbench:not(.inspector-open) { display: grid; height: calc(100vh - 54px); height: calc(100dvh - 54px); grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); overflow: hidden; }
    .mobile-panes { z-index: 40; display: grid; grid-column: 1; grid-row: 1; grid-template-columns: repeat(3, 1fr); gap: 3px; padding: 5px; background: #f3f5f8; border-bottom: 1px solid #dce1e8; }
    .mobile-panes button { padding: 7px; color: #6f798a; background: transparent; border: 0; border-radius: 6px; font-size: 9px; font-weight: 800; }
    .mobile-panes button.active { color: #3730a3; background: #fff; box-shadow: 0 1px 3px rgb(15 23 42 / .1); }
    .control-column, .canvas-column, .inspector-column, .authoring-workbench:not(.inspector-open) .inspector-column { display: none; grid-column: 1; grid-row: 2; width: auto; min-height: 0; }
    .mobile-copilot .control-column { display: grid; height: auto; border-right: 0; }
    .mobile-canvas .canvas-column { display: flex; min-height: 0; }
    .mobile-inspector .inspector-column { position: static; display: flex; transform: none; box-shadow: none; }
    .inspector-backdrop, .inspector-toggle { display: none !important; }
    .workbench-header { padding: 10px 14px; }
    .existing-page, .conversation-panel, .composer-dock { padding-right: 14px; padding-left: 14px; }
    .canvas-toolbar { padding: 0 10px; }
    .canvas-toolbar > div:first-child span { display: none; }
    .error, .notice { top: 48px; right: 10px; left: 10px; max-width: none; }
  }
</style>
