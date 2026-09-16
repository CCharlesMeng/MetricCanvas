import {readFileSync} from 'node:fs';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createPageAssetsClient} from '../src/lib/page-assets/java-adapter';
import {installRuntimeConfig} from '../src/lib/runtime-config';
import {createSingleSavePort} from '../src/lib/page-assets/single-save';
import {createAuthoringSync, type DurableAuthoringState} from '../src/lib/workbench/authoring-sync';
import {createCanvasAuthoringDraft} from '../src/lib/workbench/document-edit';
import type {PageDocument} from '@metriccanvas/page';

const document:PageDocument={schemaVersion:'6.2',id:'test-page',layout:'report',dataSources:{},sections:[{id:'main',components:[{id:'t',type:'text',layout:{span:12},props:{body:'内容'}}]}]};
const config={dqeEndpoint:'',pageMetadataBaseUrl:'https://java.test/rest/cdi/cdinl2databuilderservice/v1',authToken:'test-token',operatorId:'user',workspaceId:'ws'};
const receipt={retCode:'CBC.0000',page_id:document.id,page_metadata_id:'resource/1',revision_id:'r2',revision_number:2,is_draft:true,page_metadata_definition:JSON.stringify(document)};
const asset={resourceId:'resource/1',pageId:document.id};
afterEach(()=>installRuntimeConfig(null));

describe('Java YAML assets boundary',()=>{
 it('lists distinct resources, encodes direct reads, and needs no DQE configuration',async()=>{
  installRuntimeConfig(config);const calls:string[]=[];
  const api=createPageAssetsClient({fetchImpl:async(input)=>{const url=String(input);calls.push(url);return Response.json(url.includes('?')?{retCode:'CBC.0000',total:2,page_metadata_list:[receipt,{...receipt,page_metadata_id:'resource/2'}]}:receipt);}});
  expect((await api.list({page:1,pageSize:20,state:'draft'})).items.map(x=>x.resourceId)).toEqual(['resource/1','resource/2']);
  expect(calls[0]).toContain('isDraft=true');
  expect((await api.read(asset)).resourceId).toBe(asset.resourceId);
  expect(calls[1]).toContain('resource%2F1');
  await expect(api.resolve(document.id)).rejects.toMatchObject({code:'AMBIGUOUS_RESOURCE'});
 });
 it('maps publish, history, targeted restore and DELETE 204',async()=>{
  installRuntimeConfig(config);const calls:Array<[string,RequestInit|undefined]>=[];
  const api=createPageAssetsClient({fetchImpl:async(input,init)=>{const url=String(input);calls.push([url,init]);
   if(init?.method==='DELETE')return new Response(null,{status:204});
   if(url.endsWith('/history'))return Response.json({retCode:'CBC.0000',history_list:[{history_id:'h1',page_metadata_id:asset.resourceId,draft_version:1,comment:'first'}]});
   return Response.json({...receipt,is_draft:init?.method==='PUT'?false:true});
  }});
  expect((await api.save({target:{kind:'existing',asset,revisionId:'r1'},document,intent:'publish'})).status).toBe('confirmed');
  expect(JSON.parse(String(calls[0][1]?.body))).toMatchObject({base_revision_id:'r1',is_draft:false});
  expect((await api.history(asset))[0].draftVersion).toBe(1);
  expect((await api.restore({asset,draftVersion:1})).status).toBe('confirmed');
  expect(JSON.parse(String(calls[2][1]?.body))).toEqual({target_draft_version:1});
  expect(await api.remove(asset)).toEqual({status:'confirmed',value:undefined});
 });
 it.each([['timeout',0],['server',500],['wrong receipt',200]])('%s is unknown and never automatically resent',async(_name,status)=>{
  installRuntimeConfig(config);const fetchImpl=vi.fn<typeof fetch>(async()=>{if(!status)throw Error('timeout');return Response.json({...receipt,page_metadata_id:'wrong'},{status});});
  const api=createPageAssetsClient({fetchImpl});
  expect((await api.save({target:{kind:'existing',asset,revisionId:'r1'},document,intent:'saveDraft'})).status).toBe('unknown');
  expect(fetchImpl).toHaveBeenCalledTimes(1);
 });
 it('rejects conflicts and treats state mismatch as uncertain',async()=>{
  installRuntimeConfig(config);const api=createPageAssetsClient({fetchImpl:async()=>Response.json({code:'conflict'},{status:409})});
  expect(await api.save({target:{kind:'existing',asset,revisionId:'r1'},document,intent:'saveDraft'})).toMatchObject({status:'rejected',code:'REVISION_CONFLICT'});
  const wrong=createPageAssetsClient({fetchImpl:async()=>Response.json({...receipt,is_draft:null})});
  expect((await wrong.save({target:{kind:'new',pageId:document.id},document,intent:'saveDraft'})).status).toBe('unknown');
 });
});

