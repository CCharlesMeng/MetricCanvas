<script lang="ts">
  import { onMount } from 'svelte';
  import { replaceState } from '$app/navigation';
  import { fade, fly } from 'svelte/transition';
  import { RuntimeView } from '@metriccanvas/runtime-ui';
  import type { AgentMessage } from './server/agent/types';
  import { createPlatformDataGateway } from './platform-data-gateway';
  import type { MetricCandidate } from './server/session/step-event';
  import {
    buildAgentStreamRequestBody,
    pinComponent,
    unpinComponent,
    type PinnedComponentChoice,
    type ScopeCardConfirmationChoice
  } from './workbench/agent-request';
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
  import { askFormulaTraces, type PromotedOutcome } from './workbench/promote-flow';
  import { workbenchPageViewModel } from './workbench/transient-page';
  import CandidatesCard from './workbench/CandidatesCard.svelte';
  import ComponentPinStrip from './workbench/ComponentPinStrip.svelte';
  import InteractionCard from './workbench/InteractionCard.svelte';
  import PromotePanel from './workbench/PromotePanel.svelte';
  import ScopeCard from './workbench/ScopeCard.svelte';
  import StepTimeline from './workbench/StepTimeline.svelte';

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
  // 建议问题:全部命中语义面且带具体年月(结构化相对时间不在 V0 范围,
  // 「上个月」这类表述会在执行段被仿真如实拒答),覆盖两域与多种展示。
  const SUGGESTED_QUESTIONS = [
    '2026年7月各区域的Tokens消耗量是多少？',
    '2026年上半年每个月的新增客户数走势如何？',
    '2026年6月各客户级别的流失客户数对比'
  ];
  /** 分析会话 id(ADR-0030):首次提问生成并写入 URL,刷新后按它回放步骤。 */
  let sessionId = $state<string | null>(null);
  let runs = $state<WorkbenchRunView[]>([]);
  let conversationBaseline = $state<AgentMessage[]>([]);
  let confirmedPageIds = $state<string[]>([]);
  let pins = $state<PinnedComponentChoice[]>([]);
  let currentDocument = $state<Record<string, unknown> | null>(null);
  let baseRevisionId = $state<string | null>(null);
  let savePending = $state(false);
  let saveNotice = $state('');
  let saveError = $state('');
  let cancelRequested = $state(false);
  let promoteOpen = $state(false);
  let threadEl: HTMLElement | null = $state(null);
  let composerEl: HTMLTextAreaElement | null = $state(null);
  /** 消歧候选选择(runId → 用户选中的候选),随口径卡确认传回编排。 */
  let candidateChoices = $state<Record<string, MetricCandidate>>({});
  /** 执行过程展开状态(runId → 是否展开);缺省运行中展开、结束后收起。 */
  let stepsOpen = $state<Record<string, boolean>>({});

  const dataGateway = createPlatformDataGateway();

  const activeRun = $derived(runs.at(-1) ?? null);
  const running = $derived(activeRun?.status === 'running');
  const pageModel = $derived(
    currentDocument ? workbenchPageViewModel(currentDocument) : null
  );

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
      last.selectedMetric === null &&
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
  // 落库事件流并物化为只读时间线;他人会话按存储可见性过滤返回 404,
  // 静默跳过(不可见与不存在同响应,不提示存在性)。
  onMount(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('session');
    if (!fromUrl) return;
    sessionId = fromUrl;
    void replayRecordedSession(fromUrl);
  });

  async function replayRecordedSession(id: string) {
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(id)}`);
      if (!response.ok) return;
      const payload = (await response.json()) as { session?: RecordedSessionPayload };
      if (!payload.session || payload.session.events.length === 0) return;
      runs = [...runs, sessionReplayView(payload.session)];
    } catch {
      // 回放不可用(如会话过保留期)不阻塞新提问。
    }
  }

  async function ask(event: SubmitEvent) {
    event.preventDefault();
    const question = composerText.trim();
    if (!question || running) return;
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
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    (event.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
  }

  /** 输入框随内容自动增高(1~6 行),业界聊天输入框通例。 */
  function autoGrowComposer() {
    if (!composerEl) return;
    composerEl.style.height = 'auto';
    composerEl.style.height = `${Math.min(composerEl.scrollHeight, 152)}px`;
  }

  function resetComposerHeight() {
    if (composerEl) composerEl.style.height = 'auto';
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
          pinnedComponents: pins
        })
      });
      for await (const frame of frames) {
        if (frame.kind === 'event') {
          commit(applyStreamEvent(view, frame.event));
        } else {
          commit(applyOutcome(view, frame.outcome));
          conversationBaseline = frame.outcome.messages;
          if (frame.outcome.document) currentDocument = frame.outcome.document;
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
      // 口径卡确认(#66 契约):歧义候选须携带用户在候选卡上的结构化选择,
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
        `${payload.revision.dataContextVersion ?? '纯静态页面'}`;
    } catch (cause) {
      saveError = cause instanceof Error ? cause.message : String(cause);
    } finally {
      savePending = false;
    }
  }

  /** 沉淀完成:文档换上正式页面 id,后续保存以首个修订为基线走既有通道。 */
  function handlePromoted(outcome: PromotedOutcome) {
    promoteOpen = false;
    currentDocument = outcome.document;
    baseRevisionId = outcome.revisionId;
    confirmedPageIds = [...new Set([...confirmedPageIds, outcome.pageId])];
    saveNotice =
      `已沉淀为${outcome.direction === 'dataApp' ? ' Data App' : '报告'}:` +
      `页面 ${outcome.pageId} 修订 R${outcome.revisionNumber},数据上下文版本:` +
      `${outcome.dataContextVersion ?? '纯静态页面'}`;
  }
</script>

<svelte:head>
  <title>MetricCanvas 页面搭建工作台</title>
</svelte:head>

<div class="workbench">
  <aside class="chat">
    <header>
      <div>
        <p class="eyebrow">分析会话</p>
        <h1>页面搭建工作台</h1>
      </div>
      {#if runs.length > 0}
        <span class="chip">{runs.filter((run) => run.question !== null).length} 轮</span>
      {/if}
    </header>

    <div class="thread" bind:this={threadEl}>
      {#if runs.length === 0}
        <div class="thread-empty">
          <h2>用一句业务问题开始</h2>
          <p>
            系统按步骤展开:业务域路由、指标候选、口径卡、真实执行、
            页面文档就绪;满意的结果可沉淀为长期资产。
          </p>
          <div class="suggestions">
            {#each SUGGESTED_QUESTIONS as question (question)}
              <button type="button" onclick={() => askSuggestion(question)}>
                {question}
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
                  selectedMetric={candidateStep.selectedMetric}
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

          {#if run.steps.length > 0}
            <div class="timeline">
              <button type="button" class="linkish" onclick={() => toggleSteps(run)}>
                {stepsExpanded(run) ? '收起' : '展开'}执行过程({run.steps.length} 步)
              </button>
              {#if stepsExpanded(run)}
                <div class="steps-wrap" in:fade={{ duration: 160 }}>
                  <StepTimeline steps={run.steps} />
                </div>
              {/if}
            </div>
          {/if}

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
      <div class="composer-box">
        <textarea
          rows="1"
          bind:this={composerEl}
          bind:value={composerText}
          onkeydown={composerKeydown}
          oninput={autoGrowComposer}
          placeholder="描述业务问题,或追问:换维度、改筛选、调整展示"
        ></textarea>
        {#if running}
          <button
            type="button"
            class="action stop"
            onclick={cancelActiveRun}
            title={cancelRequested ? '取消请求已发出' : '停止运行'}
            aria-label="停止运行"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="4" width="8" height="8" rx="1.5" /></svg>
          </button>
        {:else}
          <button
            type="submit"
            class="action send"
            disabled={!composerText.trim()}
            title="发送(Enter)"
            aria-label="发送"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 13V3.5M8 3.5L3.5 8M8 3.5L12.5 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        {/if}
      </div>
      <p class="composer-hint">Enter 发送 · Shift+Enter 换行</p>
    </form>
  </aside>

  <main>
    <div class="docbar">
      <div class="l">
        {#if pageModel}
          <span class="badge" class:transient={pageModel.transient}>
            {pageModel.transient ? '临时页面态' : '未保存工作副本'}
          </span>
          {#if pageModel.adHocFormulas.length > 0}
            <!-- 临时口径与已定义指标视觉可区分(ADR-0036、#67):文档含现场
                 生成的 formula 口径时,结果区常驻警示徽标。 -->
            <span
              class="badge adhoc"
              title={pageModel.adHocFormulas.join(';')}
            >
              临时口径 ×{pageModel.adHocFormulas.length}
            </span>
          {/if}
          <code class="page-id">{pageModel.pageId}</code>
          <span class="stat">组件 {pageModel.components.length}</span>
          <span class="stat">页面数据源 {pageModel.dataSourceCount}</span>
        {:else}
          <span class="badge idle">尚无页面文档</span>
        {/if}
      </div>
      <div class="r">
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
    {#if saveNotice}<p class="notice">{saveNotice}</p>{/if}
    {#if saveError}<p class="error" role="alert">{saveError}</p>{/if}

    {#if pageModel}
      <ComponentPinStrip
        components={pageModel.components}
        {pins}
        disabled={running}
        onpin={(choice) => (pins = pinComponent(pins, choice))}
        onunpin={(dataSourceId) => (pins = unpinComponent(pins, dataSourceId))}
      />
    {/if}

    <div class="page-scroll">
      {#if currentDocument}
        <RuntimeView document={currentDocument} {dataGateway} />
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

  {#if promoteOpen && currentDocument && pageModel?.transient}
    <PromotePanel
      document={currentDocument}
      formulaTraces={askFormulaTraces(conversationBaseline)}
      onclose={() => (promoteOpen = false)}
      onpromoted={handlePromoted}
    />
  {/if}
</div>

<style>
  .workbench {
    display: grid;
    grid-template-columns: 330px minmax(0, 1fr);
    height: calc(100vh - 54px);
    background: #f4f4f5;
  }
  .chat {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    background: #fff;
    border-right: 1px solid #e4e4e7;
  }
  .chat > header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 16px 18px 12px;
    border-bottom: 1px solid #f4f4f5;
  }
  .eyebrow {
    margin: 0;
    color: #4f46e5;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  h1 {
    margin: 4px 0 0;
    font-size: 16px;
  }
  .chip {
    padding: 2px 8px;
    color: #52525b;
    background: #f4f4f5;
    border-radius: 999px;
    font-size: 11px;
  }
  .thread {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 14px;
    min-height: 0;
    padding: 16px 18px;
    overflow-y: auto;
  }
  .thread-empty {
    display: grid;
    gap: 8px;
    margin-top: 18vh;
    color: var(--muted);
    font-size: 12.5px;
    line-height: 1.7;
    text-align: center;
  }
  .thread-empty h2 {
    margin: 0;
    color: var(--text);
    font-size: 16px;
    letter-spacing: -0.01em;
  }
  .thread-empty p {
    margin: 0 auto;
    max-width: 26rem;
  }
  .suggestions {
    display: grid;
    gap: 8px;
    margin-top: 10px;
  }
  .suggestions button {
    padding: 10px 13px;
    color: #3f3f46;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 11px;
    font: inherit;
    font-size: 12.5px;
    text-align: left;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }
  .suggestions button:hover {
    border-color: rgb(79 70 229 / 45%);
    box-shadow: 0 2px 8px rgb(24 24 27 / 6%);
  }
  .ask-bubble {
    align-self: flex-end;
    max-width: 88%;
    padding: 8px 12px;
    color: #fff;
    background: #4f46e5;
    border-radius: 12px 12px 3px 12px;
    font-size: 13px;
    line-height: 1.6;
  }
  .continuation {
    align-self: flex-end;
    color: #a1a1aa;
    font-size: 11px;
  }
  .reply {
    display: grid;
    gap: 10px;
  }
  .reply-text {
    margin: 0;
    font-size: 13px;
    line-height: 1.7;
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
    border-top: 1px dashed #e4e4e7;
  }
  .run-state {
    margin: 0;
    color: #71717a;
    font-size: 12px;
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
    background: #6366f1;
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
    color: #6366f1;
    background: none;
    border: 0;
    font-size: 11.5px;
    cursor: pointer;
    transition: color 0.15s ease;
  }
  .linkish:hover {
    color: #4338ca;
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
    gap: 6px;
    padding: 10px 14px 12px;
    border-top: 1px solid var(--line-soft);
  }
  /* 业界聊天输入框通例:容器承载边框与焦点光圈,动作按钮内嵌右下角。 */
  .composer-box {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 8px 8px 8px 13px;
    background: var(--surface);
    border: 1px solid #d4d4d8;
    border-radius: 14px;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }
  .composer-box:focus-within {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgb(99 102 241 / 12%);
  }
  .composer-box textarea {
    flex: 1;
    min-width: 0;
    max-height: 152px;
    padding: 5px 0;
    border: 0;
    resize: none;
    background: none;
    font: inherit;
    font-size: 13px;
    line-height: 1.55;
  }
  .composer-box textarea:focus {
    outline: none;
  }
  .composer .action {
    display: grid;
    flex: none;
    place-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 0;
    border-radius: 999px;
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
    width: 16px;
    height: 16px;
  }
  .composer .send {
    color: #fff;
    background: var(--accent);
  }
  .composer .send:hover:not(:disabled) {
    background: var(--accent-strong);
  }
  .composer .send:disabled {
    background: #d4d4d8;
    cursor: not-allowed;
  }
  .composer .stop {
    color: #fff;
    background: #18181b;
  }
  .composer .stop svg rect {
    fill: currentColor;
  }
  .composer .stop:hover {
    background: #3f3f46;
  }
  .composer-hint {
    margin: 0;
    padding-left: 4px;
    color: var(--faint);
    font-size: 10.5px;
  }

  main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  .docbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 18px;
    background: #fff;
    border-bottom: 1px solid #e4e4e7;
  }
  .docbar .l,
  .docbar .r {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .badge {
    padding: 3px 9px;
    color: #3730a3;
    background: #eef2ff;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
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
    color: #3f3f46;
    font-size: 12.5px;
  }
  .stat {
    color: #71717a;
    font-size: 12px;
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
    padding: 7px 13px;
    background: #fff;
    border: 1px solid #d4d4d8;
    border-radius: 9px;
    font-size: 12.5px;
    font-weight: 600;
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
    padding: 8px 18px;
    color: #166534;
    background: #f0fdf4;
    border-bottom: 1px solid #dcfce7;
    font-size: 12px;
  }
  .error {
    margin: 0;
    padding: 8px 18px;
    color: #b91c1c;
    background: #fef2f2;
    border-bottom: 1px solid #fecaca;
    font-size: 12px;
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
  @media (max-width: 900px) {
    .workbench {
      grid-template-columns: 1fr;
      height: auto;
    }
    .chat {
      border-right: 0;
      border-bottom: 1px solid #e4e4e7;
    }
  }
</style>
