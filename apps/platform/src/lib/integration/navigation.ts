import {isPlatformPath,navigationTarget,normalizeRouteBase,platformPath} from './routes';
export {isPlatformPath,normalizeRouteBase,platformPath} from './routes';
export type LeaveGuard = (destination?:URL) => boolean|Promise<boolean>;
export interface NavigationOptions {replaceState?:boolean;signal?:AbortSignal;from?:{href:string;revision:number}}
/** Own only prefix URLs. All internal commits share a serial guard queue and a latest-intent check. */
export function createPlatformNavigation(container:HTMLElement,routeBase:string){
  const base=normalizeRouteBase(routeBase),stateKey='__metriccanvasNavigation',instance=crypto.randomUUID();
  let index=0,url=navigationTarget(new URL(location.href),base),destroyed=false,revision=0;
  let queue:Promise<unknown>=Promise.resolve();
  let restoration:{href:string;index:number;done:()=>void;promise:Promise<void>}|undefined;
  const guards=new Map<LeaveGuard,()=>boolean>(),listeners=new Set<(url:URL)=>void>();
  const state=()=>({...history.state,[stateKey]:{instance,index}});
  history.replaceState(state(),'',url);
  function canLeave(destination?:URL):boolean|Promise<boolean>{
    const checks=[...guards.keys()];
    function check(position:number):boolean|Promise<boolean>{
      if(position===checks.length)return true;
      const result=checks[position](destination);
      return typeof result==='boolean'?result&&check(position+1):result.then(allowed=>allowed&&check(position+1));
    }
    return check(0);
  }
  function publish(next:URL){url=next;for(const listener of listeners)listener(new URL(url));}
  function enqueue(action:(current:()=>boolean)=>Promise<boolean>,options:NavigationOptions={}){
    const intent=++revision;
    const current=()=>!destroyed&&intent===revision&&!options.signal?.aborted&&(!options.from||options.from.href===url.href);
    const result=queue.then(async()=>{
      if(restoration)await restoration.promise;
      if(!current())return false;
      return action(current);
    });
    queue=result.catch(()=>{});return result;
  }
  async function navigate(target:string|URL,options:NavigationOptions={}){
    const input=new URL(target,url);
    if(input.origin!==url.origin||!isPlatformPath(input.pathname,base)||destroyed||options.signal?.aborted||options.from&&(options.from.href!==url.href||options.from.revision!==revision))return false;
    const next=navigationTarget(input,base);
    return enqueue(async current=>{
      // Even a same-address intent supersedes older requests, without re-running guards.
      if(next.href===url.href&&location.href===url.href)return false;
      if(!await canLeave(next)||!current())return false;
      const entry=history.state?.[stateKey];
      if(entry?.instance===instance)index=entry.index;
      if(!options.replaceState)index++;
      history[options.replaceState?'replaceState':'pushState'](state(),'',next);
      publish(next);return true;
    },options);
  }
  const click=(event:MouseEvent)=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const anchor=(event.target as Element)?.closest<HTMLAnchorElement>('a[href]');
    if(!anchor||anchor.hasAttribute('download')||anchor.target&&anchor.target!=='_self')return;
    const next=new URL(anchor.href,url);
    if(next.origin!==url.origin||!isPlatformPath(next.pathname,base))return;
    event.preventDefault();void navigate(next).catch(()=>{});
  };
  const pop=()=>{
    if(destroyed)return;
    const input=new URL(location.href),entry=history.state?.[stateKey];
    if(restoration){
      const expected=input.href===restoration.href&&entry?.instance===instance&&entry.index===restoration.index;
      restoration.done();restoration=undefined;
      if(expected)return;
    }
    if(!isPlatformPath(input.pathname,base)){revision++;return;}
    const next=navigationTarget(input,base);
    const intent=revision+1;
    void enqueue(async current=>{
      let allowed=false;try{allowed=await canLeave(next);}catch{ /* Failed protection cancels the history move too. */ }
      if(!current()||location.href!==input.href)return false;
      if(allowed){
        index=entry?.instance===instance?entry.index:index;
        // Keep foreign entries foreign; inventing our index would make later history.go offsets wrong.
        history.replaceState(history.state,'',next);publish(next);return true;
      }
      if(entry?.instance===instance&&entry.index!==index){
        let done!:()=>void;const promise=new Promise<void>(resolve=>{done=resolve;});
        restoration={href:url.href,index,done,promise};
        history.go(index-entry.index);
      }else history.replaceState(history.state,'',url);
      return false;
    }).catch(()=>{if(!destroyed&&intent===revision&&location.href===input.href)history.replaceState(state(),'',url);});
  };
  const unload=(event:BeforeUnloadEvent)=>{if([...guards.values()].some(dirty=>dirty())){event.preventDefault();event.returnValue='';}};
  container.addEventListener('click',click);window.addEventListener('popstate',pop);window.addEventListener('beforeunload',unload);
  return {base,resolve:(path:string,params?:{pageId:string})=>platformPath(base,path,params),navigate,canLeave,
    current:()=>new URL(url),checkpoint:()=>({href:url.href,revision}),
    subscribe(listener:(url:URL)=>void){listeners.add(listener);listener(new URL(url));return()=>{listeners.delete(listener);};},
    registerGuard(guard:LeaveGuard,dirty:()=>boolean=()=>true){guards.set(guard,dirty);return()=>{guards.delete(guard);};},
    destroy(){destroyed=true;revision++;restoration?.done();restoration=undefined;container.removeEventListener('click',click);window.removeEventListener('popstate',pop);window.removeEventListener('beforeunload',unload);listeners.clear();guards.clear();}
  };
}
export type PlatformNavigation=ReturnType<typeof createPlatformNavigation>;
