<script lang="ts">
  import PrimaryAction from '../PrimaryAction.svelte';
  import {onMount} from 'svelte';
  import {Dialog,Tag} from '@metriccanvas/ui';
  import ToolAction from '../ToolAction.svelte';
  import {usePlatformServices} from '../integration/services';
  import type {AssetRef,DraftHistoryEntry,PageRevision} from '../page-assets/contract';
  let {asset,disabled=false,onaction}:{asset:AssetRef;disabled?:boolean;onaction:(action:'remove'|'restore',version?:number)=>Promise<void>}=$props();
  const {pageAssets}=usePlatformServices();
  const controller=new AbortController();
  let revision=$state<PageRevision|null>(null),history=$state<DraftHistoryEntry[]>([]);
  let error=$state(''),historyError=$state(''),loading=$state(true),historyLoading=$state(false),historyLoaded=$state(false),busy=$state(false);
  let confirmation=$state<'remove'|'restore'|null>(null),restoreVersion=$state(0);
  async function read(){loading=true;error='';try{const value=await pageAssets.read(asset,controller.signal);if(!controller.signal.aborted)revision=value;}catch(cause){if(!controller.signal.aborted)error=String(cause);}finally{if(!controller.signal.aborted)loading=false;}}
  async function readHistory(){if(historyLoaded||historyLoading)return;historyLoading=true;historyError='';try{const value=await pageAssets.history(asset,controller.signal);if(!controller.signal.aborted){history=value;historyLoaded=true;}}catch(cause){if(!controller.signal.aborted)historyError=String(cause);}finally{if(!controller.signal.aborted)historyLoading=false;}}
  async function confirm(){if(disabled||busy||!confirmation)return;busy=true;error='';try{await onaction(confirmation,restoreVersion);confirmation=null;if(!controller.signal.aborted){historyLoaded=false;await read();}}catch(cause){if(!controller.signal.aborted)error=String(cause);}finally{busy=false;}}
  onMount(()=>{void read();return()=>controller.abort();});
</script>
<section class="asset-info" aria-label="页面信息">
  <div class="heading"><h3>页面信息</h3><ToolAction icon="refresh" iconOnly ariaLabel="刷新页面信息" disabled={loading||busy} onclick={read}/></div>
  {#if error}<p role="alert">{error}</p>{/if}
  {#if loading}<p role="status">正在读取页面信息…</p>{:else if revision}
    <dl><dt>页面 ID</dt><dd>{asset.pageId}</dd><dt>资源 ID</dt><dd>{asset.resourceId}</dd><dt>当前修订</dt><dd>R{revision.revisionNumber}</dd><dt>服务端状态</dt><dd><Tag type={revision.isDraft===false?'success':'info'}>{revision.isDraft===false?'已发布':revision.isDraft===true?'草稿':'状态待核实'}</Tag></dd></dl>
    <details ontoggle={event=>{if(event.currentTarget.open)void readHistory();}}><summary>页面历史</summary>
      {#if historyLoading}<p role="status">正在读取历史…</p>{:else if historyError}<p role="alert">{historyError}</p><ToolAction onclick={readHistory}>重试</ToolAction>
      {:else if historyLoaded&&!history.length}<p>暂无草稿历史。</p>{:else}{#each history as item(item.historyId)}<div class="history-row"><span>R{item.draftVersion} · {item.comment||item.description||'无备注'}</span><ToolAction disabled={disabled||busy} onclick={()=>{restoreVersion=item.draftVersion;confirmation='restore';}}>回退草稿</ToolAction></div>{/each}{/if}
      <p class="hint">当前展示草稿历史摘要；回退会修改当前草稿。</p>
    </details>
    <div class="remove"><ToolAction danger disabled={disabled||busy} onclick={()=>confirmation='remove'}>删除当前记录</ToolAction>{#if disabled}<span class="hint">请先处理未保存或未决工作。</span>{/if}</div>
  {/if}
  <Dialog open={confirmation!==null} title={confirmation==='remove'?'删除当前记录':'回退草稿'} onclose={()=>{if(!busy)confirmation=null;}}>
    <p>{confirmation==='remove'?'删除当前资源记录？此操作尚无整页所有修订永久删除保证，请确认没有其他窗口正在修改此页面。':`将当前草稿回退到版本 ${restoreVersion}。当前服务未保证追加新修订，请确认没有其他窗口正在修改此页面。`}</p>
    {#snippet footer()}<ToolAction disabled={busy} onclick={()=>confirmation=null}>取消</ToolAction><PrimaryAction variant={confirmation==='remove'?'danger':'primary'} disabled={disabled||busy} onclick={confirm}>{busy?'处理中…':'确认'}</PrimaryAction>{/snippet}
  </Dialog>
</section>
<style>
  .asset-info{padding-top:16px;border-top:1px solid #f0f0f0;margin-top:16px;font-size:14px;color:#595959}.heading{display:flex;align-items:center;justify-content:space-between}h3{font-size:14px;margin:0;color:#191919}dl{display:grid;grid-template-columns:100px minmax(0,1fr);gap:8px;margin:12px 0}dt{color:#808080}dd{margin:0;overflow-wrap:anywhere}details{padding:12px 0;border-top:1px solid #f0f0f0}summary{cursor:pointer;color:#191919;font-weight:500}summary:focus-visible{outline:2px solid #1476ff;outline-offset:2px}.hint{font-size:12px;color:#808080}.history-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 0}.remove{display:flex;align-items:center;gap:8px;flex-wrap:wrap;border-top:1px solid #f0f0f0;padding-top:12px}[role=alert]{color:#f23030}
</style>