it('persists a single-attempt write and does not resend after reconnect, retry or restart',async()=>{
 installRuntimeConfig(config);
 const fetchImpl=vi.fn<typeof fetch>(async()=>{throw Error('connection lost');});
 const port=createSingleSavePort(createPageAssetsClient({fetchImpl}));
 const draft=createCanvasAuthoringDraft({...document});if(!draft.ok)throw Error(draft.message);
 let stored:DurableAuthoringState|undefined;let version=0;
 const storage={read:async()=>stored?{version,value:structuredClone(stored)}:null,write:async(_scope:unknown,_v:number,value:DurableAuthoringState)=>{stored=structuredClone(value);return ++version;}};
 const initial:DurableAuthoringState={format:2,scope:{actorId:'user',workspaceId:'ws',pageId:document.id,resourceId:asset.resourceId},base:{...asset,revisionId:'r1'},draft:draft.draft,queue:[]};
 const sync=createAuthoringSync({initial,storage,port,identity:()=>({actorId:'user',workspaceId:'ws'})});sync.start();
 await vi.waitFor(()=>expect(sync.snapshot().protection).toBe('protected'));
 await sync.enqueue(draft.draft,'publish',true,true,'publish');
 await vi.waitFor(()=>expect(sync.snapshot().phase).toBe('unknown'));
 await sync.retry();sync.setOnline(false);sync.setOnline(true);sync.dispose();
 const reopened=createAuthoringSync({initial:stored!,restoredVersion:version,storage,port,identity:()=>({actorId:'user',workspaceId:'ws'})});reopened.start();await reopened.retry();
 expect(fetchImpl).toHaveBeenCalledTimes(1);expect(reopened.snapshot().phase).toBe('unknown');reopened.dispose();
});

const wireVectors: {successCodes:string[];unknownHttp:number[];rejectedHttp:Array<{status:number;code:string}>}=JSON.parse(readFileSync('metriccanvas-authoring/test-harness/fixtures/java-page-assets.json','utf8'));
it.each(wireVectors.successCodes)('accepts shared Java success vector %s',async(retCode)=>{
 installRuntimeConfig(config);
 const api=createPageAssetsClient({fetchImpl:async()=>Response.json({...receipt,retCode})});
 expect((await api.save({target:{kind:'new',pageId:document.id},document,intent:'saveDraft'})).status).toBe('confirmed');
});
it.each(wireVectors.unknownHttp)('classifies shared Java status %s as unknown',async(status)=>{
 installRuntimeConfig(config);
 const api=createPageAssetsClient({fetchImpl:async()=>Response.json({}, {status})});
 expect((await api.save({target:{kind:'new',pageId:document.id},document,intent:'saveDraft'})).status).toBe('unknown');
});

it('never replaces injected asset-only configuration with local development defaults',async()=>{
 const {installLocalDevRuntimeConfig,readPageAssetsRuntimeConfig}=await import('../src/lib/runtime-config');
 installRuntimeConfig(config);installLocalDevRuntimeConfig();
 expect(readPageAssetsRuntimeConfig()).toEqual(config);
});

it('keeps uncertain management operations stopped across a new controller',async()=>{
 const {createAssetManagement}=await import('../src/lib/page-assets/management');
 type Action=import('../src/lib/page-assets/management').ActionRecord;
 installRuntimeConfig(config);
 let saved:Action|undefined,version=0;
 const records={read:async()=>saved?{version,value:saved}:null,write:async(_scope:unknown,_v:number,value:Action)=>{saved=value;return ++version;}};
 const drafts={read:async()=>null,write:async()=>1};
 const api=createPageAssetsClient({fetchImpl:async()=>{throw Error('timeout');}});
 const remove=vi.spyOn(api,'remove');
 expect((await createAssetManagement(api,records,drafts).remove(asset)).status).toBe('unknown');
 expect((await createAssetManagement(api,records,drafts).remove(asset)).status).toBe('unknown');
 expect(remove).toHaveBeenCalledTimes(1);
});

