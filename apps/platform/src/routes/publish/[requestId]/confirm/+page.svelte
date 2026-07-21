<script lang="ts">
  let { data, form } = $props();
</script>

<section>
  <p class="eyebrow">人工发布确认</p>
  <h1>确认发布 R{data.revision.revisionNumber}</h1>
  <p>请核对下面绑定的看板页面与精确修订。确认后稳定页面 URL 将切换到该修订。</p>

  <dl>
    <div>
      <dt>发布请求</dt>
      <dd><code>{data.request.requestId}</code></dd>
    </div>
    <div>
      <dt>看板页面</dt>
      <dd><code>{data.request.pageId}</code></dd>
    </div>
    <div>
      <dt>页面修订</dt>
      <dd><code>R{data.revision.revisionNumber} · {data.request.revisionId}</code></dd>
    </div>
    <div>
      <dt>元数据版本</dt>
      <dd><code>{data.revision.metadataVersion}</code></dd>
    </div>
    <div>
      <dt>内容指纹</dt>
      <dd><code>{data.revision.contentHash}</code></dd>
    </div>
    <div>
      <dt>创建人</dt>
      <dd>{data.revision.createdBy} · {data.revision.createdAt}</dd>
    </div>
    <div>
      <dt>租约到期</dt>
      <dd><time datetime={data.request.expiresAt}>{data.request.expiresAt}</time></dd>
    </div>
    <div>
      <dt>当前状态</dt>
      <dd><code>{data.request.status}</code></dd>
    </div>
  </dl>

  <iframe title="待发布页面修订预览" src={data.previewUrl}></iframe>

  {#if form?.error}
    <div class="error">
      <strong>{form.error.code}</strong>
      <span>{form.error.message}</span>
    </div>
  {/if}

  {#if form?.success}
    <div class="success">
      <strong>发布成功</strong>
      <span>R{data.revision.revisionNumber} · {form.revisionId} 已成为当前发布修订。</span>
      <a href={form.publishedUrl}>打开稳定页面 URL</a>
    </div>
  {:else if data.request.status === 'pending'}
    <form method="POST">
      <button type="submit">确认发布 R{data.revision.revisionNumber}</button>
    </form>
  {:else}
    <div class="closed">
      发布请求已经结束，当前状态为 <code>{data.request.status}</code>。
    </div>
  {/if}
</section>

<style>
  section {
    width: min(720px, calc(100% - 32px));
    margin: 48px auto;
    padding: 28px;
    background: #fff;
    border: 1px solid #e4e4e7;
    border-radius: 14px;
    box-shadow: 0 12px 32px rgb(24 24 27 / 8%);
  }
  .eyebrow {
    margin: 0;
    color: #2563eb;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  h1 {
    margin: 8px 0 12px;
    font-size: 26px;
  }
  p {
    color: #52525b;
    line-height: 1.7;
  }
  code {
    color: #18181b;
  }
  button {
    border: 0;
    border-radius: 8px;
    padding: 10px 18px;
    color: #fff;
    background: #18181b;
    font: inherit;
    font-weight: 650;
    cursor: pointer;
  }
  .error,
  .success,
  .closed {
    display: grid;
    gap: 6px;
    margin: 20px 0;
    padding: 14px;
    border-radius: 9px;
  }
  .error {
    color: #991b1b;
    background: #fef2f2;
    border: 1px solid #fecaca;
  }
  .success {
    color: #166534;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
  }
  .closed {
    color: #3f3f46;
    background: #f4f4f5;
    border: 1px solid #d4d4d8;
  }
  .success a {
    color: #166534;
    font-weight: 650;
  }
  dl {
    display: grid;
    gap: 8px;
    margin: 20px 0;
  }
  dl > div {
    display: grid;
    grid-template-columns: 92px minmax(0, 1fr);
    gap: 12px;
    align-items: baseline;
  }
  dt {
    color: #71717a;
    font-size: 13px;
    font-weight: 650;
  }
  dd {
    min-width: 0;
    margin: 0;
    overflow-wrap: anywhere;
  }
  iframe {
    width: 100%;
    min-height: 360px;
    margin: 4px 0 20px;
    border: 1px solid #e4e4e7;
    border-radius: 10px;
    background: #fafafa;
  }
</style>
