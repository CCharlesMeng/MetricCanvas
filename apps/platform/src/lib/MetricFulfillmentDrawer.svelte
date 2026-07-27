<script lang="ts">
  import type {
    AtomicMetricRequest,
    MetricFulfillmentSnapshot,
    MetricRequestGroupReadiness
  } from '@metriccanvas/metric-fulfillment';
  import type { DpMetricCandidate } from '@metriccanvas/dp-catalog';

  interface Props {
    pageId: string | null;
    baseRevisionId: string | null;
    goal: string;
    oncontinue?: (request: AtomicMetricRequest) => void | Promise<void>;
    onreadiness?: (readiness: MetricRequestGroupReadiness | null) => void;
    onunmet?: (requests: AtomicMetricRequest[]) => void;
  }

  let { pageId, baseRevisionId, goal, oncontinue, onreadiness, onunmet }: Props = $props();
  let snapshot = $state<MetricFulfillmentSnapshot | null>(null);
  let candidates = $state<DpMetricCandidate[]>([]);
  let selectedCandidateId = $state('');
  let selectedRequestId = $state('');
  let metricName = $state('Tokens 消耗量');
  let definition = $state('统计模型推理产生的输入与输出 Tokens 总量。');
  let dimensions = $state('office, model');
  let aggregations = $state('sum');
  let returnCategory = $state('definition_unclear');
  let returnNote = $state('');
  let loading = $state(false);
  let error = $state('');
  let loadedPageKey = $state<string | null>(null);

  const request = $derived(
    snapshot?.requests.find(
      (candidate) => candidate.requestId === selectedRequestId
    ) ??
      snapshot?.requests[0] ??
      null
  );
  const audits = $derived(snapshot?.audits.slice().reverse() ?? []);

  $effect(() => {
    onreadiness?.(snapshot?.group.readiness ?? null);
    onunmet?.(
      snapshot?.requests.filter((candidate) => candidate.status !== 'fulfilled') ??
        []
    );
  });

  $effect(() => {
    const key = pageId?.trim() || null;
    if (key === loadedPageKey) return;
    loadedPageKey = key;
    snapshot = null;
    candidates = [];
    selectedCandidateId = '';
    selectedRequestId = '';
    if (key) void loadForPage(key);
  });

  $effect(() => {
    if (
      !request ||
      (request.status !== 'awaiting_publication' &&
        request.status !== 'awaiting_catalog_verification')
    ) {
      return;
    }
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => window.clearInterval(timer);
  });

  async function createBlueprint() {
    loading = true;
    error = '';
    try {
      const response = await fetch('/api/metric-fulfillment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          blueprintId: null,
          pageId,
          baseRevisionId,
          goal: goal.trim() || '补齐页面所需业务指标',
          modules: [
            {
              moduleId: 'metric-overview',
              title: '指标概览',
              metricRequestKeys: ['primary-metric']
            }
          ],
          metricRequests: [
            {
              requestKey: 'primary-metric',
              name: metricName.trim(),
              definition: definition.trim(),
              requiredDimensions: csv(dimensions),
              requiredAggregations: csv(aggregations),
              necessity: 'required',
              suggestedBy: 'user',
              contextSummary: goal.trim() || '页面主指标'
            }
          ],
          idempotencyKey: crypto.randomUUID()
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? `HTTP ${response.status}`);
      snapshot = payload.snapshot;
      loading = false;
      await searchCandidates();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      loading = false;
    }
  }

  async function loadForPage(currentPageId: string) {
    try {
      const response = await fetch(
        `/api/metric-fulfillment?pageId=${encodeURIComponent(currentPageId)}`
      );
      if (response.status === 404) return;
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message ?? `HTTP ${response.status}`);
      }
      if (pageId === currentPageId) snapshot = payload.snapshot;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  async function searchCandidates() {
    if (!snapshot || !request) return;
    const payload = await action({
      action: 'search_candidates',
      requestId: request.requestId
    });
    if (payload?.ok) {
      candidates = payload.candidates ?? [];
      selectedCandidateId = '';
    }
  }

  async function confirmNewMetric() {
    if (!request) return;
    await mutate({
      action: 'record_gap',
      requestId: request.requestId,
      reviewerId: 'reviewer-data-1',
      idempotencyKey: crypto.randomUUID()
    });
  }

  async function confirmAllNewMetrics() {
    if (!snapshot) return;
    for (const candidate of snapshot.requests.filter(
      (item) => item.status === 'awaiting_candidate_confirmation'
    )) {
      await mutate({
        action: 'record_gap',
        requestId: candidate.requestId,
        reviewerId: 'reviewer-data-1',
        idempotencyKey: crypto.randomUUID()
      });
    }
  }

  function selectRequest(requestId: string) {
    selectedRequestId = requestId;
    candidates = [];
    selectedCandidateId = '';
  }

  async function confirmReuseMetric() {
    if (!request || !selectedCandidateId) return;
    await mutate({
      action: 'reuse_dp_metric',
      requestId: request.requestId,
      dpMetricId: selectedCandidateId,
      idempotencyKey: crypto.randomUUID()
    });
  }

  async function review(decision: 'accept' | 'return') {
    if (!request) return;
    await mutate({
      action: 'review',
      requestId: request.requestId,
      decision,
      ...(decision === 'return'
        ? { returnCategory, note: returnNote.trim() || undefined }
        : {}),
      idempotencyKey: crypto.randomUUID()
    });
  }

  async function revise() {
    if (!request) return;
    await mutate({
      action: 'revise',
      requestId: request.requestId,
      name: metricName.trim(),
      definition: definition.trim(),
      requiredDimensions: csv(dimensions),
      requiredAggregations: csv(aggregations),
      contextSummary: goal.trim() || request.contextSummary,
      idempotencyKey: crypto.randomUUID()
    });
  }

  async function linkMetric() {
    if (!request || !selectedCandidateId) return;
    await mutate({
      action: 'link_dp_metric',
      requestId: request.requestId,
      dpMetricId: selectedCandidateId,
      idempotencyKey: crypto.randomUUID()
    });
  }

  async function refresh() {
    await mutate({ action: 'refresh' });
  }

  async function continuePage() {
    const requestId = request?.requestId;
    if (!requestId) return;
    await refresh();
    const current = snapshot?.requests.find(
      (candidate) => candidate.requestId === requestId
    );
    if (current?.status !== 'fulfilled') {
      error = '继续前的即时复验尚未通过，请稍后重试。';
      return;
    }
    await oncontinue?.(current);
  }

  async function mutate(body: Record<string, unknown>) {
    const payload = await action(body);
    if (payload?.ok) snapshot = payload.snapshot;
  }

  async function action(body: Record<string, unknown>): Promise<any> {
    if (!snapshot || loading) return null;
    loading = true;
    error = '';
    try {
      const response = await fetch(
        `/api/metric-fulfillment/${encodeURIComponent(snapshot.blueprint.blueprintId)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body)
        }
      );
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message ?? `HTTP ${response.status}`);
      }
      return payload;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      return null;
    } finally {
      loading = false;
    }
  }

  function csv(value: string): string[] {
    return [...new Set(value.split(/[,，]/u).map((item) => item.trim()).filter(Boolean))];
  }

  function statusLabel(status: AtomicMetricRequest['status']): string {
    return {
      awaiting_candidate_confirmation: '等待业务确认',
      awaiting_data_development_confirmation: '等待数据开发确认',
      awaiting_dp_metric_link: '等待关联 DP 指标',
      awaiting_publication: '等待 DP 发布',
      awaiting_catalog_verification: '等待数据服务目录验真',
      fulfilled: '已履约',
      rejected: '已退回，等待修订'
    }[status];
  }

  function auditLabel(action: MetricFulfillmentSnapshot['audits'][number]['action']): string {
    return {
      blueprint_saved: '页面搭建蓝图已保存',
      dp_metric_reuse_confirmed: '业务已确认复用 DP 指标',
      metric_gap_recorded: '指标缺口已登记',
      data_development_accepted: '数据开发已确认',
      data_development_returned: '数据开发已退回',
      metric_request_revised: '原子指标需求已修订',
      dp_metric_linked: '已关联 DP 指标 ID',
      dp_sync_failed: 'DP 状态同步失败',
      catalog_verification_pending: '等待数据服务目录同步',
      metric_fulfilled: '目录能力验真完成'
    }[action];
  }
</script>

{#if !snapshot}
  <section class="empty">
    <div class="mark">◇</div>
    <h3>补齐页面缺少的业务指标</h3>
    <p>先保存页面搭建蓝图；它只包含目标、模块结构和原子指标需求，不保存完整对话或业务数据行。</p>
    <label>指标名称<input bind:value={metricName} /></label>
    <label>业务定义<textarea bind:value={definition} rows="3"></textarea></label>
    <div class="pair">
      <label>必需维度<input bind:value={dimensions} /></label>
      <label>必需聚合<input bind:value={aggregations} /></label>
    </div>
    <button class="primary" type="button" onclick={() => void createBlueprint()} disabled={loading || !metricName.trim() || !definition.trim()}>
      {loading ? '正在建立…' : '建立页面搭建蓝图'}
    </button>
  </section>
{:else if request}
  <section class="summary">
    <div>
      <span>指标需求组</span>
      <strong class:ready={snapshot.group.readiness === 'ready'}>{snapshot.group.readiness === 'ready' ? '已就绪' : snapshot.group.readiness === 'partially_ready' ? '部分就绪' : '受阻'}</strong>
    </div>
    <small>{snapshot.blueprint.goal}</small>
  </section>

  {#if snapshot.requests.length > 1}
    <section class="request-list">
      <div class="action-heading">
        <strong>原子指标需求</strong>
        <button type="button" onclick={() => void confirmAllNewMetrics()} disabled={loading || !snapshot.requests.some((item) => item.status === 'awaiting_candidate_confirmation')}>批量确认新增</button>
      </div>
      <div>
        {#each snapshot.requests as item}
          <button class:active={item.requestId === request.requestId} type="button" onclick={() => selectRequest(item.requestId)}>
            <strong>{item.name}</strong><small>{statusLabel(item.status)}</small>
          </button>
        {/each}
      </div>
    </section>
  {/if}

  <ol class="steps" aria-label="指标履约进度">
    <li class:done={request.status !== 'awaiting_candidate_confirmation'}>业务确认</li>
    <li class:done={!['awaiting_candidate_confirmation','awaiting_data_development_confirmation','rejected'].includes(request.status)}>数据开发确认</li>
    <li class:done={Boolean(request.dpMetricId)}>DP 发布</li>
    <li class:done={request.status === 'fulfilled'}>目录验真</li>
  </ol>

  <article class="request-card">
    <header><div><small>原子指标需求</small><h3>{request.name}</h3></div><span class={`status ${request.status}`}>{statusLabel(request.status)}</span></header>
    <p>{request.definition}</p>
    <dl>
      <div><dt>必要性</dt><dd>{request.necessity === 'required' ? '必需' : '可选'}</dd></div>
      <div><dt>确认人</dt><dd>{request.reviewerId ?? '尚未指定'}</dd></div>
      <div><dt>维度</dt><dd>{request.requiredDimensions.join('、') || '无'}</dd></div>
      <div><dt>聚合</dt><dd>{request.requiredAggregations.join('、') || '无'}</dd></div>
    </dl>
    {#if request.dpMetricId}<code>DP ID · {request.dpMetricId}</code>{/if}
    {#if request.syncError}<div class="warning">{request.syncError}</div>{/if}
    {#if request.catalogVerification?.status === 'capability_gap'}
      <div class="warning">能力仍有缺口：{[...request.catalogVerification.missingDimensions, ...request.catalogVerification.missingAggregations].join('、')}</div>
    {/if}
  </article>

  {#if request.status === 'awaiting_candidate_confirmation'}
    <section class="action-panel">
      <div class="action-heading"><strong>DP 候选</strong><button type="button" onclick={() => void searchCandidates()} disabled={loading}>重新检索</button></div>
      <p>候选只供判断，系统不会自动选择排序最前的结果。</p>
      {#if candidates.length === 0}<div class="no-candidate">未找到可复用候选，可确认登记新指标缺口。</div>{/if}
      {#each candidates as candidate}
        <label class="candidate candidate-choice">
          <input type="radio" bind:group={selectedCandidateId} value={candidate.metric.id} />
          <span>
            <span class="candidate-title"><strong>{candidate.metric.name}</strong><em>{candidate.metric.status}</em></span>
            <p>{candidate.metric.definition}</p>
            <small>匹配：{candidate.matchReasons.join('、') || '名称/定义'} · 缺口：{[...candidate.missingDimensions, ...candidate.missingAggregations].join('、') || '无'}</small>
          </span>
        </label>
      {/each}
      <div class="button-row">
        <button type="button" onclick={() => void confirmReuseMetric()} disabled={loading || !selectedCandidateId}>确认复用所选候选</button>
        <button class="primary" type="button" onclick={() => void confirmNewMetric()} disabled={loading}>候选都不匹配，登记新指标</button>
      </div>
    </section>
  {:else if request.status === 'awaiting_data_development_confirmation'}
    <section class="action-panel">
      <strong>数据开发确认</strong>
      <p>当前以指定确认人 reviewer-data-1 的身份处理；发布者或管理员不能替代确认。</p>
      <div class="button-row"><button class="primary" type="button" onclick={() => void review('accept')} disabled={loading}>口径与能力可实现</button><button type="button" onclick={() => void review('return')} disabled={loading}>结构化退回</button></div>
      <select bind:value={returnCategory}><option value="definition_unclear">定义不清</option><option value="dimension_unavailable">维度不可用</option><option value="aggregation_unavailable">聚合不可用</option><option value="existing_metric_reusable">已有指标可复用</option><option value="other">其他</option></select>
      <input bind:value={returnNote} placeholder="退回说明（可选）" />
    </section>
  {:else if request.status === 'rejected'}
    <section class="action-panel">
      <strong>修订同一原子指标需求</strong><p>修订会保留原 requestId 和历史，不会创建重复需求。</p>
      <label>指标名称<input bind:value={metricName} /></label>
      <label>业务定义<textarea bind:value={definition} rows="3"></textarea></label>
      <label>必需维度<input bind:value={dimensions} /></label>
      <label>必需聚合<input bind:value={aggregations} /></label>
      <button class="primary" type="button" onclick={() => void revise()} disabled={loading}>提交修订 v{request.revisionNumber + 1}</button>
    </section>
  {:else if request.status === 'awaiting_dp_metric_link'}
    <section class="action-panel">
      <div class="action-heading"><strong>关联稳定 DP 指标 ID</strong><button type="button" onclick={() => void searchCandidates()} disabled={loading}>检索 DP</button></div>
      <p>数据开发在 DP 创建指标后返回这里检索并明确选择。</p>
      {#each candidates as candidate}
        <label class="candidate selectable"><input type="radio" bind:group={selectedCandidateId} value={candidate.metric.id} /><span><strong>{candidate.metric.name}</strong><small>{candidate.metric.id} · {candidate.metric.status}</small></span></label>
      {/each}
      <button class="primary" type="button" onclick={() => void linkMetric()} disabled={loading || !selectedCandidateId}>关联所选 DP 指标</button>
    </section>
  {:else if request.status === 'awaiting_publication' || request.status === 'awaiting_catalog_verification'}
    <section class="action-panel">
      <strong>{request.status === 'awaiting_publication' ? '等待 DP 发布' : '等待数据服务目录验真'}</strong>
      <p>MetricCanvas 只轮询状态，不创建或修改 DP 指标；DP 超时不会丢失当前进度。</p>
      <button class="primary" type="button" onclick={() => void refresh()} disabled={loading}>{loading ? '正在同步…' : '立即同步状态'}</button>
    </section>
  {:else if request.status === 'fulfilled'}
    <section class="ready-panel">
      <strong>指标已就绪，可以继续完成页面</strong>
      <p>继续时会先读取当前最新页面修订，创建新的未保存工作副本并展示差异；不会覆盖期间的修改。</p>
      <button class="primary" type="button" onclick={() => void continuePage()} disabled={loading}>继续页面</button>
    </section>
  {/if}

  <section class="audit">
    <div class="action-heading"><strong>履约记录</strong><small>{snapshot.audits.length} 条</small></div>
    {#each audits.slice(0, 8) as item}
      <div><i></i><span><strong>{auditLabel(item.action)}</strong><small>{new Date(item.occurredAt).toLocaleString('zh-CN')} · {item.actorId}</small></span></div>
    {/each}
  </section>
{/if}

{#if error}<div class="error" role="alert">{error}</div>{/if}

<style>
  :global(*) { box-sizing: border-box; }
  section { display: grid; gap: 10px; }
  h3, p, dl, ol { margin: 0; }
  p { color: #6f798a; font-size: 9px; line-height: 1.65; }
  label { display: grid; gap: 5px; color: #687386; font-size: 8px; font-weight: 700; }
  input, textarea, select { width: 100%; padding: 8px 9px; color: #313a4b; background: #fff; border: 1px solid #dfe3e9; border-radius: 6px; font: inherit; outline: none; }
  textarea { resize: vertical; }
  input:focus, textarea:focus, select:focus { border-color: #7770e5; box-shadow: 0 0 0 2px rgb(99 102 241 / .1); }
  button { padding: 7px 9px; color: #586174; background: #fff; border: 1px solid #dce1e8; border-radius: 6px; font-size: 8px; font-weight: 800; cursor: pointer; }
  button:disabled { cursor: not-allowed; opacity: .5; }
  button.primary { color: #fff; background: #5148d8; border-color: #5148d8; }
  .empty { padding: 8px 2px; }
  .mark { display: grid; width: 34px; height: 34px; place-items: center; color: #5148d8; background: #efefff; border-radius: 9px; font-size: 20px; }
  .empty h3 { color: #313a4b; font-size: 13px; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .summary { padding: 10px; background: linear-gradient(135deg, #f3f2ff, #f9f9ff); border: 1px solid #dedcf8; border-radius: 8px; }
  .summary > div, .request-card header, .action-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .summary span, .request-card small { color: #7b8495; font-size: 8px; }
  .summary strong { padding: 4px 7px; color: #a16207; background: #fef3c7; border-radius: 999px; font-size: 8px; }
  .summary strong.ready { color: #047857; background: #d1fae5; }
  .steps { display: grid; grid-template-columns: repeat(4, 1fr); padding: 0; list-style: none; counter-reset: step; }
  .steps li { position: relative; padding-top: 18px; color: #9098a7; font-size: 7px; text-align: center; }
  .steps li::before { position: absolute; top: 3px; left: 50%; z-index: 1; width: 9px; height: 9px; content: ''; background: #dfe3e9; border: 2px solid #fff; border-radius: 50%; transform: translateX(-50%); }
  .steps li::after { position: absolute; top: 7px; right: 50%; width: 100%; height: 1px; content: ''; background: #dfe3e9; }
  .steps li:first-child::after { display: none; }
  .steps li.done { color: #5148d8; }
  .steps li.done::before, .steps li.done::after { background: #655bdc; }
  .request-card, .action-panel, .ready-panel, .audit { display: grid; gap: 9px; padding: 10px; background: #fff; border: 1px solid #e2e5ea; border-radius: 8px; }
  .request-list { padding: 9px; background: #f8f9fb; border: 1px solid #e3e6eb; border-radius: 8px; }
  .request-list > div:last-child { display: grid; gap: 5px; }
  .request-list > div:last-child button { display: flex; align-items: center; justify-content: space-between; text-align: left; }
  .request-list > div:last-child button.active { color: #4338ca; background: #f0efff; border-color: #7770e5; }
  .request-list small { font-size: 7px; }
  .request-card h3 { margin-top: 2px; color: #30394a; font-size: 12px; }
  .status { padding: 4px 7px; color: #92400e; background: #fef3c7; border-radius: 999px; font-size: 7px; white-space: nowrap; }
  .status.fulfilled { color: #047857; background: #d1fae5; }
  .status.rejected { color: #b91c1c; background: #fee2e2; }
  dl { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
  dl div { display: grid; gap: 2px; }
  dt { color: #9aa1ae; font-size: 7px; }
  dd { margin: 0; color: #4b5566; font-size: 8px; }
  code { overflow: hidden; padding: 6px 7px; color: #5148d8; background: #f4f3ff; border-radius: 5px; font-size: 7px; text-overflow: ellipsis; }
  .warning, .error { padding: 8px; color: #9a3412; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; font-size: 8px; }
  .button-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .candidate { padding: 8px; background: #f8f9fb; border: 1px solid #e5e8ed; border-radius: 6px; }
  .candidate strong, .action-panel > strong, .ready-panel strong, .audit strong { color: #3b4455; font-size: 9px; }
  .candidate span { padding: 3px 5px; color: #6d5fd2; background: #eeecff; border-radius: 999px; font-size: 7px; }
  .candidate small { color: #8790a0; font-size: 7px; line-height: 1.5; }
  .candidate.selectable { display: flex; grid-template-columns: auto 1fr; align-items: center; }
  .candidate.selectable input { width: auto; }
  .candidate.selectable span { display: grid; gap: 3px; padding: 0; background: transparent; }
  .candidate-choice { display: grid; grid-template-columns: auto 1fr; align-items: start; font-weight: 400; }
  .candidate-choice > input { width: auto; margin-top: 3px; }
  .candidate-choice > span { display: grid; gap: 4px; }
  .candidate-title { display: flex; align-items: center; justify-content: space-between; }
  .candidate-title em { padding: 3px 5px; color: #6d5fd2; background: #eeecff; border-radius: 999px; font-size: 7px; font-style: normal; }
  .no-candidate { padding: 8px; color: #7c8594; background: #f7f8fa; border-radius: 6px; font-size: 8px; }
  .ready-panel { color: #047857; background: #ecfdf5; border-color: #a7f3d0; }
  .audit > div:not(.action-heading) { display: flex; gap: 7px; }
  .audit i { width: 7px; height: 7px; margin-top: 3px; background: #7770e5; border: 2px solid #eeecff; border-radius: 50%; }
  .audit span { display: grid; gap: 2px; }
  .audit small { color: #959ca8; font-size: 7px; }
</style>
