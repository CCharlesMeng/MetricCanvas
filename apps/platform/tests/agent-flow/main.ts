import {mount,unmount} from 'svelte';
import {writable} from 'svelte/store';
import {canonicalizeJson,normalizePageDocument,versionPolicy,type PageDocument} from '@metriccanvas/page';
import {mountPlatform} from '../../src/lib/integration/mount';
import type {PlatformDialogueAdapter,PageInfoPort,PageInfoRecord,PageInfoChanges} from '../../src/lib/integration/contract';
import FixtureChat from './FixtureChat.svelte';
import example from '../../../../pages/platform/flow-page.json';
import interactionExample from '../../../../pages/platform/platform-interaction-audit.json';

const parsed=normalizePageDocument({...example,schemaVersion:versionPolicy.current});
if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
const initial=parsed.document;
type Stored={document:PageDocument;number:number;isDraft:boolean;path:string};
const records=new Map<string,Stored>([[initial.id,{document:initial,number:1,isDraft:false,path:'/reports/flow?pageId='+initial.id}]]);
const interaction=normalizePageDocument(interactionExample);
if(!interaction.ok)throw Error(JSON.stringify(interaction.errors));
records.set(interaction.document.id,{document:interaction.document,number:1,isDraft:true,path:'/reports/audit?pageId='+interaction.document.id});
const conversations=new Map<string,ReturnType<typeof writable<string[]>>>();
function messagesFor(sessionId:string){let messages=conversations.get(sessionId);if(!messages){messages=writable<string[]>([]);conversations.set(sessionId,messages);}return messages;}
let sessions=0,sendCount=0,infoWrites=0,assetWrites=0;
let lastInput:string|null=null,lastIntent:string|null=null;
const openings:string[]=[];
let finishSession=()=>{};
let finishTurn=()=>{};
document.getElementById('complete-turn')!.addEventListener('click',()=>finishTurn());
const completeButton=document.getElementById('complete-session')!;
completeButton.addEventListener('click',()=>finishSession());
function log(){document.querySelector('pre')!.textContent=JSON.stringify({sessions,openings,sendCount,infoWrites,assetWrites,lastInput,lastIntent},null,2);}
function stored(pageId:string){const record=records.get(pageId);if(!record)throw Error('页面不存在');return record;}
function info(pageId:string):PageInfoRecord{const record=stored(pageId);return {pageId,resourceId:'resource-'+pageId,revisionId:'r'+record.number,title:String(record.document.meta?.title),description:record.document.meta?.description??'',accessPath:record.path,documentJson:canonicalizeJson(record.document)};}
function updateInfo(target:PageInfoRecord,changes:PageInfoChanges){
  const record=stored(target.pageId);if(target.revisionId!=='r'+record.number)throw Error('冲突');
  record.document={...record.document,meta:{...record.document.meta,...(changes.title!==undefined?{title:changes.title}:{}),...(changes.description!==undefined?{description:changes.description}:{})}};
  if(changes.accessPath!==undefined)record.path=changes.accessPath;
  record.number++;infoWrites++;log();return info(target.pageId);
}
const pageInfo:PageInfoPort={read:async target=>info(target.pageId),update:async(target,changes)=>updateInfo({...info(target.pageId),revisionId:target.revisionId},changes)};

const dialogueAdapter:PlatformDialogueAdapter={
  async mount(element,context){const component=mount(FixtureChat,{target:element,props:{context,messages:messagesFor(context?.sessionId??'legacy')}});return()=>{void unmount(component);};},
  agent:{
    async openSession(input,signal){
      if(new URL(location.href).searchParams.has('delaySession'))await new Promise<void>(resolve=>finishSession=resolve);
      signal.throwIfAborted();if(input.sessionId==='broken')throw Error('指定会话恢复失败');
      const sessionId=input.sessionId??'cloud-session-'+(++sessions)+'-'+crypto.randomUUID().slice(0,8);openings.push(sessionId);log();return {sessionId};
    },
    async send(request){
      const messages=messagesFor(request.sessionId);sendCount++;lastInput=request.input.documentJson;lastIntent=request.intent;messages.update(items=>[...items,'你：'+request.question]);log();
      if(new URL(location.href).searchParams.has('delayTurn'))await new Promise<void>(resolve=>finishTurn=resolve);
      const document:PageDocument=request.input.documentJson?JSON.parse(request.input.documentJson):{...structuredClone(initial),id:'new-flow-page'};
      if(request.intent==='adjust'){
        const component=document.sections[0].components[0];if(component.type==='text')component.props.body='云宝替身基于前端最新标题「'+String(component.props.title)+'」补充了说明。';
      }
      const previous=records.get(document.id);
      records.set(document.id,{document,number:(previous?.number??0)+1,isDraft:request.intent!=='publish',path:previous?.path??'/reports/new?pageId='+document.id});
      window.dispatchEvent(new CustomEvent('metriccanvas:apply-page',{detail:{pageId:document.id}}));
      messages.update(items=>[...items,'云宝：本轮已完成，现有组件已通知页面更新。']);
      return {requestId:request.requestId,status:'completed'};
    }
  }
};

const originalFetch=window.fetch.bind(window);
function receipt(pageId:string){const record=stored(pageId);return {retCode:'CBC.0000',page_id:pageId,page_metadata_id:'resource-'+pageId,revision_id:'r'+record.number,revision_number:record.number,is_draft:record.isDraft,page_metadata_definition:JSON.stringify(record.document)};}
window.fetch=async(input,init)=>{
  const url=new URL(String(input),location.href);
  if(!url.pathname.startsWith('/fixture-assets'))return originalFetch(input,init);
  const id=url.pathname.split('/').at(-1)!;
  if(id==='user-page-metadata')return Response.json({retCode:'CBC.0000',total:records.size,page_metadata_list:[...records.keys()].map(receipt)});
  const pageId=id.replace(/^resource-/,'');
  if(init?.method==='PUT'){const body=JSON.parse(String(init.body));const record=stored(pageId);record.document=body.page_metadata_definition;record.isDraft=body.is_draft;record.number++;assetWrites++;log();}
  return Response.json(receipt(pageId));
};
if(!location.pathname.startsWith('/flow/'))history.replaceState(null,'','/flow/create'+location.search);
log();
const platform=await mountPlatform(document.getElementById('app')!,{routeBase:'/flow',readConfig:()=>({dqeEndpoint:'',pageMetadataBaseUrl:'/fixture-assets',authToken:'fixture',operatorId:'fixture-user',workspaceId:'fixture-workspace'}),configChanges:'reload',dialogueAdapter,pageInfo},false);

document.getElementById('new-session')!.addEventListener('click',()=>{
  const url=new URL(platform.services.navigation.current());url.searchParams.delete('sessionId');
  void platform.services.navigation.navigate(url);
});
