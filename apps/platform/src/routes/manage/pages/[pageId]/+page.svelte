<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { goto } from '$app/navigation';
  import { pageAssets } from '$lib/page-assets';
  import { createAssetManagement } from '$lib/page-assets/management';
  import type { PageRevision, DraftHistoryEntry, AssetRef } from '$lib/page-assets/contract';
  import RevisionPreview from '$lib/RevisionPreview.svelte';
  let revision = $state<PageRevision | null>(null), history = $state<DraftHistoryEntry[]>([]);
  let loading=$state(true), busy=$state(false), error=$state(''), historyError=$state(''), notice=$state('');
  const manager = createAssetManagement(pageAssets);
  const pageId = $derived(page.params.pageId ?? '');
  const asset = (): AssetRef => ({pageId,resourceId:revision!.resourceId!});
  onMount(() => { void load(); });
  async function load() {
    loading=true;error='';historyError='';
    try {
      const resourceId=page.url.searchParams.get('resource');
      revision=await pageAssets.read(resourceId ? {pageId,resourceId} : await pageAssets.resolve(pageId));
      try { history=await pageAssets.history(asset()); } catch(e) {historyError=String(e);}
    } catch(e) {error=String(e);} finally {loading=false;}
  }
  async function restore(version:number) {
    if(busy || !window.confirm(`回退到草稿版本 ${version}？请确保其他窗口没有正在修改此页面。`)) return;
    busy=true;error='';
    try {
      const result=await manager.restore(asset(),version);
      if(result.status==='confirmed') {revision=result.value;notice='已回退，当前页面已更新。';history=await pageAssets.history(asset());}
      else error=result.message;
    } catch(e) {error=String(e);} finally {busy=false;}
  }
  async function remove() {
    if(busy || !window.confirm('删除此页面记录？')) return;
    busy=true;error='';
    try {const result=await manager.remove(asset());if(result.status==='confirmed') await goto(resolve('/manage'));else error=result.message;}
    catch(e) {error=String(e);} finally {busy=false;}
  }
</script>
<svelte:head><title>页面管理 | MetricCanvas</title></svelte:head>
<section class="management">
  <a href={resolve('/manage')}>← 页面列表</a>
  <h1>{revision?.document.meta?.description || pageId}</h1>
  {#if error}<p role="alert">{error}</p>{/if}
  {#if notice}<p role="status">{notice}</p>{/if}
  {#if loading}<p>加载页面…</p>{:else if revision}
    <p>R{revision.revisionNumber} · {revision.isDraft === true ? '草稿' : revision.isDraft === false ? '已发布' : '状态未知'}</p>
    <a href={`${resolve('/')}?page=${encodeURIComponent(pageId)}&resource=${encodeURIComponent(revision.resourceId!)}`}>编辑当前页面</a>
    <button disabled={busy} onclick={load}>刷新</button><button disabled={busy} onclick={remove}>删除页面</button>
    <h2>草稿历史</h2>
    {#if historyError}<p role="alert">{historyError}</p>{/if}
    <p>可恢复指定草稿版本；接口不提供历史正文预览。</p>
    <ol>{#each history as item (item.historyId)}<li>版本 {item.draftVersion} · {item.comment || item.description} · {item.createdBy} · {item.createdAt} <button disabled={busy} onclick={() => restore(item.draftVersion)}>恢复此版本</button></li>{/each}</ol>
    <h2>当前读取内容预览</h2>
    {#key revision.revisionId}<RevisionPreview {pageId} revisionId={revision.revisionId} readRevision={async () => revision!}/>{/key}
  {:else}<button onclick={load}>重试</button>{/if}
</section>
<style>
  .management { max-width: 1120px; margin: 0 auto; padding: 32px 24px 72px; }
  button, a { margin-right: 12px; }
  li { margin-block: 12px; }
  [role="alert"] { color: var(--danger, #b91c1c); }
</style>