it('does not send management requests when identity changes during durable claim',async()=>{
 const {createAssetManagement}=await import('../src/lib/page-assets/management');
 installRuntimeConfig(config);let version=0;
 const records={read:async()=>null,write:async()=>{installRuntimeConfig({...config,operatorId:'another-user'});return ++version;}};
 const api=createPageAssetsClient({fetchImpl:vi.fn()});const remove=vi.spyOn(api,'remove');
 const result=await createAssetManagement(api,records,{read:async()=>null,write:async()=>1}).remove(asset);
 expect(result).toMatchObject({status:'rejected',code:'IDENTITY_CHANGED'});expect(remove).not.toHaveBeenCalled();
});

it('keeps Java wire fields inside the adapter',async()=>{
 const {readdirSync}=await import('node:fs');
 const root='apps/platform/src';
 const sources=readdirSync(root,{recursive:true,withFileTypes:true});
 for(const entry of sources){
  if(!entry.isFile() || !/\.(ts|svelte)$/.test(entry.name))continue;
  const file=`${entry.parentPath}/${entry.name}`;
  if(file.endsWith('/page-assets/java-adapter.ts'))continue;
  expect(readFileSync(file,'utf8'),file).not.toMatch(/user-page-metadata|base_revision_id|page_metadata_definition/);
 }
});

it('replaces the local confirmed projection after rollback even when revision numbering decreases',async()=>{
 const {createAssetManagement}=await import('../src/lib/page-assets/management');
 installRuntimeConfig(config);
 const api=createPageAssetsClient({fetchImpl:async()=>Response.json({...receipt,revision_id:'restored',revision_number:1})});
 const write=vi.fn(async()=>1);
 const result=await createAssetManagement(api,{read:async()=>null,write:async()=>1},{read:async()=>null,write}).restore(asset,1);
 expect(result.status).toBe('confirmed');
 expect(write).toHaveBeenCalledWith(expect.objectContaining(asset),0,expect.objectContaining({base:{...asset,revisionId:'restored'},confirmed:expect.objectContaining({revisionNumber:1})}));
});

it('preserves the AI receipt across repeated reopenings with an eventually consistent GET',async()=>{
 const {createAuthoringCoordinator,confirmedPageAssetCapabilities}=await import('../src/lib/workbench/authoring-coordinator');
 installRuntimeConfig(config);
 const api=createPageAssetsClient({fetchImpl:async()=>Response.json({...receipt,revision_id:'r1',revision_number:1})});
 const records=new Map<string,{version:number;value:DurableAuthoringState}>();
 const storage={read:async(scope:unknown)=>structuredClone(records.get(JSON.stringify(scope))??null),
 write:async(scope:unknown,version:number,value:DurableAuthoringState)=>{records.set(JSON.stringify(scope),{version:version+1,value:structuredClone(value)});return version+1;}};
 const create=()=>{
  const coordinator=createAuthoringCoordinator({identity:()=>({actorId:'user',workspaceId:'ws'}),port:{assets:api,capabilities:{...confirmedPageAssetCapabilities,currentRead:true},getLatest:async()=>api.read(asset),getRevision:async()=>api.read(asset),saveRevision:async()=>{throw Error('must not save AI output');}}});
  coordinator.enableAutoSync({storage,port:createSingleSavePort(api)});return coordinator;
 };
 const first=create();await first.load(document.id,{resourceId:asset.resourceId});
 await vi.waitFor(()=>expect(first.snapshot().sync?.protection).toBe('protected'));
 const updated=structuredClone(document);updated.meta={description:'AI updated'};
 expect(first.acceptSavedDraft({draftId:'saved',ref:{...asset,revisionId:'r2'},document:updated,revisionNumber:2,isDraft:true})).toBe(true);
 await vi.waitFor(()=>expect(first.snapshot().sync?.protection).toBe('protected'));first.dispose();
 for(let i=0;i<2;i++){
  const reopened=create();await reopened.load(document.id,{resourceId:asset.resourceId});
  await vi.waitFor(()=>expect(reopened.snapshot().sync?.protection).toBe('protected'));
  expect(reopened.snapshot().ref?.revisionId).toBe('r2');expect(reopened.snapshot().draft?.pageDocument.meta).toMatchObject({description:'AI updated'});reopened.dispose();
 }
});
