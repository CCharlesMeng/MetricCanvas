<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head>
  <title>确认发布页面模板 | MetricCanvas</title>
</svelte:head>

<main>
  <p class="eyebrow">页面模板治理</p>
  <h1>确认发布“{data.revision.title}”</h1>
  <p>{data.revision.description || '无说明'}</p>

  <dl>
    <div><dt>模板 id</dt><dd>{data.revision.templateId}</dd></div>
    <div><dt>模板修订</dt><dd>R{data.revision.revisionNumber} · {data.revision.revisionId}</dd></div>
    <div><dt>来源页面修订</dt><dd>{data.revision.source.pageId} · {data.revision.source.revisionId}</dd></div>
    <div><dt>标签</dt><dd>{data.revision.tags.join('、') || '无'}</dd></div>
    <div><dt>模板 ACL</dt><dd>{data.revision.viewerSubjectIds.join('、')}</dd></div>
  </dl>

  {#if form?.success}
    <section class="success">
      <strong>页面模板已发布</strong>
      <a href="/manage/templates">返回模板管理</a>
    </section>
  {:else}
    {#if form?.error}<p class="error">{form.error.message}</p>{/if}
    <form method="POST">
      <button type="submit">确认发布此模板修订</button>
      <a href="/manage/templates">暂不发布</a>
    </form>
  {/if}
</main>

<style>
  main { max-width: 720px; margin: 0 auto; padding: 48px 24px; }
  .eyebrow { color: var(--accent); font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  h1 { margin: 8px 0; font-size: 22px; letter-spacing: -0.01em; }
  dl { display: grid; gap: 10px; margin: 28px 0; padding: 20px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
  dl div { display: grid; grid-template-columns: 140px 1fr; gap: 16px; }
  dt { color: var(--muted); }
  dd { margin: 0; overflow-wrap: anywhere; }
  form, .success { display: flex; align-items: center; gap: 14px; }
  button, a { border-radius: 9px; padding: 8px 14px; font: inherit; font-size: 13px; text-decoration: none; }
  button {
    border: 1px solid var(--accent);
    color: #fff;
    background: var(--accent);
    font-weight: 650;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  button:hover { background: var(--accent-strong); border-color: var(--accent-strong); }
  a { color: #3f3f46; border: 1px solid #d4d4d8; transition: border-color 0.15s ease; }
  a:hover { border-color: var(--faint); }
  .success { padding: 16px; color: #166534; background: #f0fdf4; border-radius: 10px; }
  .error { color: #b91c1c; }
</style>
