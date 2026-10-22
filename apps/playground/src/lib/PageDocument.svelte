<script lang="ts">
  let { pageId, document }: { pageId: string; document: unknown } = $props();
  const json = $derived(JSON.stringify(document, null, 2));
</script>

<aside class="page-document" aria-label="页面 JSON">
  <details>
    <summary>查看页面 JSON</summary>
    <div class="document-content">
      <a download={`${pageId}.json`} href={`data:application/json;charset=utf-8,${encodeURIComponent(json)}`}>下载完整 JSON</a>
      <pre>{json}</pre>
    </div>
  </details>
</aside>

<style>
  .page-document { margin: 16px 24px; border: 1px solid #d4d4d8; border-radius: 8px; background: white; color: #3f3f46; font-size: 13px; line-height: 1.7; }
  summary { cursor: pointer; padding: 12px 16px; }
  .document-content { padding: 12px 20px 20px; border-top: 1px solid #e4e4e7; }
  pre { max-height: 50vh; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; }
  a { color: #3730a3; }
  @media (max-width: 640px) { .page-document { margin: 12px; } }
</style>
