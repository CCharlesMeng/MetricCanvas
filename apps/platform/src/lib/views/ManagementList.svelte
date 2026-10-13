<script lang="ts">
  import PrimaryAction from '../PrimaryAction.svelte';
 import {Tag,Grid,Pagination} from '@metriccanvas/ui';
 import StatusColumnFilter from '../StatusColumnFilter.svelte';
 import ToolAction from '../ToolAction.svelte';import {usePlatformServices} from '../integration/services';import {onMount,tick} from 'svelte';import type {AssetSummary} from '../page-assets/contract';
 const services=usePlatformServices();const {pageAssets}=services;const {resolve,navigate}=services.navigation;const initial=services.navigation.current();
 let pages=$state<AssetSummary[]>([]);let loading=$state(true),error=$state(''),total=$state(0);
 let pageNo=$state(Math.max(1,Number(initial.searchParams.get('page'))||1));let status=$state(['draft','published'].includes(initial.searchParams.get('state')??'')?initial.searchParams.get('state')!:'');let list:HTMLElement;let request=0;const controller=new AbortController();
 const preview=(page:AssetSummary)=>`${resolve('/manage/pages/[pageId]',{pageId:page.pageId})}?resource=${encodeURIComponent(page.resourceId)}&reading=1`;
 const edit=(page:AssetSummary)=>`${resolve('/')}?page=${encodeURIComponent(page.pageId)}&resource=${encodeURIComponent(page.resourceId)}`;
 function locationFor(page:number,state:string){const query=new URLSearchParams();query.set('page',String(page));if(state)query.set('state',state);return `${resolve('/manage')}?${query}`;}
 async function change(page:number,state:string){await navigate(locationFor(page,state));}
 onMount(()=>{const old=services.workSession.snapshot();void load().then(async()=>{await tick();if(controller.signal.aborted||error)return;const previous=new URL(old.directory,initial);const sameDirectory=previous.pathname===initial.pathname&&['page','state'].every(key=>(previous.searchParams.get(key)??'')===(initial.searchParams.get(key)??''));if(!sameDirectory)return;const target=[...list.querySelectorAll<HTMLElement>('[data-asset-focus]')].find(element=>element.dataset.assetFocus===old.focus);target?.focus({preventScroll:true});list.scrollTop=old.scroll;});const stop=services.navigation.registerGuard(async()=>{try{await services.workSession.rememberDirectory(services.navigation.current(),list.scrollTop,(document.activeElement as HTMLElement)?.dataset.assetFocus??null);return true;}catch(cause){error=String(cause);return false;}},()=>false);return()=>{request++;controller.abort();stop();};});
 function displayDate(value:string){if(!value)return '—';const date=new Date(value);return Number.isNaN(date.valueOf())?value:new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(date).replaceAll('/','-');}
 async function load(){const id=++request;loading=true;error='';try{const result=await pageAssets.list({page:pageNo,pageSize:20,...(status==='draft'||status==='published'?{state:status}:{})},controller.signal);if(id===request){pages=result.items;total=result.total;}}catch(cause){if(id===request)error=String(cause);}finally{if(id===request)loading=false;}}
</script>
{#snippet statusHeader()}
  <StatusColumnFilter value={status} onchange={value=>change(1,value)}/>
{/snippet}
<section bind:this={list} class="management">
  <header><h1>页面管理</h1></header>
  <div class="management-panel">
    <div class="table-toolbar" aria-label="页面目录操作"><PrimaryAction onclick={()=>navigate(`${resolve('/')}?new=1`)}>新建页面</PrimaryAction><ToolAction icon="refresh" disabled={loading} onclick={load}>刷新</ToolAction></div>
    <Grid responsive="stack" rows={pages} headers={{state:statusHeader}} columns={[{key:'name',label:'页面',width:'24%'},{key:'state',label:'状态',width:'14%'},{key:'revision',label:'修订',width:'8%'},{key:'fields',label:'指标与维度',width:'20%'},{key:'created',label:'创建时间',width:'12%'},{key:'updated',label:'最近修改',width:'12%'},{key:'actions',label:'操作',width:'10%'}]} rowKey={page=>page.resourceId} {loading} {error} emptyText="当前筛选下暂无页面，可新建页面。" label="页面目录">
      {#snippet cell(page,column)}
        {#if column.key==='name'}<a data-asset-focus={page.resourceId} href={edit(page)} title={`页面 ID：${page.pageId}\n资源 ID：${page.resourceId}`}>{page.pageId}</a><p class="description" title={page.description}>{page.description||'暂无描述'}</p>
        {:else if column.key==='state'}<Tag type={page.state==='published'?'success':'info'}>{page.state==='published'?'已发布':page.state==='draft'?'草稿':'状态待核实'}</Tag>
        {:else if column.key==='revision'}<span title={page.revisionId}>R{page.revisionNumber}</span>
        {:else if column.key==='fields'}
          {#if page.supportedFields}<div class="field-summary" title={`指标：${page.supportedFields.metrics.join('、')||'无'}\n维度：${page.supportedFields.dimensions.join('、')||'无'}`}><span>{page.supportedFields.metrics.length} 个指标 · {page.supportedFields.dimensions.length} 个维度</span><p class="description">{[...page.supportedFields.metrics,...page.supportedFields.dimensions].join('、')||'无指标与维度'}</p></div>{:else}<span class="unavailable">未提供</span>{/if}
        {:else if column.key==='created'}<time datetime={page.createdAt}>{displayDate(page.createdAt??'')}</time>
        {:else if column.key==='updated'}<time datetime={page.updatedAt}>{displayDate(page.updatedAt)}</time>
        {:else}<div class="actions"><a class="row-action" href={preview(page)}>预览</a><a class="row-action" href={edit(page)}>编辑</a></div>{/if}
      {/snippet}
    </Grid>
    {#if error}<ToolAction onclick={load}>重试</ToolAction>{/if}
    <div class="pagination"><Pagination page={pageNo} {total} disabled={loading} onchange={page=>change(page,status)}/></div>
  </div>
</section>
<style>
.management{height:100%;overflow:auto;padding:24px;font-size:14px;line-height:1.5;color:#191919}header{margin-bottom:24px}h1{font-size:20px;line-height:28px;font-weight:600;margin:0}.management-panel{padding:24px;background:#fff;border-radius:8px;min-width:0}.table-toolbar{display:flex;align-items:center;gap:12px;margin-bottom:16px}.description{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:4px 0 0;color:#808080;font-size:12px;line-height:18px}.actions{display:flex;align-items:center;gap:16px}a{color:#191919;text-decoration:none;overflow-wrap:anywhere}a:hover{text-decoration:underline}.row-action{display:inline-flex;align-items:center;min-height:28px;color:#1476ff;font-size:14px;line-height:20px;white-space:nowrap}.row-action:hover{color:#0f5ed4}a:focus-visible{outline:2px solid #1476ff;outline-offset:2px;border-radius:2px}.pagination{display:flex;justify-content:flex-end;margin-top:24px}time{font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.unavailable{color:#808080}.field-summary{min-width:0}
@media(min-width:701px){.management :global(table){min-width:1080px}}
@media(max-width:700px){.management{padding:16px}.management-panel{padding:16px}header{margin-bottom:16px}.pagination{margin-top:16px;justify-content:flex-start}.management :global(td[data-column="fields"]){grid-column:1/-1}.management :global(td[data-column="revision"]::before),.management :global(td[data-column="created"]::before),.management :global(td[data-column="updated"]::before){display:block;content:attr(data-label);font-size:12px;color:#808080;margin-bottom:4px}}
</style>
