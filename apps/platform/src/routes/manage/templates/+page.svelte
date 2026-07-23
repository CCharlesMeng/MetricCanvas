<script lang="ts">
  import { onMount } from 'svelte';

  interface TemplateRevision {
    revisionId: string;
    revisionNumber: number;
    templateId: string;
    title: string;
    description: string;
    tags: string[];
    viewerSubjectIds: string[];
    source: { pageId: string; revisionId: string };
  }

  interface TemplateListItem {
    templateId: string;
    latestRevision: TemplateRevision;
    publishedRevision: TemplateRevision | null;
  }

  interface PageListItem {
    pageId: string;
    publishedRevision: { revisionId: string } | null;
  }

  let templates = $state<TemplateListItem[]>([]);
  let pages = $state<PageListItem[]>([]);
  let selectedTemplateId = $state('');
  let templateId = $state('');
  let title = $state('');
  let description = $state('');
  let tags = $state('');
  let viewers = $state('developer-1');
  let sourceValue = $state('');
  let loading = $state(true);
  let saving = $state(false);
  let publishing = $state(false);
  let error = $state('');
  let notice = $state('');

  const selected = $derived(
    templates.find((template) => template.templateId === selectedTemplateId) ?? null
  );
  const publishedPages = $derived(
    pages.filter(
      (page): page is PageListItem & { publishedRevision: { revisionId: string } } =>
        page.publishedRevision !== null
    )
  );

  onMount(() => {
    void load();
  });

  async function load() {
    loading = true;
    error = '';
    try {
      const [templateResponse, pageResponse] = await Promise.all([
        fetch('/api/templates'),
        fetch('/api/pages')
      ]);
      if (!templateResponse.ok) throw new Error(await responseMessage(templateResponse));
      if (!pageResponse.ok) throw new Error(await responseMessage(pageResponse));
      templates = ((await templateResponse.json()) as { templates: TemplateListItem[] }).templates;
      pages = ((await pageResponse.json()) as { pages: PageListItem[] }).pages;
      sourceValue ||= publishedPages[0]
        ? sourceKey(
            publishedPages[0].pageId,
            publishedPages[0].publishedRevision.revisionId
          )
        : '';
    } catch (cause) {
      error = cause instanceof Error ? cause.message : '页面模板加载失败';
    } finally {
      loading = false;
    }
  }

  function chooseTemplate(value: string) {
    selectedTemplateId = value;
    const template = templates.find((candidate) => candidate.templateId === value);
    if (!template) {
      templateId = '';
      title = '';
      description = '';
      tags = '';
      viewers = 'developer-1';
      sourceValue = publishedPages[0]
        ? sourceKey(
            publishedPages[0].pageId,
            publishedPages[0].publishedRevision.revisionId
          )
        : '';
      return;
    }
    const revision = template.latestRevision;
    templateId = template.templateId;
    title = revision.title;
    description = revision.description;
    tags = revision.tags.join(', ');
    viewers = revision.viewerSubjectIds.join(', ');
    sourceValue = sourceKey(revision.source.pageId, revision.source.revisionId);
  }

  async function saveTemplate() {
    const source = sourceReference(sourceValue);
    if (!templateId.trim() || !title.trim() || !source) return;
    saving = true;
    error = '';
    notice = '';
    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          templateId: templateId.trim(),
          baseRevisionId: selected?.latestRevision.revisionId ?? null,
          title: title.trim(),
          description: description.trim(),
          tags: splitList(tags),
          viewerSubjectIds: splitList(viewers),
          source,
          idempotencyKey: crypto.randomUUID()
        })
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      notice = selected ? '已追加模板修订。' : '已创建页面模板。';
      selectedTemplateId = templateId.trim();
      await load();
      chooseTemplate(selectedTemplateId);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : '保存模板修订失败';
    } finally {
      saving = false;
    }
  }

  async function requestPublish() {
    if (!selected) return;
    publishing = true;
    error = '';
    try {
      const response = await fetch(
        `/api/templates/${encodeURIComponent(selected.templateId)}/publish`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            revisionId: selected.latestRevision.revisionId,
            idempotencyKey: crypto.randomUUID()
          })
        }
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      const result = (await response.json()) as {
        ok: true;
        request: { confirmationUrl: string };
      };
      window.location.assign(result.request.confirmationUrl);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : '申请发布页面模板失败';
      publishing = false;
    }
  }

  function sourceKey(pageId: string, revisionId: string) {
    return `${pageId}\u001f${revisionId}`;
  }

  function sourceReference(value: string) {
    const [pageId, revisionId] = value.split('\u001f');
    return pageId && revisionId ? { pageId, revisionId } : null;
  }

  function splitList(value: string) {
    return [...new Set(value.split(/[,，]/u).map((item) => item.trim()).filter(Boolean))];
  }

  async function responseMessage(response: Response): Promise<string> {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    return payload?.error?.message ?? `HTTP ${response.status}`;
  }
</script>

<svelte:head>
  <title>页面模板管理 | MetricCanvas</title>
</svelte:head>

