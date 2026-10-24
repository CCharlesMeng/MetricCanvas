<script lang="ts">
  import {onMount} from 'svelte';
  import {Button} from '@metriccanvas/ui';
  import PrimaryAction from '../PrimaryAction.svelte';
  import ToolAction from '../ToolAction.svelte';
  import PageInfoForm from './PageInfoForm.svelte';
  import {usePlatformServices} from '../integration/services';
  import type {PageInfoRecord} from '../integration/contract';
  import {infoChanges,validateInfo} from '../page-assets/info-edit';
  const services=usePlatformServices();
  let {pageId,resourceId}:{pageId:string;resourceId:string|null}=$props();
  let original=$state.raw<PageInfoRecord|null>(null),value=$state.raw<PageInfoRecord|null>(null);
  let loading=$state(true),busy=$state(false),error=$state(''),replace=$state(false);
  const controller=new AbortController();
  onMount(()=>{void load();return()=>controller.abort();});
  async function load(){try{const target=resourceId?{pageId,resourceId}:await services.pageAssets.resolve(pageId,controller.signal);const result=await services.pageInfo.read(target,controller.signal);if(!controller.signal.aborted){original=result;value=structuredClone(result);}}catch(cause){if(!controller.signal.aborted)error=String(cause);}finally{loading=false;}}
  async function save(){
    if(!value||!original||busy)return;
    error=validateInfo(value);if(error)return;
    if(!services.workSession.canMutate(original)){error='当前页面仍有未保存或正在执行的工作，请先在工作台处理。';return;}
    busy=true;
    try{await services.pageInfo.update(original,infoChanges(original,value,replace));await services.navigation.navigate(services.workSession.snapshot().directory);}
    catch(cause){error=String(cause);}finally{busy=false;}
  }
</script>
<section class="info-view"><header><ToolAction disabled={busy} onclick={()=>services.navigation.navigate(services.workSession.snapshot().directory)}>&lt; 返回</ToolAction><h1>编辑页面信息</h1></header>
{#if loading}<p role="status">正在读取页面信息…</p>{:else if value}<form onsubmit={event=>{event.preventDefault();void save();}}><PageInfoForm {value} disabled={busy} onchange={next=>value=next} onreplace={next=>replace=next}/><div class="actions"><PrimaryAction disabled={busy} onclick={save}>{busy?'保存中…':'保存信息'}</PrimaryAction><Button disabled={busy} onclick={()=>services.navigation.navigate(services.workSession.snapshot().directory)}>取消</Button></div></form>{/if}
{#if error}<p role="alert">{error}</p>{/if}</section>
<style>.info-view{box-sizing:border-box;display:flex;flex-direction:column;gap:24px;padding:24px;overflow:auto;height:100%;background:#f5f5f5}header{display:flex;align-items:center;gap:24px;flex:none}h1{font-size:20px;margin:0}form{box-sizing:border-box;flex:1;width:100%;background:#fff;border-radius:8px;padding:24px}.actions{display:flex;gap:12px;margin-top:24px}[role=alert]{color:#f23030}</style>
