<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { replaceState } from '$app/navigation';
  import { fade, fly } from 'svelte/transition';
  import { RuntimeView, type AuthoringIntent } from '@metriccanvas/runtime-ui';
  import { parseAskConversation } from './ask/conversation';
  import type { AgentMessage } from './server/agent/types';
  import { createPlatformDataGateway } from './platform-data-gateway';
  import type { MetricCandidate } from './server/session/step-event';
  import {
    buildAgentStreamRequestBody,
    pinComponent,
    type PinnedComponentChoice,
    type ScopeCardConfirmationChoice
  } from './workbench/agent-request';
  import {
    canSubmitComposer,
    shouldSubmitComposerKeydown
  } from './workbench/composer-behavior';
  import {
    applyOutcome,
    applyStreamEvent,
    applyTransportFailure,
    awaitingScopeConfirmation,
    createRunView,
    scopeCards,
    type WorkbenchRunView
  } from './workbench/run-state';
  import { openAgentRunStream } from './workbench/stream-consumer';
  import {
    sessionReplayView,
    type RecordedSessionPayload
  } from './workbench/session-replay';
  import { SUGGESTED_QUESTIONS } from './ask/suggested-questions';
  import { askFormulaTraces, type PromotedOutcome } from './workbench/promote-flow';
  import { workbenchPageViewModel } from './workbench/transient-page';
  import {
    changeComponentType,
    componentCandidatesFor,
    createCanvasAuthoringDraft,
    editComponent,
    locatorOfComponent,
    moveComponent,
    type ComponentLocator,
    type CanvasAuthoringDraft,
    type DocumentEditResult
  } from './workbench/document-edit';
  import CandidatesCard from './workbench/CandidatesCard.svelte';
  import Inspector from './workbench/Inspector.svelte';
  import InteractionCard from './workbench/InteractionCard.svelte';
  import MetadataJsonDrawer from './workbench/MetadataJsonDrawer.svelte';
  import PromotePanel from './workbench/PromotePanel.svelte';
  import ScopeCard from './workbench/ScopeCard.svelte';
  import StepTimeline from './workbench/StepTimeline.svelte';
  import { collapseSteps } from './workbench/step-timeline';

  /**
   * 页面搭建工作台(#65):对话轨 + 步骤时间线 + 页面视图。
   *
   * - 对话消费 POST /api/agent/stream 的 AgentRunStreamEvent 序列,按步骤
   *   展开时间线;运行可取消(POST /api/agent/runs/{runId}/cancel)。
   * - 页面视图把 outcome 帧带回的已校验页面文档直接交给统一运行时的
   *   RuntimeView 渲染,数据经 createPlatformDataGateway() 走服务端取数
   *   入口——不再有 iframe,也不依赖已保存修订(ADR-0030:临时页面态)。
   * - 渲染入口只接受文档对象,不写入页面生命周期;保存修订仍是用户显式
   *   动作,且只对非临时页面 id 开放(临时 id 不承载修订归属)。
   * - 临时页面态经沉淀面板(#68)显式转为长期资产:纯函数改写换上经确认
   *   的正式页面 id 后走同一保存修订通道,问数与探索不自动触发。
   */

  interface SaveRevisionResponse {
    ok?: boolean;
    revision?: {
      revisionId: string;
      revisionNumber: number;
      dataContextVersion: string | null;
    };
    error?: { code?: string; message?: string };
  }

  let composerText = $state('');
  /** 分析会话 id(ADR-0030):首次提问生成并写入 URL,刷新后按它回放步骤。 */
  let sessionId = $state<string | null>(null);
  /** 新建会话后使已在途中的旧会话回放结果失效。 */
  let sessionGeneration = 0;
  /** 最新会话检查点版本;本地编辑以它做乐观并发控制。 */
  let checkpointVersion = $state(0);
  let runs = $state<WorkbenchRunView[]>([]);
  let conversationBaseline = $state<AgentMessage[]>([]);
  let confirmedPageIds = $state<string[]>([]);
  let pins = $state<PinnedComponentChoice[]>([]);
  /** 创作态原子双投影：画布可含空分区，正式消费者始终读取有效投影。 */
  let currentDraft = $state<CanvasAuthoringDraft | null>(null);
  let baseRevisionId = $state<string | null>(null);
  let savePending = $state(false);
  let saveNotice = $state('');
  let saveError = $state('');
  let cancelRequested = $state(false);
  let promoteOpen = $state(false);
  let metadataOpen = $state(false);
  let metadataEntryEl: HTMLButtonElement | null = $state(null);
  let threadEl: HTMLElement | null = $state(null);
  let composerEl: HTMLTextAreaElement | null = $state(null);
  /** 画布选中的组件(检查器联动;文档改写后按组件 id 保持)。 */
  let selectedComponent = $state<ComponentLocator | null>(null);
  /** 本地文档改写失败的提示(改写出口过 validate,失败不落文档)。 */
  let editError = $state('');
  /** 消歧候选选择(runId → 用户选中的候选),随取数核对确认传回编排。 */
  let candidateChoices = $state<Record<string, MetricCandidate>>({});
  /** 执行过程展开状态(runId → 是否展开);缺省运行中展开、结束后收起。 */
  let stepsOpen = $state<Record<string, boolean>>({});
  let checkpointSaveTimer: ReturnType<typeof setTimeout> | null = null;
  let checkpointSavePromise: Promise<void> | null = null;
  let pendingCheckpointSave:
    | {
        sessionId: string;
        document: Record<string, unknown>;
        pinnedComponents: PinnedComponentChoice[];
      }
    | null = null;

  const dataGateway = createPlatformDataGateway();

  const currentDocument = $derived(currentDraft?.pageDocument ?? null);
  const canvasDocument = $derived(currentDraft?.canvasDocument ?? null);
  const activeRun = $derived(runs.at(-1) ?? null);
  const running = $derived(activeRun?.status === 'running');
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

  const STATUS_LABELS: Record<WorkbenchRunView['status'], string> = {
    running: '运行中',
    completed: '已完成',
    interaction_required: '等待确认',
    failed: '已失败',
    cancelled: '已取消'
  };

  function candidateSteps(run: WorkbenchRunView) {
    return run.steps.filter((step) => step.kind === 'candidates_retrieved');
  }

  /** 消歧待选:运行停在口径确认且编排未选中指标(候选歧义)。 */
  function disambiguationPending(run: WorkbenchRunView): boolean {
    if (run.pendingInteraction?.kind !== 'confirm_scope_card') return false;
    const last = candidateSteps(run).at(-1);
    return (
      last !== undefined &&
      last.kind === 'candidates_retrieved' &&
      last.selectedMetrics.length === 0 &&
      last.candidates.length > 1
    );
  }

  function stepsExpanded(run: WorkbenchRunView): boolean {
    return stepsOpen[run.runId] ?? run.status === 'running';
  }

  function toggleSteps(run: WorkbenchRunView) {
    stepsOpen = { ...stepsOpen, [run.runId]: !stepsExpanded(run) };
  }

  $effect(() => {
    void runs;
    if (threadEl) threadEl.scrollTo({ top: threadEl.scrollHeight, behavior: 'smooth' });
  });

  // 刷新后按会话 id 回放全部步骤(#69):URL 携带 session 参数时读取
  // 落库事件流物化时间线,最新检查点恢复临时页面态与续跑基线;
  // 他人会话按存储可见性过滤返回 404,
  // 静默跳过(不可见与不存在同响应,不提示存在性)。
  onMount(() => {
    const handlePageHide = () => void flushPendingCheckpointSave(true);
    window.addEventListener('pagehide', handlePageHide);
    const fromUrl = new URLSearchParams(window.location.search).get('session');
    if (fromUrl) {
      sessionId = fromUrl;
      void replayRecordedSession(fromUrl, sessionGeneration);
    }
    return () => window.removeEventListener('pagehide', handlePageHide);
  });

  async function replayRecordedSession(id: string, generation: number) {
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(id)}`);
      if (!response.ok) return;
      const payload = (await response.json()) as { session?: RecordedSessionPayload };
      if (!payload.session || payload.session.events.length === 0) return;
      if (generation !== sessionGeneration || sessionId !== id) return;
      const replay = sessionReplayView(payload.session);
      runs = [...runs, replay];
      conversationBaseline = replay.baselineMessages ?? [];
      const checkpoint = payload.session.checkpoint ?? null;
      checkpointVersion = checkpoint?.version ?? 0;
      pins = checkpoint?.pinnedComponents ?? [];
      if (checkpoint?.document) replaceCurrentDocument(checkpoint.document);
    } catch {
      // 回放不可用(如会话过保留期)不阻塞新提问。
    }
  }

  async function ask(event: SubmitEvent) {
    event.preventDefault();
    if (!canSubmitComposer(composerText, running)) return;
    const question = composerText.trim();
    composerText = '';
    resetComposerHeight();
    await startRun(question);
  }

  async function askSuggestion(question: string) {
    if (running) return;
    await startRun(question);
  }

  /** Enter 直接发送,Shift+Enter 换行;输入法组词中(isComposing)不触发。 */
  function composerKeydown(event: KeyboardEvent) {
    if (!shouldSubmitComposerKeydown(event)) return;
    event.preventDefault();
    (event.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
  }

  /** 输入框随内容自动增高到 4 行，第 5 行起只在输入框内部滚动。 */
  function autoGrowComposer() {
    if (!composerEl) return;
    composerEl.style.height = 'auto';
    const maxHeight = 74;
    composerEl.style.height = `${Math.min(composerEl.scrollHeight, maxHeight)}px`;
    composerEl.style.overflowY = composerEl.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }

  function resetComposerHeight() {
    if (!composerEl) return;
    composerEl.style.height = 'auto';
    composerEl.style.overflowY = 'hidden';
  }

  /** 新建会话只清理本地工作台态，不写页面修订，也不改变接口契约。 */
  function startNewSession() {
    if (running || savePending) return;
    sessionGeneration += 1;
    cancelPendingCheckpointSave();
    sessionId = null;
    checkpointVersion = 0;
    runs = [];
    conversationBaseline = [];
    confirmedPageIds = [];
    pins = [];
    currentDraft = null;
    baseRevisionId = null;
    saveNotice = '';
    saveError = '';
    editError = '';
    cancelRequested = false;
    promoteOpen = false;
    metadataOpen = false;
    selectedComponent = null;
    candidateChoices = {};
    stepsOpen = {};
    composerText = '';
    resetComposerHeight();

    const url = new URL(window.location.href);
    url.searchParams.delete('session');
    replaceState(`${url.pathname}${url.search}${url.hash}`, {});
  }

  /**
   * 发起一次流式运行。question 为 null 表示续跑(交互确认 / 重试失败
   * 步骤):以上一轮 outcome.messages 为基线携带新的 runId 再次 POST。
   */
  async function startRun(
    question: string | null,
    scopeConfirmations?: readonly ScopeCardConfirmationChoice[]
  ) {
    if (running) return;
    // 先落下本地有效编辑,再让 Agent 以同一份 draft 续跑;避免
    // 尚在防抖窗口的旧乐观写与运行终态竞态。
    await flushPendingCheckpointSave();
    saveNotice = '';
    saveError = '';
    cancelRequested = false;
    if (question !== null) {
      conversationBaseline = [
        ...conversationBaseline,
        { role: 'user', content: question }
      ];
    }
    if (sessionId === null) {
      // 首次运行开启分析会话:步骤事件按 ADR-0030 落库,URL 反映会话 id
      // 使刷新后可回放;不产生新的历史条目。
      sessionId = crypto.randomUUID();
      replaceState(`?session=${sessionId}`, {});
    }
    const runId = crypto.randomUUID();
    let view = createRunView({ runId, question });
    runs = [...runs, view];
    const commit = (next: WorkbenchRunView) => {
      view = next;
      runs = runs.map((run) => (run.runId === runId ? next : run));
    };

    try {
      const frames = openAgentRunStream({
        body: buildAgentStreamRequestBody({
          runId,
          ...(sessionId === null ? {} : { sessionId }),
          messages: conversationBaseline,
          confirmedPageIds,
          ...(scopeConfirmations !== undefined && scopeConfirmations.length > 0
            ? { scopeConfirmations }
            : {}),
          draft: currentDocument,
          pinnedComponents: pins,
          ...(selectedComponent === null ? {} : { target: selectedComponent })
        })
      });
      for await (const frame of frames) {
        if (frame.kind === 'event') {
          commit(applyStreamEvent(view, frame.event));
        } else {
          commit(applyOutcome(view, frame.outcome));
          conversationBaseline = frame.outcome.messages;
          if (frame.outcome.checkpointVersion !== null) {
            checkpointVersion = Math.max(
              checkpointVersion,
              frame.outcome.checkpointVersion
            );
          }
          if (frame.outcome.document) {
            replaceCurrentDocument(frame.outcome.document);
          } else if (
            parseAskConversation(frame.outcome.messages).state.transientPageId === null
          ) {
            currentDraft = null;
            selectedComponent = null;
          }
        }
      }
      if (view.status === 'running') {
        commit(applyTransportFailure(view, '推送流在运行结束前关闭'));
      }
    } catch (cause) {
      commit(
        applyTransportFailure(
          view,
          cause instanceof Error ? cause.message : String(cause)
        )
      );
    }
  }

  async function cancelActiveRun() {
    if (!activeRun || activeRun.status !== 'running' || cancelRequested) return;
    cancelRequested = true;
    try {
      await fetch(`/api/agent/runs/${encodeURIComponent(activeRun.runId)}/cancel`, {
        method: 'POST'
      });
    } catch {
      // 取消端点不可达时推送流仍会按断开语义收尾。
      cancelRequested = false;
    }
  }

  async function confirmInteraction(run: WorkbenchRunView) {
    const interaction = run.pendingInteraction;
    if (!interaction || running) return;
    if (interaction.kind === 'confirm_page_id') {
      const pageId = String(interaction.payload.pageId ?? '');
      if (pageId) confirmedPageIds = [...new Set([...confirmedPageIds, pageId])];
    }
    if (interaction.kind === 'confirm_scope_card') {
      // 取数核对确认(#66 契约):歧义候选须携带用户在候选卡上的结构化选择,
      // 空白确认会被编排安全地重新阻塞。
      const choice = candidateChoices[run.runId];
      if (disambiguationPending(run) && !choice) return;
      await startRun(null, [
        {
          interactionId: interaction.id,
          ...(choice
            ? {
                selectedMetric: {
                  businessDomain: choice.businessDomain,
                  metricName: choice.metricName
                }
              }
            : {})
        }
      ]);
      return;
    }
    await startRun(null);
  }

  async function saveRevision() {
    if (!currentDocument || !pageModel || pageModel.transient || savePending) return;
    savePending = true;
    saveError = '';
    try {
      const response = await fetch(
        `/api/pages/${encodeURIComponent(pageModel.pageId)}/revisions`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            baseRevisionId,
            document: currentDocument,
            idempotencyKey: crypto.randomUUID()
          })
        }
      );
      const payload = (await response.json()) as SaveRevisionResponse;
      if (!response.ok || !payload.ok || !payload.revision) {
        throw new Error(payload.error?.message ?? `保存失败:${response.status}`);
      }
      baseRevisionId = payload.revision.revisionId;
      saveNotice =
        `已保存修订 R${payload.revision.revisionNumber}，数据上下文版本：` +
        `${payload.revision.dataContextVersion ?? '仅内联页面'}`;
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
      scheduleCheckpointSave(result.draft.pageDocument);
    } else {
      editError = result.message;
    }
  }

  /** 本地编辑只更新会话检查点,绝不产生页面修订。 */
  function scheduleCheckpointSave(document: Record<string, unknown>) {
    if (
      sessionId === null ||
      checkpointVersion < 1 ||
      !workbenchPageViewModel(document).transient
    ) {
      return;
    }
    pendingCheckpointSave = {
      sessionId,
      document: structuredClone(document),
      pinnedComponents: pins.map((pin) => ({ ...pin }))
    };
    if (checkpointSaveTimer !== null) clearTimeout(checkpointSaveTimer);
    checkpointSaveTimer = setTimeout(() => {
      checkpointSaveTimer = null;
      void flushPendingCheckpointSave();
    }, 600);
  }

  async function flushPendingCheckpointSave(useKeepalive = false): Promise<void> {
    if (checkpointSaveTimer !== null) {
      clearTimeout(checkpointSaveTimer);
      checkpointSaveTimer = null;
    }
    if (checkpointSavePromise !== null) {
      await checkpointSavePromise;
      if (pendingCheckpointSave !== null) await flushPendingCheckpointSave(useKeepalive);
      return;
    }
    const pending = pendingCheckpointSave;
    pendingCheckpointSave = null;
    if (
      pending === null ||
      pending.sessionId !== sessionId ||
      checkpointVersion < 1
    ) {
      return;
    }
    const expectedVersion = checkpointVersion;
    const requestBody = JSON.stringify({
      expectedVersion,
      document: pending.document,
      pinnedComponents: pending.pinnedComponents
    });
    checkpointSavePromise = (async () => {
      try {
        const response = await fetch(
          `/api/sessions/${encodeURIComponent(pending.sessionId)}/checkpoint`,
          {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            // Fetch keepalive 有约 64 KiB 的请求体上限;大页面在正常
            // 编辑时仍能保存,只对卸载时的小请求启用它。
            keepalive: useKeepalive && new Blob([requestBody]).size <= 60_000,
            body: requestBody
          }
        );
        const payload = (await response.json()) as {
          checkpoint?: { version?: number };
          error?: { code?: string; message?: string; currentCheckpointVersion?: number };
        };
        if (!response.ok || typeof payload.checkpoint?.version !== 'number') {
          if (response.status === 409) {
            editError =
              '这个会话已在另一个标签页中更新;当前改动未覆盖对方,请刷新后再编辑。';
            return;
          }
          throw new Error(payload.error?.message ?? `临时页面态保存失败:${response.status}`);
        }
        if (pending.sessionId === sessionId) {
          checkpointVersion = Math.max(checkpointVersion, payload.checkpoint.version);
        }
      } catch (cause) {
        // 不阻断当前编辑;文档仍在浏览器内,下一次编辑或运行可重试。
        editError = cause instanceof Error ? cause.message : String(cause);
      }
    })();
    try {
      await checkpointSavePromise;
    } finally {
      checkpointSavePromise = null;
    }
    if (pendingCheckpointSave !== null) await flushPendingCheckpointSave(useKeepalive);
  }

  function cancelPendingCheckpointSave() {
    if (checkpointSaveTimer !== null) clearTimeout(checkpointSaveTimer);
    checkpointSaveTimer = null;
    pendingCheckpointSave = null;
  }

  /** 画布创作意图分发:选中进检查器,重排与标题/宽度编辑走本地文档改写。 */
  function handleAuthoringIntent(intent: AuthoringIntent) {
    if (running) return;
    if (intent.type === 'select_component') {
      selectedComponent = intent.locator;
      return;
    }
    if (!currentDraft) return;
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

  /** 组件形态切换:装配唯一实现重建组件,即时生效并钉住(追问不被改写)。 */
  function selectComponentType(type: string) {
    if (running || !currentDraft || !selectedComponent || !selectedView?.dataSourceId) return;
    const result = changeComponentType(
      currentDraft,
      selectedComponent,
      type as Parameters<typeof changeComponentType>[2]
    );
    if (result.ok) {
      pins = pinComponent(pins, {
        dataSourceId: selectedView.dataSourceId,
        componentType: type
      });
    }
    applyDocumentEdit(result);
  }

  function selectComponentFromList(componentId: string) {
    if (!canvasDocument) return;
    selectedComponent = locatorOfComponent(canvasDocument, componentId);
  }

  /** 沉淀完成:文档换上正式页面 id,后续保存以首个修订为基线走既有通道。 */
  function handlePromoted(outcome: PromotedOutcome) {
    promoteOpen = false;
    if (!replaceCurrentDocument(outcome.document)) return;
    baseRevisionId = outcome.revisionId;
    confirmedPageIds = [...new Set([...confirmedPageIds, outcome.pageId])];
    saveNotice =
      `已沉淀为${outcome.direction === 'dataApp' ? ' Data App' : '报告'}:` +
      `页面 ${outcome.pageId} 修订 R${outcome.revisionNumber},数据上下文版本:` +
      `${outcome.dataContextVersion ?? '仅内联页面'}`;
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
      {#if activeRun}
        <span class="stat status-{activeRun.status}">
          {STATUS_LABELS[activeRun.status]}
        </span>
      {/if}
      {#if running}
        <button type="button" class="btn danger" onclick={cancelActiveRun}>
          {cancelRequested ? '取消中…' : '取消运行'}
        </button>
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
      {#if pageModel && pageModel.transient}
        <button
          type="button"
          class="btn"
          disabled={running}
          onclick={() => (promoteOpen = true)}
        >
          沉淀为长期资产…
        </button>
      {/if}
      {#if pageModel && !pageModel.transient}
        <button type="button" class="btn" disabled={savePending || running} onclick={saveRevision}>
          {savePending ? '保存中…' : baseRevisionId ? '保存新修订' : '保存首个修订'}
        </button>
      {/if}
    </div>
  </div>

  <aside
    class="chat"
    aria-label="分析会话"
    data-testid="workbench-track"
    data-contract-critical
  >
    <header class="chat-header">
      <h1 data-testid="session-title" data-contract-session-part>分析与搭建</h1>
      <button
        type="button"
        class="new-session"
        aria-label="新建会话"
        title="新建会话"
        data-icon="plus"
        data-testid="new-session"
        data-contract-session-part
        disabled={running || savePending}
        onclick={startNewSession}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 3v10M3 8h10" />
        </svg>
      </button>
    </header>

    <div class="thread" bind:this={threadEl} data-testid="analysis-thread">
      {#if runs.length === 0}
        <div class="thread-empty">
          <h2>用一句业务问题开始</h2>
          <p>
            系统按步骤展开:业务域路由、指标候选、取数核对、真实执行、
            页面文档就绪;满意的结果可沉淀为长期资产。
          </p>
          <div class="suggestions">
            {#each SUGGESTED_QUESTIONS as suggestion (suggestion.question)}
              <button
                type="button"
                title={suggestion.question}
                onclick={() => askSuggestion(suggestion.question)}
              >
                {suggestion.label ?? suggestion.question}
              </button>
            {/each}
          </div>
        </div>
      {/if}
      {#each runs as run (run.runId)}
        {@const isLast = run === activeRun}
        {#if run.question !== null}
          <div class="ask-bubble" in:fly={{ y: 10, duration: 240 }}>{run.question}</div>
        {:else}
          <div class="continuation" in:fade={{ duration: 180 }}>确认后继续运行</div>
        {/if}

        <div class="reply">
          <!--
            执行过程紧贴在提问之后:AI 聊天的通行范式是「过程在上、答案在下」,
            运行中自动展开供人看着推进,结束后自动收起把版面还给答案
            (stepsExpanded 的缺省即此)。过程排在答案之后会让人先读到结论、
            再回头找它是怎么来的,顺序与阅读顺序相反。
          -->
          {#if run.steps.length > 0}
            <div class="timeline">
              <button type="button" class="linkish" onclick={() => toggleSteps(run)}>
                {stepsExpanded(run) ? '收起' : '展开'}执行过程({collapseSteps(run.steps).length} 步)
              </button>
              {#if stepsExpanded(run)}
                <div class="steps-wrap" in:fade={{ duration: 160 }}>
                  <StepTimeline steps={run.steps} />
                </div>
              {/if}
            </div>
          {/if}

          {#each candidateSteps(run) as candidateStep, candidateIndex (candidateIndex)}
            {#if candidateStep.kind === 'candidates_retrieved' && candidateStep.candidates.length > 0}
              {@const selectable =
                isLast &&
                run.status === 'interaction_required' &&
                disambiguationPending(run) &&
                candidateIndex === candidateSteps(run).length - 1}
              <div in:fly={{ y: 8, duration: 240 }}>
                <CandidatesCard
                  candidates={candidateStep.candidates}
                  selectedMetrics={candidateStep.selectedMetrics}
                  {selectable}
                  chosen={candidateChoices[run.runId] ?? null}
                  onselect={(candidate) =>
                    (candidateChoices = { ...candidateChoices, [run.runId]: candidate })}
                />
              </div>
            {/if}
          {/each}

          {#each run.replies as reply, replyIndex (replyIndex)}
            <p class="reply-text" in:fly={{ y: 8, duration: 260 }}>{reply}</p>
          {/each}

          {#each scopeCards(run) as card, cardIndex (cardIndex)}
            <ScopeCard
              {card}
              confirmDisabled={disambiguationPending(run) && !candidateChoices[run.runId]}
              onconfirm={card.awaitingConfirmation &&
              isLast &&
              run.status === 'interaction_required'
                ? () => confirmInteraction(run)
                : undefined}
            />
          {/each}

          {#if run.status === 'running'}
            <p class="run-state running-state" in:fade={{ duration: 180 }}>
              <span class="dots" role="status" aria-label="运行中"><i></i><i></i><i></i></span>
            </p>
          {:else if run.status === 'interaction_required' && run.pendingInteraction && isLast && !awaitingScopeConfirmation(run)}
            <InteractionCard
              interaction={run.pendingInteraction}
              confirming={running}
              onconfirm={() => confirmInteraction(run)}
            />
          {:else if run.status === 'failed' && run.failure}
            <div class="failure" role="alert" in:fly={{ y: 6, duration: 220 }}>
              <p>
                <code>{run.failure.code}</code>
                {run.failure.message}
                {#if run.failure.stage}
                  <span class="stage">阶段:{run.failure.stage}</span>
                {/if}
              </p>
              {#if run.failure.retryable && isLast}
                <button type="button" class="linkish" onclick={() => startRun(null)}>
                  重试失败步骤
                </button>
              {/if}
            </div>
          {:else if run.status === 'cancelled'}
            <p class="run-state">运行已取消;会话状态保留,可继续追问或重试。</p>
          {/if}
        </div>
      {/each}
    </div>

    <form class="composer" onsubmit={ask}>
      <div
        class="page-context"
        aria-label="当前页面"
        data-contract-session-part
        data-contract-critical
      >
        <span>当前页面</span>
        <strong>{pageModel?.pageId ?? '待生成'}</strong>
      </div>
      {#if selectedView}
        <div class="context-chip" in:fade={{ duration: 140 }}>
          <span>针对:{selectedView.title ?? selectedView.componentLabel}</span>
          <button
            type="button"
            aria-label="取消组件上下文"
            onclick={() => (selectedComponent = null)}
          >×</button>
        </div>
      {/if}
      <div class="composer-box" data-testid="composer-box">
        <textarea
          rows="1"
          bind:this={composerEl}
          bind:value={composerText}
          onkeydown={composerKeydown}
          oninput={autoGrowComposer}
          aria-label="AI 输入"
          data-testid="ai-composer-input"
          data-contract-session-part
          placeholder="描述业务问题,或追问:换维度、改筛选、调整展示"
        ></textarea>
        {#if running}
          <button
            type="button"
            class="action stop"
            onclick={cancelActiveRun}
            title={cancelRequested ? '取消请求已发出' : '停止运行'}
            aria-label="停止运行"
            data-contract-session-part
            data-contract-critical
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="4" width="8" height="8" rx="1.5" /></svg>
          </button>
        {:else}
          <button
            type="submit"
            class="action send"
            disabled={!canSubmitComposer(composerText, running)}
            title="发送(Enter)"
            aria-label="发送"
            data-icon="arrow-up"
            data-testid="composer-send"
            data-contract-session-part
            data-contract-critical
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 13V3.5M8 3.5L3.5 8M8 3.5L12.5 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        {/if}
      </div>
      <p class="composer-hint" data-testid="composer-hint">Enter 发送 · Shift+Enter 换行</p>
    </form>
  </aside>

  <main class="canvas" aria-label="页面画布" data-testid="workbench-track">
    {#if saveNotice}<p class="notice">{saveNotice}</p>{/if}
    {#if saveError}<p class="error" role="alert">{saveError}</p>{/if}
    {#if editError}<p class="error" role="alert">{editError}</p>{/if}

    <div class="page-scroll">
      {#if currentDocument}
        <RuntimeView
          document={currentDocument}
          {dataGateway}
          authoring={running
            ? undefined
            : {
                ...(selectedComponent === null ? {} : { selected: selectedComponent }),
                ...(currentDraft === null
                  ? {}
                  : { draftSections: currentDraft.authoringSections }),
                inlineControls: false,
                onintent: handleAuthoringIntent
              }}
        />
      {:else if running}
        <div class="skeleton" aria-label="页面文档生成中">
          <div class="skeleton-grid">
            <i style="grid-column: span 4"></i>
            <i style="grid-column: span 4"></i>
            <i style="grid-column: span 4"></i>
            <i class="tall" style="grid-column: span 8"></i>
            <i class="tall" style="grid-column: span 4"></i>
            <i class="tall" style="grid-column: span 12"></i>
          </div>
        </div>
      {:else}
        <div class="empty">
          <h2>描述你要解决的业务问题</h2>
          <p>
            页面文档通过校验后在这里直接渲染——无需保存任何修订,
            数据经服务端取数入口返回。
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
      busy={running}
      onSelectType={selectComponentType}
      onSelectComponent={selectComponentFromList}
      onEdit={(edit) => {
        if (!running && currentDraft && selectedComponent) {
          applyDocumentEdit(editComponent(currentDraft, selectedComponent, edit));
        }
      }}
    />
  </aside>

  {#if promoteOpen && currentDocument && pageModel?.transient}
    <PromotePanel
      document={currentDocument}
      formulaTraces={askFormulaTraces(conversationBaseline)}
      onclose={() => (promoteOpen = false)}
      onpromoted={handlePromoted}
    />
  {/if}

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
    height: calc(100vh - var(--topbar-h));
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
  .new-session {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    padding: 0;
    color: var(--muted);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
  }
  .new-session:hover:not(:disabled) {
    color: var(--accent-strong);
    background: var(--surface-subtle);
    border-color: var(--control-line);
  }
  .new-session:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .new-session:disabled {
    opacity: 0.38;
    cursor: not-allowed;
  }
  .new-session svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
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
    margin-top: 12vh;
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
  .suggestions {
    display: grid;
    gap: 5px;
    margin-top: 7px;
  }
  .suggestions button {
    padding: 7px 9px;
    color: var(--text);
    background: var(--surface-subtle);
    border: 1px solid var(--line);
    border-radius: 7px;
    font: inherit;
    font-size: 10.5px;
    line-height: 1.45;
    text-align: left;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }
  .suggestions button:hover {
    color: var(--accent-strong);
    background: var(--accent-soft);
    border-color: var(--accent);
  }
  .suggestions button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .ask-bubble {
    align-self: flex-end;
    max-width: 88%;
    padding: 7px 10px;
    color: var(--accent-strong);
    background: var(--accent-soft);
    border: 1px solid var(--line);
    border-radius: 9px 9px 3px 9px;
    font-size: 11.5px;
    line-height: 1.5;
  }
  .continuation {
    align-self: flex-end;
    color: var(--muted);
    font-size: 10px;
  }
  .reply {
    display: grid;
    gap: 10px;
  }
  .reply-text {
    margin: 0;
    color: var(--text);
    font-size: 11.5px;
    line-height: 1.6;
    white-space: pre-wrap;
  }
  /* 执行过程:linkish 切换 + 展开区虚线分隔(原型 v2)。 */
  .timeline {
    display: grid;
    justify-items: start;
  }
  .steps-wrap {
    width: 100%;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px dashed var(--line);
  }
  .run-state {
    margin: 0;
    color: var(--muted);
    font-size: 11px;
  }
  .running-state {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .dots {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .dots i {
    width: 5px;
    height: 5px;
    background: var(--accent);
    border-radius: 50%;
    animation: dot-bounce 1.2s ease-in-out infinite;
  }
  .dots i:nth-child(2) {
    animation-delay: 0.15s;
  }
  .dots i:nth-child(3) {
    animation-delay: 0.3s;
  }
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
  .failure {
    padding: 10px 12px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 10px;
    font-size: 12.5px;
  }
  .failure p {
    margin: 0;
  }
  .failure code {
    color: #b91c1c;
    font-weight: 700;
    font-size: 11.5px;
  }
  .failure .stage {
    margin-left: 8px;
    color: #71717a;
    font-size: 11px;
  }
  .composer {
    display: grid;
    gap: 5px;
    padding: 8px 10px 9px;
    background: var(--surface);
    border-top: 1px solid var(--line);
  }
  .page-context {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    color: var(--muted);
    font-size: 9.5px;
    line-height: 1.3;
  }
  .page-context::before {
    content: '';
    flex: none;
    width: 5px;
    height: 5px;
    background: var(--accent);
    border-radius: 50%;
  }
  .page-context strong {
    min-width: 0;
    overflow: hidden;
    color: var(--text);
    font-size: inherit;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
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
  .composer .action svg {
    width: 14px;
    height: 14px;
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
  .composer .stop {
    color: var(--text-on-strong);
    background: var(--down);
  }
  .composer .stop svg rect {
    fill: currentColor;
  }
  .composer .stop:hover {
    background: var(--down-strong);
  }
  .composer-hint {
    margin: 0;
    padding-left: 1px;
    color: var(--faint);
    font-size: 9px;
  }
  /* 选中组件的 AI 交互上下文:追问以它为默认修改目标。 */
  .context-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    justify-self: start;
    padding: 2px 5px 2px 7px;
    color: var(--accent-strong);
    background: var(--accent-soft);
    border: 1px solid var(--line);
    border-radius: 6px;
    font-size: 9.5px;
    font-weight: 600;
  }
  .context-chip button {
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    padding: 0;
    color: var(--accent-strong);
    background: none;
    border: 0;
    border-radius: 999px;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .context-chip button:hover {
    background: var(--surface);
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
  .status-running {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #4f46e5;
    font-weight: 650;
  }
  .status-running::before {
    content: '';
    width: 7px;
    height: 7px;
    background: #4f46e5;
    border-radius: 50%;
    animation: pulse 1.4s ease-in-out infinite;
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
  .status-failed {
    color: #b91c1c;
    font-weight: 650;
  }
  .status-interaction_required {
    color: #92400e;
    font-weight: 650;
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
  .btn.danger {
    color: #b91c1c;
    border-color: #fecaca;
  }
  .btn.danger:hover:not(:disabled) {
    background: #fef2f2;
    border-color: #fca5a5;
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
  .skeleton {
    padding: 20px;
  }
  .skeleton-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 14px;
  }
  .skeleton-grid i {
    height: 96px;
    background: linear-gradient(100deg, #ececee 40%, #f6f6f7 50%, #ececee 60%);
    background-size: 200% 100%;
    border-radius: 12px;
    animation: shimmer 1.6s ease-in-out infinite;
  }
  .skeleton-grid i.tall {
    height: 220px;
  }
  @keyframes shimmer {
    to {
      background-position: -200% 0;
    }
  }
  .empty {
    display: grid;
    place-content: center;
    min-height: 60vh;
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
  @media (max-width: 1100px) {
    .docbar .stat,
    .page-id {
      display: none;
    }
  }
  @media (max-width: 760px) {
    .workbench {
      --analysis-rail-w: 250px;
      grid-template-columns: var(--analysis-rail-w) minmax(0, 1fr);
    }
    .inspector-track {
      display: none;
    }
  }
</style>
