<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { RuntimeView } from '@metriccanvas/runtime-ui';
  import type { AgentMessage } from './server/agent/types';
  import { createPlatformDataGateway } from './platform-data-gateway';
  import {
    buildAgentStreamRequestBody,
    pinComponent,
    unpinComponent,
    type PinnedComponentChoice
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
  import { askFormulaTraces, type PromotedOutcome } from './workbench/promote-flow';
  import { workbenchPageViewModel } from './workbench/transient-page';
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

  let composerText = $state(
    '创建销售经营概览：展示成交总额、区域对比和成交趋势'
  );
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

  $effect(() => {
    void runs;
    if (threadEl) threadEl.scrollTo({ top: threadEl.scrollHeight, behavior: 'smooth' });
  });

  async function ask(event: SubmitEvent) {
    event.preventDefault();
    const question = composerText.trim();
    if (!question || running) return;
    composerText = '';
    await startRun(question);
  }

  /** Enter 直接发送,Shift+Enter 换行;输入法组词中(isComposing)不触发。 */
  function composerKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    (event.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
  }

  /**
   * 发起一次流式运行。question 为 null 表示续跑(交互确认 / 重试失败
   * 步骤):以上一轮 outcome.messages 为基线携带新的 runId 再次 POST。
   */
  async function startRun(question: string | null) {
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
          messages: conversationBaseline,
          confirmedPageIds,
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
          <p>用一句业务问题开始。系统按步骤展开:业务域路由、指标候选、口径卡、真实执行、结果就绪、页面文档就绪。</p>
          <p>动态取数会先检索数据上下文并生成查询定义;静态报告使用 inline 页面数据源。</p>
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
          {#each run.replies as reply, replyIndex (replyIndex)}
            <p class="reply-text" in:fly={{ y: 8, duration: 260 }}>{reply}</p>
          {/each}

          {#each scopeCards(run) as card, cardIndex (cardIndex)}
            <ScopeCard
              {card}
              onconfirm={card.awaitingConfirmation &&
              isLast &&
              run.status === 'interaction_required'
                ? () => confirmInteraction(run)
                : undefined}
            />
          {/each}

          {#if run.steps.length > 0}
            <details class="timeline" open={run.status === 'running'}>
              <summary>执行过程({run.steps.length} 步)</summary>
              <StepTimeline steps={run.steps} />
            </details>
          {/if}

          {#if run.status === 'running'}
            <p class="run-state running-state" in:fade={{ duration: 180 }}>
              <span class="dots" role="status" aria-label="运行中"><i></i><i></i><i></i></span>
              <button type="button" class="linkish" onclick={cancelActiveRun}>
                {cancelRequested ? '取消请求已发出' : '取消运行'}
              </button>
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
      <textarea
        rows="3"
        bind:value={composerText}
        onkeydown={composerKeydown}
        placeholder="描述业务问题,或追问:换维度、改筛选、调整展示(Enter 发送,Shift+Enter 换行)"
      ></textarea>
      <button type="submit" class="primary" disabled={running || !composerText.trim()}>
        {running ? '运行中…' : '发送'}
      </button>
    </form>
  </aside>

  <main>
    <div class="docbar">
      <div class="l">
        {#if pageModel}
          <span class="badge" class:transient={pageModel.transient}>
            {pageModel.transient ? '临时页面态' : '未保存工作副本'}
          </span>
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
    grid-template-columns: 380px minmax(0, 1fr);
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
    gap: 12px;
    min-height: 0;
    padding: 16px 18px;
    overflow-y: auto;
  }
  .thread-empty {
    color: #71717a;
    font-size: 12.5px;
    line-height: 1.7;
  }
  .thread-empty p {
    margin: 0 0 8px;
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
  .timeline summary {
    color: #6366f1;
    font-size: 11.5px;
    cursor: pointer;
    user-select: none;
    transition: color 0.15s ease;
  }
  .timeline summary:hover {
    color: #4338ca;
  }
  .timeline[open] summary {
    margin-bottom: 6px;
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
    gap: 8px;
    padding: 12px 18px 16px;
    border-top: 1px solid #f4f4f5;
  }
  .composer textarea {
    width: 100%;
    padding: 10px 11px;
    border: 1px solid #d4d4d8;
    border-radius: 10px;
    resize: none;
    font: inherit;
    font-size: 13px;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }
  .composer textarea:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgb(99 102 241 / 12%);
  }
  .composer button {
    justify-self: end;
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
  .btn,
  .primary {
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
  .primary {
    color: #fff;
    background: #4f46e5;
    border-color: #4f46e5;
  }
  .primary:hover:not(:disabled) {
    background: #4338ca;
    border-color: #4338ca;
    box-shadow: 0 2px 8px rgb(79 70 229 / 30%);
  }
  .btn:active:not(:disabled),
  .primary:active:not(:disabled) {
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
  .btn:disabled,
  .primary:disabled {
    opacity: 0.5;
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
