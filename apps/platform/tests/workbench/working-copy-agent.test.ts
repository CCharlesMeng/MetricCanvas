import {expect,it,vi} from 'vitest';
import type {PageDocument} from '@metriccanvas/page';
import type {DialogueAgentPort,DialoguePageRequest} from '../../src/lib/integration/contract';
import {createWorkingCopyAgent} from '../../src/lib/workbench/working-copy-agent';
import {createAuthoringCoordinator,confirmedPageAssetCapabilities} from '../../src/lib/workbench/authoring-coordinator';
import {createCanvasAuthoringDraft} from '../../src/lib/workbench/document-edit';
import type {PageRevision} from '../../src/lib/page-assets/contract';

const document:PageDocument={schemaVersion:'6.5',id:'p',layout:'dashboard',dataSources:{},sections:[{id:'s',components:[{id:'t',type:'text',layout:{span:12},props:{title:'服务端旧标题',body:'内容'}}]}]};
function fixture(){
  const revision:PageRevision={pageId:'p',resourceId:'r',revisionId:'v1',revisionNumber:1,isDraft:true,document};
  const getLatest=vi.fn(async()=>revision),saveRevision=vi.fn(async()=>revision);
  const identity={actorId:'a',workspaceId:'w'};
  const coordinator=createAuthoringCoordinator({manualSave:true,identity:()=>identity,port:{capabilities:confirmedPageAssetCapabilities,getLatest,getRevision:getLatest,saveRevision}});
  return {revision,coordinator,getLatest,saveRevision,identity};
}
function edited(title:string){
  const next=structuredClone(document);next.sections[0].components[0].props.title=title;
  const parsed=createCanvasAuthoringDraft({...next});if(!parsed.ok)throw Error(parsed.message);
  return parsed.draft;
}

