import {expect,it,vi} from 'vitest';
import {createDialogueSessions} from '../src/lib/dialogue/sessions';
import {resolvePlatformRoute,workTaskKey} from '../src/lib/integration/routes';
import type {DialogueAgentPort} from '../src/lib/integration/contract';

it('creates once during repeated mounting and creates a new session after the URL ID is deleted',async()=>{
  let complete!:(value:{sessionId:string})=>void;
  const openSession=vi.fn(()=>new Promise<{sessionId:string}>(resolve=>complete=resolve));
  const port:DialogueAgentPort={openSession,send:vi.fn()};
  const sessions=createDialogueSessions(port);
  const first=sessions.open(null,'page=p'),same=sessions.open(null,'page=p');
  expect(openSession).toHaveBeenCalledTimes(1);complete({sessionId:'s1'});
  expect(await first).toBe('s1');expect(await same).toBe('s1');
  expect(await sessions.open('s1','page=p&sessionId=s1')).toBe('s1');
  const fresh=sessions.open(null,'page=p');expect(openSession).toHaveBeenCalledTimes(2);
  complete({sessionId:'s2'});expect(await fresh).toBe('s2');sessions.dispose();
});

it('does not substitute a different session when restoring a supplied ID',async()=>{
  const openSession=vi.fn<DialogueAgentPort['openSession']>(async()=>({sessionId:'wrong'}));
  const sessions=createDialogueSessions({openSession,send:vi.fn()});
  await expect(sessions.open('requested','url')).rejects.toThrow('不一致');
  expect(openSession.mock.calls[0][0]).toEqual({sessionId:'requested'});
  sessions.dispose();
});

it('normalizes pageId aliases and gives different sessions independent task identities',()=>{
  const one=resolvePlatformRoute(new URL('https://portal/create?pageId=p&sessionId=s1'),'');
  const two=resolvePlatformRoute(new URL('https://portal/create?page=p&sessionId=s2'),'');
  expect(one.route).toMatchObject({pageId:'p',sessionId:'s1'});
  expect(one.url.searchParams.get('page')).toBe('p');
  if(one.route.kind!=='create'||two.route.kind!=='create')throw Error('route');
  expect(workTaskKey(one.route)).not.toBe(workTaskKey(two.route));
  expect(resolvePlatformRoute(new URL('https://portal/create?page=p&pageId=other'),'').route.kind).toBe('invalid');
  expect(resolvePlatformRoute(new URL('https://portal/create?sessionId=s1&sessionId=s2'),'').route.kind).toBe('invalid');
});

it('reuses each pending opening when route preparation switches away and back',async()=>{
  const complete:Array<(value:{sessionId:string})=>void>=[];
  const openSession=vi.fn<DialogueAgentPort['openSession']>(()=>new Promise(resolve=>complete.push(resolve)));
  const sessions=createDialogueSessions({openSession,send:vi.fn()});
  const first=sessions.open(null,'page=a'),other=sessions.open(null,'page=b'),back=sessions.open(null,'page=a');
  expect(openSession).toHaveBeenCalledTimes(2);
  complete[1]({sessionId:'b'});expect(await other).toBe('b');await sessions.open('b','page=b&sessionId=b');
  complete[0]({sessionId:'a'});expect(await first).toBe('a');expect(await back).toBe('a');
  expect(openSession).toHaveBeenCalledTimes(2);sessions.dispose();
});

it('rejects a late opening and every new opening after identity disposal',async()=>{
  let complete!:(value:{sessionId:string})=>void;
  const openSession=vi.fn<DialogueAgentPort['openSession']>(()=>new Promise(resolve=>complete=resolve));
  const sessions=createDialogueSessions({openSession,send:vi.fn()});const pending=sessions.open(null,'page=a');
  sessions.dispose();complete({sessionId:'late'});await expect(pending).rejects.toThrow();
  await expect(sessions.open(null,'page=a')).rejects.toThrow();expect(openSession).toHaveBeenCalledTimes(1);
});
