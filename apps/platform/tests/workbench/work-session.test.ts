import {describe,it,expect} from 'vitest';import {createWorkSession,type WorkSessionState} from '../../src/lib/workbench/work-session';import type {AuthoringStorage,StorageScope} from '../../src/lib/workbench/authoring-storage';
const scope:StorageScope={actorId:'a',workspaceId:'w',pageId:'__session__',serviceTarget:'https://assets-a'};
function storage(){const records=new Map<string,{version:number;value:WorkSessionState}>();const port:AuthoringStorage<WorkSessionState>={async read(key){return structuredClone(records.get(JSON.stringify(key))??null);},async write(key,version,value){const id=JSON.stringify(key);if((records.get(id)?.version??0)!==version)throw Error('conflict');records.set(id,{version:version+1,value:structuredClone(value)});return version+1;}};return port;}
const url=(path:string)=>new URL(path,'https://portal.test');
describe('instance work session',()=>{
 it('information deep links reuse a task without persisting the panel intent into its identity',async()=>{const session=createWorkSession({scope,storage:storage(),base:'',origin:'https://portal.test'});await session.restore();await session.open(url('/create?page=p&resource=r'));expect(await session.open(url('/create?page=p&resource=r&info=1'))).toBe('/create?info=1&page=p&resource=r');expect(session.snapshot().tasks).toHaveLength(1);expect(session.snapshot().tasks[0].url).toBe('/create?page=p&resource=r');expect(await session.open(url('/create'))).toBe('/create?page=p&resource=r');});
 it('forgetting a deleted record removes its task and pointer while preserving another resource of the same page',async()=>{const port=storage();const session=createWorkSession({scope,storage:port,base:'',origin:'https://portal.test'});await session.restore();await session.open(url('/create?page=p&resource=keep'));await session.open(url('/create?page=p&resource=deleted'));await session.forgetAsset({pageId:'p',resourceId:'deleted'});expect(session.snapshot()).toMatchObject({current:null,tasks:[{url:'/create?page=p&resource=keep'}]});const reopened=createWorkSession({scope,storage:port,base:'',origin:'https://portal.test'});await reopened.restore();expect(reopened.snapshot()).toEqual(session.snapshot());expect(await reopened.open(url('/create'))).toBe('/create');});
 it('preserves each resource task and restores the current pointer and directory context',async()=>{const port=storage();const session=createWorkSession({scope,storage:port,base:'/mc',origin:'https://portal.test'});await session.restore();await session.open(url('/mc/create?page=p&resource=r1'));await session.open(url('/mc/create?page=p&resource=r2'));await session.rememberDirectory(url('/mc/manage?state=draft&page=3'),250,'r2');expect(session.snapshot().tasks).toHaveLength(2);const restored=createWorkSession({scope,storage:port,base:'/mc',origin:'https://portal.test'});await restored.restore();expect(await restored.open(url('/mc/create'))).toBe('/mc/create?page=p&resource=r2');expect(restored.snapshot()).toMatchObject({directory:'/mc/manage?page=3&state=draft',scroll:250,focus:'r2'});});
 it('new tasks have local identities; binding a document does not create a second task',async()=>{const session=createWorkSession({scope,storage:storage(),base:'',origin:'https://portal.test'});await session.restore();const target=await session.open(url('/create?new=1'));expect(target).toContain('task=');await session.bind(url(target),'local-page');await session.open(url(session.snapshot().tasks[0].url));expect(session.snapshot().tasks).toHaveLength(1);});
 it('different service targets cannot recover each other and failed protection cannot move the pointer',async()=>{const port=storage();const one=createWorkSession({scope,storage:port,base:'',origin:'https://portal.test'});await one.restore();await one.open(url('/create?page=p&resource=r'));const two=createWorkSession({scope:{...scope,serviceTarget:'https://assets-b'},storage:port,base:'',origin:'https://portal.test'});await two.restore();expect(two.snapshot().tasks).toHaveLength(0);const failed=createWorkSession({scope,storage:{read:port.read,async write(){throw Error('quota');}},base:'',origin:'https://portal.test'});await failed.restore();const before=failed.snapshot();await expect(failed.open(url('/create?page=other&resource=another'))).rejects.toThrow('quota');expect(failed.snapshot()).toEqual(before);});
});

describe('route recovery and redirect convergence',()=>{
 it('migrates old URLs without changing task keys, current pointer or directory context',async()=>{
  const port=storage(),key=JSON.stringify(['p','r']);
  await port.write(scope,0,{format:1,current:key,tasks:[{key,url:'/mc/?page=p&resource=r'}],directory:'/mc/manage/?state=draft&page=3',scroll:250,focus:'r'});
  const session=createWorkSession({scope,storage:port,base:'/mc',origin:'https://portal.test'});await session.restore();
  expect(session.snapshot()).toEqual({format:1,current:key,tasks:[{key,url:'/mc/create?page=p&resource=r'}],directory:'/mc/manage?page=3&state=draft',scroll:250,focus:'r'});
  const stored=await port.read(scope);await session.restore();expect(await port.read(scope)).toEqual(stored);
 });
 it('rejects mutually redirecting task identities and preserves the original record',async()=>{
  const port=storage(),one=JSON.stringify(['p','r1']),two=JSON.stringify(['p','r2']);
  const record:WorkSessionState={format:1,current:one,tasks:[{key:one,url:'/?page=p&resource=r2'},{key:two,url:'/?page=p&resource=r1'}],directory:'/manage',scroll:0,focus:null};
  await port.write(scope,0,record);const stored=await port.read(scope);
  const session=createWorkSession({scope,storage:port,base:'',origin:'https://portal.test'});
  await expect(session.restore()).rejects.toThrow('原记录已保留');expect(await port.read(scope)).toEqual(stored);
 });
 it('accepts new non-identity query values instead of redirecting to historic values',async()=>{
  const session=createWorkSession({scope,storage:storage(),base:'',origin:'https://portal.test'});await session.restore();
  await session.open(url('/create?page=p&resource=r&filter=old'));
  const input='/create?filter=new&page=p&resource=r';expect(await session.open(url(input))).toBe(input);expect(await session.open(url(input))).toBe(input);
 });
 it('consumes new intent and preserves later page binding when the original task deep link is revisited',async()=>{
  const session=createWorkSession({scope,storage:storage(),base:'',origin:'https://portal.test'});await session.restore();
  const task=await session.open(url('/create?new=1'));expect(task).not.toContain('new=');
  await session.bind(url(task),'p','r');const canonical=await session.open(url(task));
  expect(url(canonical).searchParams.get('page')).toBe('p');expect(url(canonical).searchParams.get('resource')).toBe('r');expect(await session.open(url(canonical))).toBe(canonical);expect(session.snapshot().tasks).toHaveLength(1);
 });
 it('does not open or persist an already-cancelled task request',async()=>{
  const port=storage(),session=createWorkSession({scope,storage:port,base:'',origin:'https://portal.test'});await session.restore();
  const controller=new AbortController();controller.abort();await expect(session.open(url('/create?new=1'),controller.signal)).rejects.toThrow();
  expect(session.snapshot().tasks).toHaveLength(0);expect(await port.read(scope)).toBeNull();
 });
 it('normalizes a trailing-slash directory before remembering its scroll and focus',async()=>{
  const session=createWorkSession({scope,storage:storage(),base:'/mc',origin:'https://portal.test'});await session.restore();
  await session.rememberDirectory(url('/mc/manage/?page=2'),100,'r');expect(session.snapshot()).toMatchObject({directory:'/mc/manage?page=2',scroll:100,focus:'r'});
 });
});
