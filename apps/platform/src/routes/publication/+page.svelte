<script lang="ts">
 import {dev} from '$app/environment';
 import {onMount} from 'svelte';
 import PageAuthoringWorkbench from '$lib/PageAuthoringWorkbench.svelte';
 import type { createPublicationFixture } from '$lib/workbench/publication-fixture';
 import { confirmedPageAssetCapabilities, type AuthoringPort } from '$lib/workbench/authoring-coordinator';
 import type { PageRevision } from '$lib/page-assets/contract';
 import PublicationReview from '$lib/workbench/PublicationReview.svelte';
 import {createAuthoringPublication} from '$lib/workbench/authoring-publication';
 let publication=$state<ReturnType<typeof createAuthoringPublication>|null>(null);
 let mode=$state('success');
 let embedded=$state(false);
 let fixtureRef=$state.raw<ReturnType<typeof createPublicationFixture>|null>(null);
 let authoringPort=$state.raw<AuthoringPort|null>(null);
 let setMode:((mode:string)=>void)|undefined;
 let changeSource:(()=>void)|undefined;
 let counts=$state('');
 let inlineFixture=$state<typeof import('$lib/workbench/InlineParameterFixture.svelte').default|null>(null);
 onMount(()=>{
  if(!dev)return;
  if(new URLSearchParams(location.search).has('inline')){void import('$lib/workbench/InlineParameterFixture.svelte').then(module=>{inlineFixture=module.default;});return;}
  let disposed=false,cleanup=()=>{};
  void import('$lib/workbench/publication-fixture').then(({createPublicationFixture})=>{
   if(disposed)return;const fixture=createPublicationFixture();fixtureRef=fixture;let scope='1';
   const revision:PageRevision={...fixture.ref,document:fixture.document,revisionNumber:1,baseRevisionId:null,contentHash:'fixture',createdAt:'',createdBy:'',dataContextVersion:null};
   authoringPort={capabilities:{...confirmedPageAssetCapabilities,exactRead:true},getLatest:async()=>structuredClone(revision),getRevision:async()=>structuredClone(revision),saveRevision:async()=>{throw Error('fixture manual save unavailable');}};
   setMode=fixture.setMode;setMode(mode);publication=createAuthoringPublication({port:fixture.port,human:fixture.human,identity:()=>fixture.identity,synchronizedRef:()=>fixture.ref,scope:()=>scope});
   changeSource=()=>{scope+='x';publication?.invalidate();};
   const stop=publication.subscribe(()=>{counts=JSON.stringify(fixture.counts());});cleanup=()=>{stop();publication?.dispose();};
  });
  return()=>{disposed=true;cleanup();};
 });
</script>
{#if dev}
 {#if inlineFixture}{@const InlineFixture=inlineFixture}<InlineFixture/>{:else}
 <main class:lab={!embedded}><label><input type="checkbox" bind:checked={embedded}/>嵌入工作台</label><p>明确的 Java / 人工确认边界替身，非真实服务。</p>
 <label>验收场景<select aria-label="发布验收场景" bind:value={mode} onchange={()=>setMode?.(mode)}>{#each ['success','blocking','expired','lease','forbidden','bad-proof','bad-result','conflict','lost-ack'] as option}<option>{option}</option>{/each}</select></label>
 <button onclick={()=>changeSource?.()}>模拟草稿已修改</button><output aria-label="替身调用计数">{counts}</output>
 {#if embedded && fixtureRef && authoringPort}<PageAuthoringWorkbench {authoringPort} publicationPort={fixtureRef.port} humanConfirmation={fixtureRef.human}/>{:else if publication}<PublicationReview {publication}/>{/if}</main>
 {/if}
{:else}<p>发布组合验收入口仅供开发环境使用。</p>{/if}
<style>.lab{max-width:1080px;margin:24px auto;padding:16px}output{display:block;font-size:12px;margin:12px 0}</style>