it('sends the flushed unsaved frontend document without saving or reading a remote latest revision',async()=>{
  const f=fixture();await f.coordinator.load('p');
  let finish!:(value:{requestId:string;status:'completed'})=>void;
  let captured:DialoguePageRequest|undefined;
  const send=vi.fn((request:DialoguePageRequest)=>{captured=request;return new Promise<{requestId:string;status:'completed'}>(resolve=>finish=resolve);});
  const port:DialogueAgentPort={openSession:vi.fn(),send};
  const agent=createWorkingCopyAgent({coordinator:f.coordinator,port,sessionId:'s1',flushInput:()=>{f.coordinator.replaceDraft(edited('输入框中的最后修改'));},readPage:f.getLatest});
  const pending=agent.start('补充分析');
  await vi.waitFor(()=>expect(send).toHaveBeenCalledTimes(1));
  expect(captured?.input.documentJson).toContain('输入框中的最后修改');
  expect(captured?.input.persistedRef?.revisionId).toBe('v1');
  expect(captured?.input.documentSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(f.getLatest).toHaveBeenCalledTimes(1);expect(f.saveRevision).not.toHaveBeenCalled();
  expect(f.coordinator.replaceDraft(edited('执行中不允许修改'))).toBe(false);
  await agent.start('重复点击');expect(send).toHaveBeenCalledTimes(1);
  await agent.applyPreview(edited('现有组件更新的内容').pageDocument);
  finish({requestId:captured!.requestId,status:'completed'});await pending;
  expect(f.coordinator.snapshot().languageLocked).toBe(false);
  expect(JSON.stringify(f.coordinator.snapshot().draft)).toContain('现有组件更新的内容');
  expect(f.saveRevision).not.toHaveBeenCalled();agent.dispose();f.coordinator.dispose();
});

it('keeps the manual working copy after a failed Agent turn and rejects late component updates',async()=>{
  const f=fixture();await f.coordinator.load('p');f.coordinator.replaceDraft(edited('未保存的本地内容'));
  const port:DialogueAgentPort={openSession:vi.fn(),send:async request=>({requestId:request.requestId,status:'failed'})};
  const agent=createWorkingCopyAgent({coordinator:f.coordinator,port,sessionId:'s',flushInput:()=>{},readPage:f.getLatest});
  await agent.start('调整');
  expect(agent.snapshot().phase).toBe('failed');expect(f.coordinator.snapshot().languageLocked).toBe(false);
  expect(JSON.stringify(f.coordinator.snapshot().draft)).toContain('未保存的本地内容');
  await expect(agent.applyPreview(document)).rejects.toThrow('不属于');agent.dispose();f.coordinator.dispose();
});

it('allows an empty new session to receive its first page through the existing pageId notification',async()=>{
  const f=fixture();let agent:ReturnType<typeof createWorkingCopyAgent>;
  const port:DialogueAgentPort={openSession:vi.fn(),send:async request=>{
    expect(request.input.documentJson).toBeNull();await agent.applyPage('p');return {requestId:request.requestId,status:'completed'};
  }};
  agent=createWorkingCopyAgent({coordinator:f.coordinator,port,sessionId:'new-session',flushInput:()=>{},readPage:f.getLatest});
  await agent.start('创建页面','create');
  expect(f.coordinator.snapshot().ref?.pageId).toBe('p');expect(f.coordinator.snapshot().languageLocked).toBe(false);
  agent.dispose();f.coordinator.dispose();
});

it.each(['unknown','mismatch','network'] as const)('keeps the lock and never resends an uncertain %s turn',async kind=>{
  const f=fixture();await f.coordinator.load('p');f.coordinator.replaceDraft(edited('需要保护的内容'));
  const send=vi.fn(async(request:DialoguePageRequest)=>{
    if(kind==='network')throw Error('网络断开');
    return {requestId:kind==='mismatch'?'other':request.requestId,status:kind==='unknown'?'unknown' as const:'completed' as const};
  });
  const agent=createWorkingCopyAgent({coordinator:f.coordinator,port:{openSession:vi.fn(),send},sessionId:'s',flushInput:()=>{},readPage:f.getLatest});
  await agent.start('调整');await agent.start('不能重发');
  expect(agent.snapshot().phase).toBe('unknown');expect(send).toHaveBeenCalledTimes(1);
  expect(f.coordinator.snapshot().languageLocked).toBe(true);
  expect(JSON.stringify(f.coordinator.snapshot().draft)).toContain('需要保护的内容');
  agent.dispose();expect(f.coordinator.snapshot().languageLocked).toBe(false);f.coordinator.dispose();
});

it('aborts on disposal and rejects the stale component and send receipts',async()=>{
  const f=fixture();await f.coordinator.load('p');
  let finish!:(value:{requestId:string;status:'completed'})=>void;
  let captured:DialoguePageRequest|undefined,cancel:AbortSignal|undefined;
  const send=vi.fn((request:DialoguePageRequest,signal:AbortSignal)=>{captured=request;cancel=signal;return new Promise<{requestId:string;status:'completed'}>(resolve=>finish=resolve);});
  const agent=createWorkingCopyAgent({coordinator:f.coordinator,port:{openSession:vi.fn(),send},sessionId:'s',flushInput:()=>{},readPage:f.getLatest});
  const pending=agent.start('调整');await vi.waitFor(()=>expect(send).toHaveBeenCalledOnce());
  agent.dispose();expect(cancel?.aborted).toBe(true);
  await expect(agent.applyPage('p')).rejects.toThrow('不属于');
  finish({requestId:captured!.requestId,status:'completed'});await pending;
  expect(f.coordinator.snapshot().languageLocked).toBe(false);expect(f.getLatest).toHaveBeenCalledTimes(1);f.coordinator.dispose();
});

it('waits for title confirmation before freezing or sending the page',async()=>{
  const f=fixture();await f.coordinator.load('p');const send=vi.fn();
  const agent=createWorkingCopyAgent({coordinator:f.coordinator,port:{openSession:vi.fn(),send},sessionId:'s',beforeStart:async()=>{throw Error('标题保存失败');},flushInput:()=>{},readPage:f.getLatest});
  await agent.start('发布','publish');expect(send).not.toHaveBeenCalled();expect(agent.snapshot().phase).toBe('failed');expect(f.coordinator.snapshot().languageLocked).toBe(false);agent.dispose();f.coordinator.dispose();
});

it('rejects a receipt after identity changes and preserves the original page',async()=>{
  const f=fixture();await f.coordinator.load('p');
  const port:DialogueAgentPort={openSession:vi.fn(),send:async request=>{f.identity.actorId='another-user';return {requestId:request.requestId,status:'completed'};}};
  const agent=createWorkingCopyAgent({coordinator:f.coordinator,port,sessionId:'s',flushInput:()=>{},readPage:f.getLatest});
  await agent.start('调整');expect(agent.snapshot().phase).toBe('failed');expect(agent.snapshot().message).toContain('身份');
  expect(JSON.stringify(f.coordinator.snapshot().draft)).toContain('服务端旧标题');agent.dispose();f.coordinator.dispose();
});
