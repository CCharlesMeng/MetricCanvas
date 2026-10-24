<script lang="ts">
 import {createReadingRuntimeNavigation} from '../integration/reading-navigation';
 import {createHref} from '../integration/routes';
 import ReadingHeader from '../ReadingHeader.svelte';import ToolAction from '../ToolAction.svelte';import {parsePage,pageListEntry} from '@metriccanvas/page/internal';import {onMount} from 'svelte';import {usePlatformServices} from '../integration/services';import type {PageRevision} from '../page-assets/contract';import RevisionPreview from '../RevisionPreview.svelte';
 const services=usePlatformServices();const {pageAssets}=services;const {navigate}=services.navigation;
 const runtimeNavigation=createReadingRuntimeNavigation(services);let inputSearch=$state('');
 let {pageId,resourceId,editable=true}:{pageId:string;resourceId:string|null;editable?:boolean}=$props();let revision=$state<PageRevision|null>(null);let loading=$state(true),error=$state('');const controller=new AbortController();
 const title=$derived.by(()=>{if(!revision)return pageId;const parsed=parsePage(revision.document);return parsed.ok?pageListEntry(parsed.page).title:pageId;});
 onMount(()=>{const stop=services.navigation.subscribe(url=>{const query=new URLSearchParams(url.search);query.delete('resource');inputSearch=query.toString();});void load();return()=>{stop();controller.abort();};});
 async function load(){loading=true;error='';try{const value=await pageAssets.read(resourceId?{pageId,resourceId}:await pageAssets.resolve(pageId,controller.signal),controller.signal);if(!controller.signal.aborted)revision=value;}catch(cause){if(!controller.signal.aborted)error=String(cause);}finally{if(!controller.signal.aborted)loading=false;}}
</script>
<section class="reading">
<ReadingHeader {title} source="已保存内容" revision={revision?.revisionNumber} status={revision?(revision.isDraft===false?'已发布':revision.isDraft===true?'草稿':'状态待核实'):undefined} backLabel="返回页面管理" onback={()=>navigate(services.workSession.snapshot().directory)}>
  {#if revision&&editable}<a class="edit-link" aria-label="进入编辑" href={createHref(services.navigation.base,{pageId,resourceId:revision.resourceId!})}>编辑</a>{/if}
</ReadingHeader>
<div class="reading-content">
{#if error}<p role="alert">{error}</p>{/if}
{#if loading}<p role="status">正在读取页面…</p>{:else if revision}
 {#key revision.revisionId+':'+inputSearch}<RevisionPreview initialSearch={inputSearch} navigation={runtimeNavigation} {pageId} revisionId={revision.revisionId} readRevision={async()=>revision!}/>{/key}
{:else}<ToolAction onclick={load}>重试</ToolAction>{/if}
</div></section>
<style>
.reading{height:100%;display:flex;flex-direction:column;min-height:0;background:#f5f5f5}.reading-content{flex:1;min-height:0;overflow:auto;padding:24px}.edit-link{display:inline-flex;align-items:center;min-height:28px;font-size:14px;color:#1476ff;text-decoration:none}.edit-link:hover{text-decoration:underline}.edit-link:focus-visible{outline:2px solid #1476ff;outline-offset:2px}[role=alert]{color:#f23030}@media(max-width:700px){.reading-content{padding:16px}}
</style>
