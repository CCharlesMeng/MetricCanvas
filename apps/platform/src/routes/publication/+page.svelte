<script lang="ts">
 import {dev} from '$app/environment';
 import {onMount} from 'svelte';
 import PublicationReview from '$lib/workbench/PublicationReview.svelte';
 import {createAuthoringPublication} from '$lib/workbench/authoring-publication';
 let publication=$state<ReturnType<typeof createAuthoringPublication>|null>(null);
 let mode=$state('success');
 let setMode:((mode:string)=>void)|undefined;
 let changeSource:(()=>void)|undefined;
 let counts=$state('');
 onMount(()=>{
  if(!dev)return;
  let disposed=false,cleanup=()=>{};
  void import('$lib/workbench/publication-fixture').then(({createPublicationFixture})=>{
   if(disposed)return;const fixture=createPublicationFixture();let scope='1';
   setMode=fixture.setMode;setMode(mode);publication=createAuthoringPublication({port:fixture.port,human:fixture.human,identity:()=>fixture.identity,synchronizedRef:()=>fixture.ref,scope:()=>scope});
   changeSource=()=>{scope+='x';publication?.invalidate();};
   const stop=publication.subscribe(()=>{counts=JSON.stringify(fixture.counts());});cleanup=()=>{stop();publication?.dispose();};
  });
  return()=>{disposed=true;cleanup();};
 });
</script>
{#if dev}
 <main class="lab"><p>明确的 Java / 人工确认边界替身，非真实服务。</p>
 <label>验收场景<select aria-label="发布验收场景" bind:value={mode} onchange={()=>setMode?.(mode)}>{#each ['success','blocking','expired','lease','forbidden','bad-proof','bad-result','conflict','lost-ack'] as option}<option>{option}</option>{/each}</select></label>
 <button onclick={()=>changeSource?.()}>模拟草稿已修改</button><output aria-label="替身调用计数">{counts}</output>
 {#if publication}<PublicationReview {publication}/>{/if}</main>
{:else}<p>发布组合验收入口仅供开发环境使用。</p>{/if}
<style>.lab{max-width:1080px;margin:24px auto;padding:16px}output{display:block;font-size:12px;margin:12px 0}</style>
