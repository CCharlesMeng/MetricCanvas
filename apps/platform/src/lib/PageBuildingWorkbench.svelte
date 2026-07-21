<script lang="ts">
  import { onMount } from 'svelte';
  import type {
    AgentEvent,
    AgentInteraction,
    AgentMessage
  } from '@metriccanvas/agent-runner';
  import {
    deriveWorkbenchState,
    type WorkbenchStage,
    type WorkbenchStageKey,
    type WorkbenchPublishStatus
  } from './workbench-state';

  const STORAGE_KEY = 'metriccanvas-workbench-session-v2';
  const DEFAULT_INTENT = '创建一个展示成交总额的单指标卡页面';

  interface StoredSession {
    runId: string;
    messages: AgentMessage[];
    confirmedPageIds: string[];
    interaction: AgentInteraction | null;
    publishStatus: WorkbenchPublishStatus;
  }

  interface AgentResponse {
    messages?: AgentMessage[];
    events?: AgentEvent[];
    interaction?: AgentInteraction;
    error?: { code: string; message: string };
  }

  let runId = $state('');
  let messages = $state<AgentMessage[]>([]);
  let confirmedPageIds = $state<string[]>([]);
  let interaction = $state<AgentInteraction | null>(null);
  let latestEvents = $state<AgentEvent[]>([]);
  let publishStatus = $state<WorkbenchPublishStatus>('pending');
  let checkingPublishStatus = false;
  let input = $state(DEFAULT_INTENT);
  let existingPageIdInput = $state('');
  let pending = $state(false);
  let error = $state('');
  let now = $state(Date.now());
  let composer: HTMLTextAreaElement;

  const workbench = $derived(
    deriveWorkbenchState({
      messages,
      interaction,
      confirmedPageIds,
      publishStatus
    })
  );
  const visibleMessages = $derived(
    messages.flatMap((message) =>
      (message.role === 'user' || message.role === 'assistant') &&
      message.content.trim().length > 0
        ? [{ role: message.role, content: message.content }]
        : []
    )
  );
  const activeStage = $derived.by(() => {
    const action = workbench.stages.find((stage) => stage.status === 'action_required');
    if (action) return action.key;
    const failed = workbench.stages.find((stage) => stage.status === 'failed');
    if (failed) return failed.key;
    return (
      [...workbench.stages].reverse().find((stage) => stage.status === 'complete')
        ?.key ?? 'catalog'
    );
  });
  const pageIdInteraction = $derived(
    interaction?.kind === 'confirm_page_id' ? interaction : null
  );
  const leaseRemaining = $derived(
    workbench.publish ? formatRemaining(workbench.publish.expiresAt, now) : ''
  );

  onMount(() => {
    runId = crypto.randomUUID();
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) restoreSession(saved);
    const timer = window.setInterval(() => {
      now = Date.now();
    }, 1_000);
    const statusTimer = window.setInterval(() => {
      void refreshPublishStatus();
    }, 5_000);
    queueMicrotask(() => void refreshPublishStatus());
    return () => {
      window.clearInterval(timer);
      window.clearInterval(statusTimer);
    };
  });

  async function submit() {
    const text = input.trim();
    if (!text || pending || pageIdInteraction) return;
    const outgoing: AgentMessage[] = [...messages, { role: 'user', content: text }];
    input = '';
    await execute(outgoing, confirmedPageIds);
  }

  async function openExistingPage() {
    const pageId = existingPageIdInput.trim();
    if (!pageId || pending) return;
    const confirmations = Array.from(new Set([...confirmedPageIds, pageId]));
    const outgoing: AgentMessage[] = [
      {
        role: 'user',
        content: `请通过 get_page 打开看板页面 ${pageId} 的当前最新页面修订，基于它进行更新，先校验，再保存新的页面修订并加载精确预览。`
      }
    ];
    confirmedPageIds = confirmations;
    interaction = null;
    publishStatus = 'pending';
    await execute(outgoing, confirmations);
  }

  async function reloadCurrentRevision() {
    const pageId = workbench.revisionConflict?.pageId;
    if (!pageId || pending) return;
    existingPageIdInput = pageId;
    await openExistingPage();
  }

  async function confirmPageId() {
    const pageId = stringAt(pageIdInteraction?.payload, ['pageId']);
    if (!pageId || pending) return;
    const nextConfirmed = Array.from(new Set([...confirmedPageIds, pageId]));
    const outgoing: AgentMessage[] = [
      ...messages,
      {
        role: 'user',
        content: `我已通过页面搭建工作台确认页面 id ${pageId}，并理解保存 R1 后不能更改。`
      }
    ];
    confirmedPageIds = nextConfirmed;
    interaction = null;
    persistSession({
      runId: currentRunId(),
      messages: outgoing,
      confirmedPageIds: nextConfirmed,
      interaction: null,
      publishStatus
    });
    await execute(outgoing, nextConfirmed);
  }

  function requestDifferentPageId() {
    const pageId = stringAt(pageIdInteraction?.payload, ['pageId']);
    interaction = null;
    input = pageId ? `请把页面 id 从 ${pageId} 改为 ` : '请重新拟定页面 id：';
    queueMicrotask(() => {
      composer?.focus();
      composer?.setSelectionRange(input.length, input.length);
    });
  }

  async function execute(
    outgoing: AgentMessage[],
    confirmations: string[]
  ) {
    pending = true;
    error = '';
    latestEvents = [];
    messages = outgoing;

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          runId: currentRunId(),
          messages: outgoing,
          confirmations: confirmations.map((pageId) => ({
            kind: 'page_id',
            pageId
          }))
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
      if (
        payload.events.some(
          (event) =>
            event.type === 'tool_finished' &&
            event.call.name === 'request_publish' &&
            event.result.isError !== true
        )
      ) {
        publishStatus = 'pending';
      }
      persistSession({
        runId: currentRunId(),
        messages,
        confirmedPageIds: confirmations,
        interaction,
        publishStatus
      });
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      pending = false;
    }
  }

  function clearSession() {
    runId = crypto.randomUUID();
    messages = [];
    confirmedPageIds = [];
    interaction = null;
    latestEvents = [];
    publishStatus = 'pending';
    existingPageIdInput = '';
    input = DEFAULT_INTENT;
    error = '';
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function restoreSession(raw: string) {
    try {
      const saved: unknown = JSON.parse(raw);
      if (Array.isArray(saved)) {
        messages = saved as AgentMessage[];
        return;
      }
      if (!isRecord(saved) || !Array.isArray(saved.messages)) {
        throw new Error('会话格式无效');
      }
      messages = saved.messages as AgentMessage[];
      confirmedPageIds = Array.isArray(saved.confirmedPageIds)
        ? saved.confirmedPageIds.filter(
            (pageId): pageId is string => typeof pageId === 'string'
          )
        : [];
      interaction = isAgentInteraction(saved.interaction) ? saved.interaction : null;
      publishStatus = isPublishStatus(saved.publishStatus)
        ? saved.publishStatus
        : 'pending';
      runId = typeof saved.runId === 'string' ? saved.runId : crypto.randomUUID();
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }

  function currentRunId(): string {
    if (!runId) runId = crypto.randomUUID();
    return runId;
  }

  async function refreshPublishStatus() {
    const requestId = workbench.publish?.requestId;
    if (!requestId || publishStatus !== 'pending' || checkingPublishStatus) return;
    checkingPublishStatus = true;
    try {
      const response = await fetch(
        `/api/publish-requests/${encodeURIComponent(requestId)}`,
        { headers: { accept: 'application/json' } }
      );
      if (!response.ok) return;
      const payload = (await response.json()) as {
        request?: { status?: unknown };
      };
      if (!isPublishStatus(payload.request?.status)) return;
      publishStatus = payload.request.status;
      persistSession({
        runId: currentRunId(),
        messages,
        confirmedPageIds,
        interaction,
        publishStatus
      });
    } finally {
      checkingPublishStatus = false;
    }
  }

  function persistSession(session: StoredSession) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  function stageLabel(key: WorkbenchStageKey): string {
    return {
      catalog: '目录检索',
      validation: '页面校验',
      identity: '页面身份',
      revision: '保存页面修订',
      preview: '精确预览',
      publish: '发布租约'
    }[key];
  }

  function stageSummary(stage: WorkbenchStage): string {
    if (stage.status === 'failed') {
      if (stage.key === 'publish' && workbench.publish) {
        return {
          pending: '等待人工确认',
          published: '已发布',
          expired: '租约已到期',
          validation_failed: '发布复验失败',
          rejected: '已拒绝',
          cancelled: '已取消',
          force_released: '已强制释放'
        }[workbench.publish.status];
      }
      return '需要处理';
    }
    if (stage.status === 'action_required') {
      return stage.key === 'identity' ? '等待你确认' : '等待人工确认';
    }
    if (stage.status === 'pending') {
      if (pending && stage.key === activeStage) return '正在执行';
      return '尚未开始';
    }
    if (stage.key === 'catalog') {
      return workbench.catalog?.metric.name ?? '已完成';
    }
    if (stage.key === 'validation') {
      return `${workbench.validation?.errors.length ?? 0} 个问题`;
    }
    if (stage.key === 'identity') return '已确认';
    if (stage.key === 'revision') {
      return workbench.revision ? `R${workbench.revision.revisionNumber} · 不可变` : '已保存';
    }
    if (stage.key === 'preview') {
      return workbench.revision ? `已绑定 R${workbench.revision.revisionNumber}` : '已绑定';
    }
    if (stage.key === 'publish' && workbench.publish?.status === 'published') {
      return '已发布';
    }
    return '已完成';
  }

  function stageMarker(stage: WorkbenchStage, index: number): string {
    if (stage.status === 'complete') return '✓';
    return String(index + 1);
  }

  function safeMessage(content: string): string[] {
    return content
      .replace(/([?&]token=)[^&\s)]+/giu, '$1[已隐藏]')
      .split('\n')
      .map((line) => line.replace(/^#{1,6}\s+|^[-*]\s+/u, '').trim())
      .filter(Boolean);
  }

  function short(value: string | null | undefined, length = 10): string {
    if (!value) return '—';
    return value.length > length ? `${value.slice(0, length)}…` : value;
  }

  function stablePageUrl(previewUrl: string): string {
    try {
      const url = new URL(previewUrl);
      url.search = '';
      return url.toString();
    } catch {
      return previewUrl.split('?')[0];
    }
  }

  function formatAggregation(value: string | null | undefined): string {
    if (value === 'sum') return '求和';
    if (value === 'avg') return '平均';
    if (value === 'count') return '计数';
    return value ?? '未声明';
  }

  function formatRemaining(expiresAt: string, currentTime: number): string {
    const remaining = Date.parse(expiresAt) - currentTime;
    if (!Number.isFinite(remaining) || remaining <= 0) return '可能已到期';
    const totalSeconds = Math.floor(remaining / 1_000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes} 分 ${String(seconds).padStart(2, '0')} 秒`;
  }

  function stringAt(
    value: unknown,
    path: string[]
  ): string | null {
    let current = value;
    for (const segment of path) {
      if (!isRecord(current) || !(segment in current)) return null;
      current = current[segment];
    }
    return typeof current === 'string' ? current : null;
  }

  function isAgentInteraction(value: unknown): value is AgentInteraction {
    return (
      isRecord(value) &&
      typeof value.id === 'string' &&
      typeof value.kind === 'string' &&
      isRecord(value.payload)
    );
  }

  function isPublishStatus(value: unknown): value is WorkbenchPublishStatus {
    return (
      value === 'pending' ||
      value === 'published' ||
      value === 'expired' ||
      value === 'validation_failed' ||
      value === 'rejected' ||
      value === 'cancelled' ||
      value === 'force_released'
    );
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
</script>

<div class="workbench">
  <header class="workbench-header">
    <div>
      <span class="eyebrow">页面搭建工作台</span>
      <h1>创建受治理的看板页面</h1>
    </div>
    <div class="header-actions">
      <span class:running={pending} class="provider-status">
        <i></i>{pending ? 'Agent 执行中' : 'DeepSeek / scripted fake'}
      </span>
      <div class="existing-page-opener">
        <label for="existing-page-id">已有页面</label>
        <input
          id="existing-page-id"
          bind:value={existingPageIdInput}
          disabled={pending}
          placeholder="页面 id"
          onkeydown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void openExistingPage();
            }
          }}
        />
        <button
          class="secondary"
          type="button"
          onclick={() => void openExistingPage()}
          disabled={pending || existingPageIdInput.trim().length === 0}
        >
          打开并编辑
        </button>
      </div>
      <button class="secondary" type="button" onclick={clearSession}>新建搭建</button>
    </div>
  </header>

  <ol class="timeline" aria-label="搭建阶段">
    {#each workbench.stages as stage, index}
      <li
        class:complete={stage.status === 'complete'}
        class:active={stage.status === 'action_required' || stage.key === activeStage}
        class:failed={stage.status === 'failed'}
        aria-current={stage.key === activeStage ? 'step' : undefined}
      >
        <span class="stage-marker">{stageMarker(stage, index)}</span>
        <div>
          <strong>{stageLabel(stage.key)}</strong>
          <small>{stageSummary(stage)}</small>
        </div>
      </li>
    {/each}
  </ol>

  <div class="workspace">
    <section class="stage">
      {#if pageIdInteraction}
        <div class="identity-gate">
          <span class="action-badge">需要你确认</span>
          <h2>固定看板页面身份</h2>
          <p>
            页面 id 承载看板页面的同一性。确认并保存 R1 后不能更改，后续修改会产生新的页面修订。
          </p>

          <div class="identity-value">
            <div>
              <small>建议页面 id</small>
              <code>{stringAt(pageIdInteraction.payload, ['pageId'])}</code>
            </div>
            <div>
              <small>稳定路径</small>
              <code>{stringAt(pageIdInteraction.payload, ['stablePath'])}</code>
            </div>
          </div>

          <div class="identity-facts">
            <span><i>✓</i> 页面文档已通过结构与语义校验</span>
            <span><i>✓</i> 当前 schemaVersion {stringAt(pageIdInteraction.payload, ['schemaVersion'])}</span>
            <span><i>i</i> 唯一性将在保存事务中原子确认</span>
          </div>

          <div class="gate-actions">
            <button class="secondary" type="button" onclick={requestDifferentPageId}>
              修改页面 id
            </button>
            <button type="button" onclick={() => void confirmPageId()} disabled={pending}>
              确认页面 id 并继续
            </button>
          </div>
        </div>
      {:else if workbench.revisionConflict}
        <div class="revision-conflict">
          <span class="error-badge">页面修订冲突</span>
          <h2>当前编辑基线已不是最新页面修订</h2>
          <p>{workbench.revisionConflict.message}</p>
          <p>
            保存使用的基线：
            <code>{short(workbench.revisionConflict.baseRevisionId)}</code>
            {#if workbench.revisionConflict.currentLatestRevision}
              。当前最新页面修订为 R{workbench.revisionConflict.currentLatestRevision.revisionNumber}
              · <code>{short(workbench.revisionConflict.currentLatestRevision.revisionId)}</code>
            {/if}
          </p>
          <div class="gate-actions">
            <button type="button" onclick={() => void reloadCurrentRevision()} disabled={pending}>
              重新加载当前页面修订
            </button>
          </div>
        </div>
      {:else if workbench.preview}
        <div class="section-heading">
          <div>
            <span class="eyebrow">统一运行时</span>
            <h2>精确修订预览</h2>
          </div>
          {#if workbench.preview.matchesRevision}
            <span class="verified-badge">已绑定 R{workbench.revision?.revisionNumber}</span>
          {:else}
            <span class="error-badge">修订不一致</span>
          {/if}
        </div>

        <div class="source-strip">
          <div><small>看板页面</small><code>{workbench.preview.pageId}</code></div>
          <div>
            <small>页面修订</small>
            <code>R{workbench.revision?.revisionNumber ?? '—'} · {short(workbench.preview.revisionId)}</code>
          </div>
          <div><small>元数据版本</small><code>{short(workbench.revision?.metadataVersion, 14)}</code></div>
          <div>
            <small>通道状态</small>
            <strong>{workbench.publish?.status === 'published' ? '已发布' : '预览'}</strong>
          </div>
        </div>

        {#if workbench.preview.matchesRevision}
          <iframe
            title="统一运行时精确页面修订预览"
            src={workbench.preview.previewUrl}
          ></iframe>
        {:else}
          <div class="blocked-preview">
            预览来源与已保存的页面修订不一致，已停止发布流程。
          </div>
        {/if}

        {#if workbench.publish}
          <div
            class:lease-error={!workbench.publish.matchesRevision || workbench.publish.status !== 'pending' && workbench.publish.status !== 'published'}
            class:published={workbench.publish.status === 'published'}
            class="lease"
          >
            <div class="lease-clock">{workbench.publish.status === 'published' ? '✓' : '15'}</div>
            {#if workbench.publish.status === 'published'}
              <div>
                <strong>R{workbench.revision?.revisionNumber} 已成为当前发布修订</strong>
                <p>稳定页面 URL 已切换到本次核对的精确页面修订。</p>
              </div>
              <a
                href={stablePageUrl(workbench.preview.previewUrl)}
                target="_blank"
                rel="noreferrer"
              >
                打开已发布页面 ↗
              </a>
            {:else}
              <div>
                <strong>
                  {workbench.publish.status === 'pending'
                    ? '发布租约已取得 · 等待人工确认'
                    : stageSummary({ key: 'publish', status: 'failed' })}
                </strong>
                <p>
                  绑定 {workbench.publish.pageId} / R{workbench.revision?.revisionNumber}
                  · {workbench.publish.status === 'pending' ? `${leaseRemaining}后到期` : '未发布'}
                </p>
                <small>到期不会自动发布；确认链接不会在页面中显示或复制。</small>
              </div>
              {#if workbench.publish.matchesRevision && workbench.publish.status === 'pending'}
                <a
                  href={workbench.publish.confirmationUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  核对并确认发布 ↗
                </a>
              {/if}
            {/if}
          </div>
        {/if}
      {:else if workbench.revision}
        <div class="waiting-card">
          <span class="success-icon">✓</span>
          <h2>R{workbench.revision.revisionNumber} 已保存</h2>
          <p>页面修订不可变。Agent 正在创建统一运行时的精确预览。</p>
          <code>{workbench.revision.revisionId}</code>
        </div>
      {:else if pending}
        <div class="running-card">
          <span class="spinner"></span>
          <h2>正在执行受治理的搭建流程</h2>
          <p>Agent 会检索数据服务目录并校验页面文档。完成当前步骤后，治理凭证会保留在右侧。</p>
        </div>
      {:else}
        <div class="intent-card">
          <span class="eyebrow">从业务意图开始</span>
          <h2>这张看板页面要回答什么？</h2>
          <p>
            只需描述业务目标。Agent 会检索数据服务目录，不会猜测指标 code，也不会要求你手写页面文档。
          </p>
          <div class="promise-list">
            <span><i>1</i>引用受治理的指标</span>
            <span><i>2</i>保存前确认不可变页面 id</span>
            <span><i>3</i>精确预览后再人工发布</span>
          </div>
        </div>
      {/if}

      {#if error}
        <div class="request-error">
          <strong>本次执行未完成</strong>
          <span>{error}</span>
        </div>
      {/if}
    </section>

    <aside class="evidence">
      <div class="section-heading compact">
        <div>
          <span class="eyebrow">治理凭证</span>
          <h2>本次搭建</h2>
        </div>
        <span class="receipt-count">
          {workbench.stages.filter((stage) => stage.status !== 'pending').length}/6
        </span>
      </div>

      <article class:available={Boolean(workbench.catalog)} class="receipt">
        <span class="receipt-marker">{workbench.catalog ? '✓' : '1'}</span>
        <div>
          <small>数据服务目录</small>
          {#if workbench.catalog}
            <strong>{workbench.catalog.metric.name} · <code>{workbench.catalog.metric.code}</code></strong>
            <p>
              {formatAggregation(workbench.catalog.metric.aggregation)}
              · {workbench.catalog.metric.dimensions.length === 0 ? '不切分维度' : workbench.catalog.metric.dimensions.join('、')}
            </p>
            <code class="provenance">{short(workbench.catalog.metadataVersion, 18)}</code>
          {:else}
            <strong>等待检索</strong>
          {/if}
        </div>
      </article>

      <article class:available={Boolean(workbench.validation)} class="receipt">
        <span class="receipt-marker">{workbench.validation?.valid ? '✓' : '2'}</span>
        <div>
          <small>页面校验</small>
          {#if workbench.validation}
            <strong>{workbench.validation.valid ? '结构与语义均通过' : '校验未通过'}</strong>
            <p>
              schemaVersion {workbench.validation.currentSchemaVersion ?? '—'}
              · {workbench.validation.errors.length} 个问题
            </p>
          {:else}
            <strong>尚未形成页面文档</strong>
          {/if}
        </div>
      </article>

      <article
        class:available={Boolean(workbench.identity)}
        class:attention={Boolean(workbench.identity && !workbench.identity.confirmed)}
        class="receipt"
      >
        <span class="receipt-marker">{workbench.identity?.confirmed ? '✓' : '3'}</span>
        <div>
          <small>页面身份</small>
          {#if workbench.identity}
            <strong><code>{workbench.identity.pageId}</code></strong>
            <p>{workbench.identity.confirmed ? '已确认 · 保存后不可更改' : '等待你明确确认'}</p>
          {:else}
            <strong>等待页面校验</strong>
          {/if}
        </div>
      </article>

      <article class:available={Boolean(workbench.baseRevision || workbench.revision)} class="receipt">
        <span class="receipt-marker">{workbench.revision ? '✓' : '4'}</span>
        <div>
          <small>不可变页面修订</small>
          {#if workbench.baseRevision}
            <strong>
              编辑基线 R{workbench.baseRevision.revisionNumber}
              · <code>{short(workbench.baseRevision.baseRevisionId)}</code>
            </strong>
            <p>加载时的当前页面修订，保存将以此作为 baseRevisionId</p>
          {/if}
          {#if workbench.revision}
            <strong>R{workbench.revision.revisionNumber} · <code>{short(workbench.revision.revisionId)}</code></strong>
            <p>内容指纹 {short(workbench.revision.contentHash, 14)}</p>
            <p>{workbench.revision.createdBy} · {workbench.revision.createdAt}</p>
          {:else if !workbench.baseRevision}
            <strong>尚未保存</strong>
          {/if}
        </div>
      </article>

      <article class:available={Boolean(workbench.preview)} class="receipt">
        <span class="receipt-marker">{workbench.preview?.matchesRevision ? '✓' : '5'}</span>
        <div>
          <small>统一运行时预览</small>
          {#if workbench.preview}
            <strong>{workbench.preview.matchesRevision ? '已绑定精确修订' : '修订绑定不一致'}</strong>
            <p>{workbench.preview.pageId} / {short(workbench.preview.revisionId)}</p>
          {:else}
            <strong>等待已保存修订</strong>
          {/if}
        </div>
      </article>

      <article
        class:available={Boolean(workbench.publish)}
        class:attention={workbench.publish?.status === 'pending'}
        class="receipt"
      >
        <span class="receipt-marker">6</span>
        <div>
          <small>发布租约</small>
          {#if workbench.publish}
            <strong>
              {workbench.publish.status === 'published'
                ? '已发布'
                : workbench.publish.status === 'pending'
                  ? leaseRemaining
                  : stageSummary({ key: 'publish', status: 'failed' })}
            </strong>
            <p>
              {workbench.publish.status === 'published'
                ? `R${workbench.revision?.revisionNumber} 已成为当前发布修订`
                : workbench.publish.status === 'pending'
                  ? '等待人工确认 · 到期不会发布'
                  : '稳定页面 URL 未发生变化'}
            </p>
          {:else}
            <strong>尚未申请</strong>
          {/if}
        </div>
      </article>

      <details class="activity" open={visibleMessages.length > 0 && !workbench.revision}>
        <summary>搭建记录 <span>{visibleMessages.length}</span></summary>
        <div class="messages">
          {#each visibleMessages as message}
            <article class:user={message.role === 'user'}>
              <strong>{message.role === 'user' ? '你' : 'Agent'}</strong>
              {#each safeMessage(message.content) as line}
                <p>{line}</p>
              {/each}
            </article>
          {/each}
          {#if latestEvents.some((event) => event.type === 'tool_finished')}
            <p class="latest-note">最新治理凭证已同步到上方时间线。</p>
          {/if}
        </div>
      </details>
    </aside>
  </div>

  <form
    class="command-bar"
    onsubmit={(event) => {
      event.preventDefault();
      void submit();
    }}
  >
    <div>
      <label for="page-intent">
        {pageIdInteraction ? '请先完成页面 id 确认' : '继续描述页面需求或调整'}
      </label>
      <textarea
        id="page-intent"
        bind:this={composer}
        bind:value={input}
        rows="2"
        disabled={pending || Boolean(pageIdInteraction)}
        placeholder="例如：创建一个展示成交总额的单指标卡页面"
      ></textarea>
    </div>
    <button type="submit" disabled={pending || Boolean(pageIdInteraction) || input.trim().length === 0}>
      {pending ? 'Agent 执行中…' : messages.length === 0 ? '开始搭建' : '发送'}
    </button>
  </form>
</div>

<style>
  .workbench {
    height: calc(100vh - 54px);
    min-height: calc(100vh - 54px);
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr) auto;
    color: #17202a;
    background: #eef1f5;
  }
  .workbench-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 24px;
    border-bottom: 1px solid #dce1e7;
    background: #fff;
  }
  .eyebrow {
    display: block;
    margin-bottom: 5px;
    color: #697386;
    font-size: 11px;
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  h1,
  h2,
  p {
    margin: 0;
  }
  h1 {
    font-size: 20px;
  }
  h2 {
    font-size: 18px;
  }
  code {
    font-family: "SFMono-Regular", Consolas, monospace;
  }
  button,
  input,
  textarea {
    font: inherit;
  }
  button,
  .lease a {
    border: 0;
    border-radius: 8px;
    padding: 10px 14px;
    color: #fff;
    background: #2457d6;
    font-weight: 700;
    cursor: pointer;
    text-decoration: none;
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  button.secondary {
    color: #3f4754;
    border: 1px solid #d7dce3;
    background: #fff;
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .existing-page-opener {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .existing-page-opener label {
    color: #697386;
    font-size: 10px;
    font-weight: 700;
    white-space: nowrap;
  }
  .existing-page-opener input {
    width: 120px;
    border: 1px solid #d4dbe4;
    border-radius: 7px;
    padding: 7px 8px;
    color: #27313f;
  }
  .existing-page-opener button {
    padding: 8px 10px;
    font-size: 11px;
  }
  .provider-status {
    display: flex;
    align-items: center;
    gap: 7px;
    border-radius: 999px;
    padding: 7px 10px;
    color: #506073;
    background: #f0f3f6;
    font-size: 11px;
    font-weight: 700;
  }
  .provider-status i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #16745b;
  }
  .provider-status.running i {
    background: #d28b16;
    animation: pulse 1s infinite alternate;
  }
  .timeline {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    margin: 0;
    padding: 0 24px;
    list-style: none;
    border-bottom: 1px solid #dce1e7;
    background: #f8fafc;
  }
  .timeline li {
    position: relative;
    display: flex;
    gap: 9px;
    min-width: 0;
    padding: 15px 10px;
    color: #8b95a4;
  }
  .timeline li:not(:last-child)::after {
    position: absolute;
    top: 28px;
    right: -5px;
    width: 10px;
    height: 1px;
    background: #c6cdd7;
    content: "";
  }
  .stage-marker {
    display: grid;
    width: 24px;
    height: 24px;
    place-items: center;
    flex: 0 0 auto;
    border: 1px solid #bdc5d0;
    border-radius: 50%;
    font-size: 11px;
    font-weight: 800;
  }
  .timeline li > div {
    min-width: 0;
    display: grid;
    gap: 2px;
  }
  .timeline strong,
  .timeline small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .timeline strong {
    color: #526071;
    font-size: 12px;
  }
  .timeline small {
    font-size: 10px;
  }
  .timeline li.complete .stage-marker {
    color: #fff;
    border-color: #16745b;
    background: #16745b;
  }
  .timeline li.complete strong {
    color: #27313f;
  }
  .timeline li.active {
    background: #fff7e8;
  }
  .timeline li.active .stage-marker {
    color: #8a5500;
    border-color: #d89725;
    background: #fff;
  }
  .timeline li.failed {
    background: #fef2f2;
  }
  .timeline li.failed .stage-marker {
    color: #b42318;
    border-color: #e9a19b;
  }
  .workspace {
    display: grid;
    grid-template-columns: minmax(580px, 1fr) 350px;
    min-height: 0;
  }
  .stage {
    min-width: 0;
    overflow: auto;
    padding: 24px;
  }
  .evidence {
    overflow: auto;
    padding: 22px 20px;
    border-left: 1px solid #dce1e7;
    background: #fff;
  }
  .section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  .section-heading.compact {
    margin-bottom: 10px;
  }
  .verified-badge,
  .error-badge,
  .action-badge {
    border-radius: 999px;
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 750;
  }
  .verified-badge {
    color: #16604c;
    background: #e8f6f1;
  }
  .error-badge {
    color: #9b2820;
    background: #fce9e7;
  }
  .action-badge {
    display: inline-block;
    margin-bottom: 12px;
    color: #244caa;
    background: #edf3ff;
  }
  .identity-gate {
    width: min(680px, 100%);
    margin: 28px auto;
    padding: 28px;
    border: 1px solid #94aee9;
    border-radius: 14px;
    box-shadow: 0 14px 40px rgb(36 87 214 / 9%);
    background: #fff;
  }
  .revision-conflict {
    width: min(680px, 100%);
    margin: 28px auto;
    padding: 28px;
    border: 1px solid #e9a19b;
    border-radius: 14px;
    background: #fff;
  }
  .revision-conflict > p {
    margin-top: 9px;
    color: #697386;
    font-size: 13px;
    line-height: 1.7;
  }
  .identity-gate > p {
    max-width: 600px;
    margin-top: 9px;
    color: #697386;
    font-size: 13px;
    line-height: 1.7;
  }
  .identity-value {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    overflow: hidden;
    margin-top: 20px;
    border: 1px solid #dce1e7;
    border-radius: 10px;
    background: #dce1e7;
  }
  .identity-value > div {
    display: grid;
    gap: 7px;
    padding: 15px;
    background: #f8fafc;
  }
  .identity-value small {
    color: #798394;
    font-size: 10px;
  }
  .identity-value code {
    font-size: 14px;
    font-weight: 700;
  }
  .identity-facts {
    display: grid;
    gap: 8px;
    margin-top: 16px;
    color: #5e6978;
    font-size: 11px;
  }
  .identity-facts span {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .identity-facts i {
    display: grid;
    width: 18px;
    height: 18px;
    place-items: center;
    border-radius: 50%;
    color: #16745b;
    background: #e8f6f1;
    font-style: normal;
    font-size: 10px;
  }
  .gate-actions {
    display: flex;
    justify-content: flex-end;
    gap: 9px;
    margin-top: 24px;
  }
  .source-strip {
    display: grid;
    grid-template-columns: 1.2fr 1.2fr 1.2fr 0.6fr;
    gap: 1px;
    overflow: hidden;
    border: 1px solid #dce1e7;
    border-radius: 10px 10px 0 0;
    background: #dce1e7;
  }
  .source-strip > div {
    min-width: 0;
    display: grid;
    gap: 5px;
    padding: 11px 13px;
    background: #f8fafc;
  }
  .source-strip small {
    color: #798394;
    font-size: 10px;
  }
  .source-strip code,
  .source-strip strong {
    overflow: hidden;
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  iframe {
    width: 100%;
    min-height: 470px;
    border: 1px solid #dce1e7;
    border-top: 0;
    background: #fff;
  }
  .blocked-preview {
    min-height: 360px;
    display: grid;
    place-items: center;
    padding: 30px;
    color: #9b2820;
    border: 1px solid #e9a19b;
    background: #fff;
  }
  .lease {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 12px;
    align-items: center;
    margin-top: 14px;
    padding: 14px;
    border: 1px solid #f1c36d;
    border-radius: 10px;
    background: #fff9ed;
  }
  .lease.lease-error {
    border-color: #e9a19b;
    background: #fef2f2;
  }
  .lease.published {
    border-color: #9dd5c2;
    background: #edf8f4;
  }
  .lease.published .lease-clock {
    color: #fff;
    border-color: #16745b;
    background: #16745b;
  }
  .lease.published p,
  .lease.published small {
    color: #3f6b5e;
  }
  .lease-clock {
    display: grid;
    width: 36px;
    height: 36px;
    place-items: center;
    border: 1px solid #e3a941;
    border-radius: 50%;
    color: #7a4b00;
    font-size: 12px;
    font-weight: 800;
  }
  .lease strong {
    font-size: 13px;
  }
  .lease p,
  .lease small {
    display: block;
    margin-top: 3px;
    color: #765c33;
    font-size: 10px;
  }
  .waiting-card,
  .running-card,
  .intent-card {
    width: min(650px, 100%);
    margin: 50px auto;
    padding: 28px;
    border: 1px solid #dce1e7;
    border-radius: 14px;
    background: #fff;
  }
  .waiting-card,
  .running-card {
    text-align: center;
  }
  .waiting-card p,
  .running-card p,
  .intent-card > p {
    margin-top: 9px;
    color: #697386;
    font-size: 13px;
    line-height: 1.7;
  }
  .waiting-card code {
    display: block;
    margin-top: 15px;
    color: #697386;
    font-size: 11px;
  }
  .success-icon,
  .spinner {
    display: grid;
    width: 38px;
    height: 38px;
    place-items: center;
    margin: 0 auto 14px;
    border-radius: 50%;
  }
  .success-icon {
    color: #fff;
    background: #16745b;
  }
  .spinner {
    border: 3px solid #dbe3f5;
    border-top-color: #2457d6;
    animation: spin 0.8s linear infinite;
  }
  .promise-list {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-top: 22px;
  }
  .promise-list span {
    display: grid;
    gap: 8px;
    padding: 13px;
    color: #526071;
    border: 1px solid #e3e7ec;
    border-radius: 9px;
    font-size: 11px;
  }
  .promise-list i {
    display: grid;
    width: 22px;
    height: 22px;
    place-items: center;
    border-radius: 50%;
    color: #2457d6;
    background: #edf3ff;
    font-style: normal;
    font-weight: 800;
  }
  .request-error {
    width: min(680px, 100%);
    display: grid;
    gap: 5px;
    margin: 16px auto 0;
    padding: 12px 14px;
    color: #991b1b;
    border: 1px solid #fecaca;
    border-radius: 9px;
    background: #fef2f2;
    font-size: 12px;
  }
  .receipt-count {
    color: #16745b;
    font-size: 12px;
    font-weight: 800;
  }
  .receipt {
    display: grid;
    grid-template-columns: 24px 1fr;
    gap: 10px;
    padding: 13px 0;
    color: #9aa2ae;
    border-bottom: 1px solid #edf0f3;
  }
  .receipt.available {
    color: #27313f;
  }
  .receipt.attention {
    margin: 5px -10px;
    padding: 12px 10px;
    border: 1px solid #f1c36d;
    border-radius: 8px;
    background: #fff9ed;
  }
  .receipt-marker {
    display: grid;
    width: 22px;
    height: 22px;
    place-items: center;
    border: 1px solid #c6cdd7;
    border-radius: 50%;
    font-size: 10px;
    font-weight: 800;
  }
  .receipt.available .receipt-marker {
    color: #fff;
    border-color: #16745b;
    background: #16745b;
  }
  .receipt.attention .receipt-marker {
    color: #8a5500;
    border-color: #d89725;
    background: #fff;
  }
  .receipt > div {
    min-width: 0;
    display: grid;
    gap: 4px;
  }
  .receipt small,
  .receipt p {
    color: #798394;
    font-size: 10px;
  }
  .receipt strong {
    overflow-wrap: anywhere;
    font-size: 12px;
  }
  .receipt code {
    font-size: 10px;
  }
  .receipt .provenance {
    color: #929baa;
  }
  .activity {
    margin-top: 16px;
    border: 1px solid #dce1e7;
    border-radius: 9px;
  }
  .activity summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    color: #526071;
    cursor: pointer;
    font-size: 11px;
    font-weight: 700;
  }
  .activity summary span {
    border-radius: 999px;
    padding: 2px 6px;
    background: #edf0f3;
  }
  .messages {
    max-height: 260px;
    display: grid;
    gap: 9px;
    overflow: auto;
    padding: 10px;
    border-top: 1px solid #edf0f3;
    background: #f8fafc;
  }
  .messages article {
    padding: 9px 10px;
    border: 1px solid #e3e7ec;
    border-radius: 8px;
    background: #fff;
  }
  .messages article.user {
    border-color: #cbd8f7;
    background: #f2f6ff;
  }
  .messages strong {
    font-size: 10px;
  }
  .messages p {
    margin-top: 4px;
    color: #526071;
    font-size: 10px;
    line-height: 1.55;
  }
  .latest-note {
    color: #16745b !important;
  }
  .command-bar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: end;
    padding: 12px 20px 16px;
    border-top: 1px solid #dce1e7;
    background: #fff;
  }
  .command-bar > div {
    display: grid;
    gap: 6px;
  }
  .command-bar label {
    color: #697386;
    font-size: 10px;
    font-weight: 700;
  }
  .command-bar textarea {
    width: 100%;
    resize: none;
    border: 1px solid #d4dbe4;
    border-radius: 9px;
    outline: 0;
    padding: 9px 11px;
    color: #27313f;
    background: #fff;
  }
  .command-bar textarea:focus {
    border-color: #6d8dde;
    box-shadow: 0 0 0 3px rgb(36 87 214 / 9%);
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes pulse {
    to {
      opacity: 0.35;
    }
  }
  @media (max-width: 760px) {
    .workbench {
      height: auto;
    }
    .timeline {
      grid-template-columns: repeat(3, 1fr);
    }
    .workspace {
      grid-template-columns: 1fr;
    }
    .evidence {
      border-top: 1px solid #dce1e7;
      border-left: 0;
    }
  }
  @media (max-width: 640px) {
    .workbench-header {
      align-items: flex-start;
      gap: 12px;
      padding: 15px;
    }
    .provider-status {
      display: none;
    }
    .header-actions,
    .existing-page-opener {
      align-items: flex-end;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .timeline {
      grid-template-columns: repeat(2, 1fr);
      padding: 0 8px;
    }
    .stage {
      padding: 15px;
    }
    .identity-value,
    .source-strip,
    .promise-list {
      grid-template-columns: 1fr;
    }
    .lease {
      grid-template-columns: auto 1fr;
    }
    .lease a {
      grid-column: 1 / -1;
      text-align: center;
    }
  }
</style>
