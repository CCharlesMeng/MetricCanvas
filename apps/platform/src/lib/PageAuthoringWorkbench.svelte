<script lang="ts">
  import type {
    AgentInteraction,
    AgentMessage
  } from '@metriccanvas/agent-runner';
  import type { Page } from '@metriccanvas/page';

  interface AgentResponse {
    messages?: AgentMessage[];
    interaction?: AgentInteraction;
    document?: Record<string, unknown>;
    runtimeOrigin?: string;
    error?: { code: string; message: string };
  }

  let intent = $state(
    '创建销售经营概览：展示成交总额、区域对比和成交趋势'
  );
  let messages = $state<AgentMessage[]>([]);
  let draft = $state<Page | null>(null);
  let interaction = $state<AgentInteraction | null>(null);
  let confirmedPageIds = $state<string[]>([]);
  let baseRevisionId = $state<string | null>(null);
  let previewUrl = $state('');
  let pending = $state(false);
  let notice = $state('');
  let error = $state('');
  const runId = crypto.randomUUID();

  async function askAgent() {
    const text = intent.trim();
    if (!text || pending) return;
    messages = [...messages, { role: 'user', content: text }];
    intent = '';
    await runAgent();
  }

  async function runAgent() {
    pending = true;
    error = '';
    notice = '';
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          runId,
          messages,
          confirmations: confirmedPageIds.map((pageId) => ({
            kind: 'page_id',
            pageId
          })),
          ...(draft ? { draft } : {})
        })
      });
      const payload = (await response.json()) as AgentResponse;
      if (!response.ok || payload.error) {
        throw new Error(payload.error?.message ?? `Agent 请求失败:${response.status}`);
      }
      messages = payload.messages ?? messages;
      interaction = payload.interaction ?? null;
      if (payload.document) draft = payload.document as unknown as Page;
      if (payload.runtimeOrigin) {
        previewUrl = previewUrl || payload.runtimeOrigin;
      }
      notice = draft ? '工作副本已更新并通过 v4 Schema 校验。' : 'Agent 已完成。';
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      pending = false;
    }
  }

  async function confirmPageId() {
    if (!interaction || interaction.kind !== 'confirm_page_id') return;
    const pageId = String(interaction.payload.pageId ?? '');
    if (!pageId) return;
    confirmedPageIds = [...new Set([...confirmedPageIds, pageId])];
    interaction = null;
    await runAgent();
  }

  async function save() {
    if (!draft || pending) return;
    pending = true;
    error = '';
    try {
      const response = await fetch(
        `/api/pages/${encodeURIComponent(draft.id)}/revisions`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            baseRevisionId,
            document: draft,
            idempotencyKey: crypto.randomUUID()
          })
        }
      );
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message ?? `保存失败:${response.status}`);
      }
      baseRevisionId = payload.revision.revisionId;
      previewUrl =
        `${payload.runtimeOrigin}/pages/${encodeURIComponent(draft.id)}` +
        `?revision=${encodeURIComponent(baseRevisionId!)}`;
      notice = `已保存 R${payload.revision.revisionNumber}，数据上下文版本：` +
        `${payload.revision.dataContextVersion ?? '纯静态页面'}`;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      pending = false;
    }
  }
</script>

<svelte:head>
  <title>MetricCanvas 页面搭建工作台</title>
</svelte:head>

<div class="workbench">
  <aside>
    <p class="eyebrow">AI 页面搭建</p>
    <h1>从数据上下文或静态数据生成 v4 页面</h1>
    <textarea bind:value={intent} rows="6" placeholder="描述分析目标、数据场景和希望呈现的内容"></textarea>
    <button class="primary" disabled={pending || !intent.trim()} onclick={askAgent}>
      {pending ? '处理中…' : '生成 / 修改页面'}
    </button>
    {#if interaction?.kind === 'confirm_page_id'}
      <div class="confirm">
        <strong>确认页面 id</strong>
        <code>{String(interaction.payload.pageId ?? '')}</code>
        <button onclick={confirmPageId}>确认并继续</button>
      </div>
    {/if}
    {#if draft}
      <button disabled={pending} onclick={save}>
        {baseRevisionId ? '保存新修订' : '保存首个修订'}
      </button>
    {/if}
    {#if notice}<p class="notice">{notice}</p>{/if}
    {#if error}<p class="error">{error}</p>{/if}
  </aside>

  <main>
    {#if previewUrl && baseRevisionId}
      <iframe title="统一运行时精确修订预览" src={previewUrl}></iframe>
    {:else if draft}
      <header>
        <div>
          <span class="badge">schemaVersion {draft.schemaVersion}</span>
          <h2>{draft.id}</h2>
          <p>{draft.meta?.description ?? '未保存工作副本'}</p>
        </div>
        <span>{Object.keys(draft.dataSources).length} 个页面数据源</span>
      </header>
      {#each draft.sections as section}
        <section>
          <h3>{section.title ?? section.id}</h3>
          <div class="components">
            {#each section.components as component}
              <article>
                <code>{component.type}</code>
                <strong>{component.id}</strong>
                <small>跨度 {component.layout.span}/12</small>
              </article>
            {/each}
          </div>
        </section>
      {/each}
    {:else}
      <div class="empty">
        <h2>描述你要解决的业务问题</h2>
        <p>静态报告会使用 inline；动态取数会先检索数据上下文并生成 DQE 查询定义。</p>
      </div>
    {/if}
  </main>
</div>

<style>
  .workbench { display: grid; grid-template-columns: 340px minmax(0, 1fr); min-height: calc(100vh - 54px); }
  aside { padding: 28px; background: white; border-right: 1px solid #e4e4e7; }
  .eyebrow, .badge { color: #4f46e5; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  h1 { font-size: 24px; line-height: 1.2; margin: 8px 0 22px; }
  textarea { width: 100%; resize: vertical; border: 1px solid #d4d4d8; border-radius: 10px; padding: 12px; font: inherit; }
  button { width: 100%; margin-top: 10px; border: 1px solid #d4d4d8; border-radius: 9px; padding: 10px 14px; background: white; font-weight: 650; cursor: pointer; }
  button.primary { color: white; background: #4f46e5; border-color: #4f46e5; }
  button:disabled { opacity: .55; cursor: not-allowed; }
  .confirm { margin-top: 14px; padding: 12px; border-radius: 10px; background: #eef2ff; }
  .confirm code { display: block; margin-top: 6px; }
  .notice { color: #166534; }
  .error { color: #b91c1c; }
  main { min-width: 0; padding: 28px; }
  iframe { width: 100%; height: calc(100vh - 110px); border: 0; border-radius: 14px; background: white; }
  header { display: flex; justify-content: space-between; gap: 20px; align-items: start; margin-bottom: 24px; }
  h2, h3 { margin: 6px 0; }
  header p { color: #71717a; margin: 0; }
  section { margin: 18px 0; padding: 18px; border-radius: 14px; background: white; }
  .components { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  article { display: grid; gap: 8px; padding: 14px; border: 1px solid #e4e4e7; border-radius: 10px; }
  article code { color: #4f46e5; }
  article small { color: #71717a; }
  .empty { display: grid; place-content: center; min-height: 60vh; text-align: center; color: #71717a; }
  @media (max-width: 800px) {
    .workbench { grid-template-columns: 1fr; }
    aside { border-right: 0; border-bottom: 1px solid #e4e4e7; }
    .components { grid-template-columns: 1fr; }
  }
</style>