<main>
  <header>
    <div>
      <p class="eyebrow">管理</p>
      <h1>页面模板</h1>
      <p>模板修订只引用精确的已发布页面修订，不复制页面文档。</p>
    </div>
    <a href="/manage">返回看板页面</a>
  </header>

  {#if loading}
    <p>加载页面模板…</p>
  {:else}
    {#if error}<p class="error">{error}</p>{/if}
    {#if notice}<p class="notice">{notice}</p>{/if}

    <div class="layout">
      <aside>
        <button class:active={!selectedTemplateId} onclick={() => chooseTemplate('')}>
          ＋ 新建页面模板
        </button>
        {#each templates as template (template.templateId)}
          <button
            class:active={selectedTemplateId === template.templateId}
            onclick={() => chooseTemplate(template.templateId)}
          >
            <strong>{template.latestRevision.title}</strong>
            <span>{template.templateId}</span>
            <small>
              最新 R{template.latestRevision.revisionNumber} ·
              {template.publishedRevision ? `已发布 R${template.publishedRevision.revisionNumber}` : '未发布'}
            </small>
          </button>
        {/each}
      </aside>

      <section>
        <h2>{selected ? `追加“${selected.latestRevision.title}”的模板修订` : '创建页面模板'}</h2>
        <label>
          模板 id
          <input bind:value={templateId} disabled={Boolean(selected)} placeholder="sales-overview" />
        </label>
        <label>
          标题
          <input bind:value={title} placeholder="销售经营概览模板" />
        </label>
        <label>
          说明
          <textarea bind:value={description} rows="3"></textarea>
        </label>
        <label>
          标签（逗号分隔）
          <input bind:value={tags} placeholder="销售, 经营, 概览" />
        </label>
        <label>
          模板 ACL：可使用主体（逗号分隔）
          <input bind:value={viewers} placeholder="developer-1" />
        </label>
        <label>
          引用已发布页面修订
          <select bind:value={sourceValue}>
            {#each publishedPages as page}
              <option value={sourceKey(page.pageId, page.publishedRevision.revisionId)}>
                {page.pageId} · {page.publishedRevision.revisionId}
              </option>
            {/each}
          </select>
        </label>
        <div class="actions">
          <button
            class="primary"
            onclick={saveTemplate}
            disabled={saving || !templateId.trim() || !title.trim() || !sourceValue || splitList(viewers).length === 0}
          >
            {saving ? '保存中…' : selected ? '追加模板修订' : '创建模板'}
          </button>
          {#if selected}
            <button
              onclick={requestPublish}
              disabled={publishing || selected.publishedRevision?.revisionId === selected.latestRevision.revisionId}
            >
              {publishing
                ? '申请中…'
                : selected.publishedRevision?.revisionId === selected.latestRevision.revisionId
                  ? '当前修订已发布'
                  : '申请发布最新修订'}
            </button>
          {/if}
        </div>
      </section>
    </div>
  {/if}
</main>

<style>
  main { max-width: 1180px; margin: 0 auto; padding: 34px 24px 72px; }
  header { display: flex; justify-content: space-between; gap: 24px; align-items: start; margin-bottom: 24px; }
  header h1 { margin: 4px 0; }
  header p { color: #71717a; }
  header a { color: #3f3f46; }
  .eyebrow { margin: 0; color: #4f46e5; font-size: 12px; font-weight: 800; letter-spacing: .08em; }
  .layout { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 18px; }
  aside, section { padding: 16px; border: 1px solid #e4e4e7; border-radius: 12px; background: #fff; }
  aside { display: grid; align-content: start; gap: 8px; }
  aside button { display: grid; gap: 4px; padding: 12px; text-align: left; color: #3f3f46; background: #fafafa; border: 1px solid #e4e4e7; border-radius: 8px; cursor: pointer; }
  aside button.active { border-color: #6366f1; background: #eef2ff; }
  aside span, aside small { color: #71717a; overflow-wrap: anywhere; }
  section { display: grid; align-content: start; gap: 14px; }
  h2 { margin: 0 0 4px; font-size: 20px; }
  label { display: grid; gap: 6px; color: #52525b; font-size: 13px; font-weight: 700; }
  input, textarea, select { width: 100%; box-sizing: border-box; padding: 9px 10px; color: #27272a; background: #fff; border: 1px solid #d4d4d8; border-radius: 7px; font: inherit; }
  input:disabled { background: #f4f4f5; }
  .actions { display: flex; gap: 10px; margin-top: 6px; }
  .actions button { padding: 9px 13px; border: 1px solid #d4d4d8; border-radius: 7px; background: #fff; cursor: pointer; }
  .actions .primary { color: #fff; background: #27272a; border-color: #27272a; }
  button:disabled { cursor: not-allowed; opacity: .55; }
  .error, .notice { padding: 10px 12px; border-radius: 8px; }
  .error { color: #b91c1c; background: #fef2f2; }
  .notice { color: #166534; background: #f0fdf4; }
  @media (max-width: 760px) {
    .layout { grid-template-columns: 1fr; }
    header { flex-direction: column; }
  }
</style>
