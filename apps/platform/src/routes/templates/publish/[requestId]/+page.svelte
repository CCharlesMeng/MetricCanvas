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
  .eyebrow { color: #4f46e5; font-size: 12px; font-weight: 800; letter-spacing: .08em; }
  h1 { margin: 8px 0; }
  dl { display: grid; gap: 10px; margin: 28px 0; padding: 20px; border: 1px solid #e4e4e7; border-radius: 12px; background: #fff; }
  dl div { display: grid; grid-template-columns: 140px 1fr; gap: 16px; }
  dt { color: #71717a; }
  dd { margin: 0; overflow-wrap: anywhere; }
  form, .success { display: flex; align-items: center; gap: 14px; }
  button, a { border-radius: 8px; padding: 9px 14px; font: inherit; text-decoration: none; }
  button { border: 0; color: #fff; background: #27272a; cursor: pointer; }
  a { color: #3f3f46; border: 1px solid #d4d4d8; }
  .success { padding: 16px; color: #166534; background: #f0fdf4; border-radius: 10px; }
  .error { color: #b91c1c; }
</style>
