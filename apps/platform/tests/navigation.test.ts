import {afterEach,describe,it,expect,vi} from 'vitest';
import {createPlatformNavigation} from '../src/lib/integration/navigation';
function browser(path='/create'){
  const origin='https://portal.test';
  const location={href:new URL(path,origin).href};
  const events=new EventTarget(),container=new EventTarget();
  const entries:{url:string;state:unknown}[]=[{url:location.href,state:null}];let position=0;
  const history={
    get state(){return entries[position].state;},
    replaceState(state:unknown,_unused:string,target:string|URL){location.href=new URL(target,location.href).href;entries[position]={state:structuredClone(state),url:location.href};},
    pushState(state:unknown,_unused:string,target:string|URL){location.href=new URL(target,location.href).href;entries.splice(position+1);entries.push({state:structuredClone(state),url:location.href});position++;},
    go(delta:number){queueMicrotask(()=>pop(delta));}
  };
  function pop(delta:number){position+=delta;location.href=entries[position].url;events.dispatchEvent(new Event('popstate'));}
  vi.stubGlobal('location',location);vi.stubGlobal('history',history);vi.stubGlobal('window',events);
  const navigation=createPlatformNavigation(container as HTMLElement,'/');
  return {navigation,location,entries,pop,position:()=>position};
}
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
function deferred(){let resolve!:(value:boolean)=>void;const promise=new Promise<boolean>(done=>{resolve=done;});return {promise,resolve};}
afterEach(()=>vi.unstubAllGlobals());
describe('navigation transactions',()=>{
  it('normalizes legacy addresses at mount and before committing navigation',async()=>{
    const {navigation,location}=browser('/ask?new=1');
    expect(new URL(location.href).pathname).toBe('/create');expect(new URL(location.href).searchParams.get('task')).toBeTruthy();expect(new URL(location.href).searchParams.has('new')).toBe(false);
    await navigation.navigate('/manage/');expect(navigation.current().pathname).toBe('/manage');navigation.destroy();
  });
  it('serializes guards and lets a newer intent supersede an older pending navigation',async()=>{
    const {navigation,entries}=browser(),waiting=deferred();let calls=0;
    navigation.registerGuard(()=>++calls===1?waiting.promise:true);
    const old=navigation.navigate('/manage');await flush();const latest=navigation.navigate('/manage/pages/p');
    waiting.resolve(true);expect(await old).toBe(false);expect(await latest).toBe(true);
    expect(entries).toHaveLength(2);expect(navigation.current().pathname).toBe('/manage/pages/p');navigation.destroy();
  });
  it('does not commit a cancelled asynchronous normalization',async()=>{
    const {navigation,entries}=browser(),waiting=deferred(),controller=new AbortController();
    navigation.registerGuard(()=>waiting.promise);
    const pending=navigation.navigate('/create?task=t',{replaceState:true,signal:controller.signal,from:navigation.checkpoint()});await flush();controller.abort();waiting.resolve(true);
    expect(await pending).toBe(false);expect(entries[0].url).toBe('https://portal.test/create');navigation.destroy();
  });
  it('does not let late task resolution supersede a user navigation still waiting on its guard',async()=>{
    const {navigation}=browser(),from=navigation.checkpoint(),waiting=deferred();
    navigation.registerGuard(()=>waiting.promise);
    const user=navigation.navigate('/manage');await flush();
    expect(await navigation.navigate('/create?task=t',{replaceState:true,from})).toBe(false);
    waiting.resolve(true);expect(await user).toBe(true);expect(navigation.current().pathname).toBe('/manage');navigation.destroy();
  });
  it('handles overlapping back operations without publishing the obsolete destination',async()=>{
    const {navigation,pop,location}=browser();await navigation.navigate('/manage');await navigation.navigate('/manage/pages/p');
    const waiting=deferred();let calls=0;navigation.registerGuard(()=>++calls===1?waiting.promise:true);
    const seen:string[]=[];navigation.subscribe(value=>seen.push(value.pathname));
    pop(-1);await flush();pop(-1);waiting.resolve(true);await flush();
    expect(seen).toEqual(['/manage/pages/p','/create']);expect(navigation.current().href).toBe(location.href);navigation.destroy();
  });
  it('restores cancelled back navigation once and retains the original history position',async()=>{
    const {navigation,pop,position,location}=browser();await navigation.navigate('/manage');await navigation.navigate('/manage/pages/p');
    const guard=vi.fn(()=>false),off=navigation.registerGuard(guard);
    pop(-1);await flush();expect(position()).toBe(2);expect(location.href).toBe(navigation.current().href);expect(guard).toHaveBeenCalledTimes(1);
    off();await navigation.navigate('/create');expect(position()).toBe(3);pop(-1);await flush();expect(navigation.current().pathname).toBe('/manage/pages/p');navigation.destroy();
  });
  it('a click after a pending back operation commits relative to the actual history entry',async()=>{
    const {navigation,pop,position,entries,location}=browser();await navigation.navigate('/manage');await navigation.navigate('/manage/pages/p');
    const waiting=deferred();let calls=0;navigation.registerGuard(()=>++calls===1?waiting.promise:true);
    pop(-1);await flush();const user=navigation.navigate('/create');waiting.resolve(true);expect(await user).toBe(true);
    expect(position()).toBe(2);expect(entries).toHaveLength(3);expect(location.href).toBe(navigation.current().href);navigation.destroy();
  });
  it('does not change location when destroyed while guards are pending',async()=>{
    const {navigation,location}=browser(),waiting=deferred();navigation.registerGuard(()=>waiting.promise);
    const pending=navigation.navigate('/manage');await flush();navigation.destroy();waiting.resolve(true);expect(await pending).toBe(false);expect(location.href).toBe('https://portal.test/create');
  });
  it('a failed protection guard restores the history position without a second guard invocation',async()=>{
    const {navigation,pop,position,location}=browser();await navigation.navigate('/manage');
    const guard=vi.fn(()=>{throw Error('storage unavailable');});navigation.registerGuard(guard);
    pop(-1);await flush();expect(position()).toBe(1);expect(location.href).toBe(navigation.current().href);expect(guard).toHaveBeenCalledTimes(1);navigation.destroy();
  });
  it('selecting the current address cancels an older pending destination',async()=>{
    const {navigation,entries}=browser(),waiting=deferred();navigation.registerGuard(()=>waiting.promise);
    const older=navigation.navigate('/manage');await flush();const current=navigation.navigate('/create');waiting.resolve(true);
    expect(await older).toBe(false);expect(await current).toBe(false);expect(entries).toHaveLength(1);navigation.destroy();
  });
  it('does not assign this instance\'s history index to a foreign entry',async()=>{
    const {navigation,pop,entries}=browser();await navigation.navigate('/manage');
    entries[0].state={portal:'previous-instance'};pop(-1);await flush();
    expect(navigation.current().pathname).toBe('/create');expect(entries[0].state).toEqual({portal:'previous-instance'});navigation.destroy();
  });
});
