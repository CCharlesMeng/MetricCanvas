import {createIndexedAuthoringStorage,type AuthoringStorage,type StorageScope} from './authoring-storage';
import {navigationTarget,platformPath,resolvePlatformRoute,workTaskKey} from '../integration/routes';
export interface WorkTask {key:string;url:string}
export interface WorkSessionState {format:1;current:string|null;tasks:WorkTask[];directory:string;scroll:number;focus:string|null}
/** Owns task identity and directory context. Routes are parsed centrally; page content stays in its durable working copy. */
export function createWorkSession(options:{scope:StorageScope;base:string;origin:string;storage?:AuthoringStorage<WorkSessionState>}) {
  const storage=options.storage??createIndexedAuthoringStorage<WorkSessionState>();
  let version=0,disposed=false;
  let state:WorkSessionState={format:1,current:null,tasks:[],directory:platformPath(options.base,'/manage'),scroll:0,focus:null};
  let serial:Promise<unknown>=Promise.resolve();
  const runtimes=new Map<string,()=>{pageId:string|null;resourceId:string|null;busy:boolean}>();
  const listeners=new Set<(value:WorkSessionState)=>void>();
  const snapshot=()=>structuredClone(state);
  const emit=()=>{for(const listener of listeners)listener(snapshot());};
  function parse(value:string|URL){
    const input=new URL(value,options.origin);
    if(input.origin!==options.origin)throw Error('工作任务目标无效。');
    return resolvePlatformRoute(input,options.base);
  }
  function taskAddress(value:string|URL){
    const result=parse(value);
    if(result.route.kind!=='create')throw Error('工作任务目标无效。');
    return {...result,route:result.route};
  }
  function check(signal?:AbortSignal){if(disposed)throw Error('平台工作会话已失效。');signal?.throwIfAborted();}
  function protect(change:()=>void,signal?:AbortSignal){
    const result=serial.then(async()=>{
      check(signal);const before=snapshot();
      try{change();version=await storage.write(options.scope,version,snapshot());}
      catch(error){state=before;throw error;}
      if(!disposed)emit();check(signal);
    });
    serial=result.catch(()=>{});return result;
  }
  return {
    snapshot,
    register(key:string,read:()=>{pageId:string|null;resourceId:string|null;busy:boolean}){runtimes.set(key,read);return()=>{if(runtimes.get(key)===read)runtimes.delete(key);};},
    canMutate(asset:{pageId:string;resourceId:string}){return ![...runtimes.values()].some(read=>{const value=read();return value.pageId===asset.pageId&&(!value.resourceId||value.resourceId===asset.resourceId)&&value.busy;});},
    subscribe(listener:(value:WorkSessionState)=>void){listeners.add(listener);listener(snapshot());return()=>{listeners.delete(listener);};},
    async restore(){
      const record=await storage.read(options.scope);if(disposed)return;
      if(record){
        // Validate the whole record before migrating any URL. Invalid records remain untouched.
        try{
          const value=record.value;
          if(value.format!==1||!Array.isArray(value.tasks)||typeof value.directory!=='string'||!Number.isFinite(value.scroll)||value.scroll<0||value.focus!==null&&typeof value.focus!=='string')throw Error();
          const tasks=value.tasks.map(task=>{
            if(typeof task.key!=='string'||typeof task.url!=='string')throw Error();
            const {url,route}=taskAddress(task.url);
            if(workTaskKey(route)!==task.key||route.newTask)throw Error();
            url.searchParams.delete('info');
            return {key:task.key,url:url.pathname+url.search};
          });
          const directory=parse(value.directory);
          if(directory.route.kind!=='management'||new Set(tasks.map(task=>task.key)).size!==tasks.length||value.current!==null&&!tasks.some(task=>task.key===value.current))throw Error();
          const migrated:WorkSessionState={...structuredClone(value),tasks,directory:directory.url.pathname+directory.url.search};
          version=record.version;
          if(JSON.stringify(migrated)!==JSON.stringify(value))version=await storage.write(options.scope,version,migrated);
          if(disposed)return;state=migrated;
        }catch(cause){throw new Error('工作会话恢复记录无效或迁移未成功，原记录已保留。',{cause});}
      }
      emit();
    },
    async open(input:URL,signal?:AbortSignal):Promise<string>{
      check(signal);
      const {url,route}=taskAddress(navigationTarget(input,options.base));
      const key=workTaskKey(route);
      if(!key){
        const current=state.tasks.find(task=>task.key===state.current);
        if(!current)return url.pathname+url.search;
        const target=taskAddress(current.url).url;
        for(const name of new Set(url.searchParams.keys())){target.searchParams.delete(name);for(const value of url.searchParams.getAll(name))target.searchParams.append(name,value);}
        const canonical=taskAddress(target).url;return canonical.pathname+canonical.search;
      }
      const showPageInfo=route.showPageInfo;url.searchParams.delete('info');
      await protect(()=>{
        const existing=state.tasks.find(task=>task.key===key);
        if(existing&&route.taskId){
          // A saved local task may have gained its page/resource after its original deep link was issued.
          const saved=taskAddress(existing.url).route;
          for(const [name,stored,requested] of [['page',saved.pageId,route.pageId],['resource',saved.resourceId,route.resourceId]] as const){
            if(stored&&requested&&stored!==requested)throw Error('任务与页面地址不一致，原工作已保留。');
            if(stored&&!requested)url.searchParams.set(name,stored);
          }
        }
        const canonical=taskAddress(url).url;const address=canonical.pathname+canonical.search;
        if(existing)existing.url=address;else state.tasks.push({key,url:address});
        state.current=key;
      },signal);
      const target=taskAddress(state.tasks.find(task=>task.key===key)!.url).url;
      if(showPageInfo)target.searchParams.set('info','1');target.searchParams.sort();
      return target.pathname+target.search;
    },
    async bind(taskUrl:URL,pageId:string,resourceId?:string){
      const {url,route}=taskAddress(taskUrl);const key=workTaskKey(route);if(!key)return;
      url.searchParams.set('page',pageId);if(resourceId)url.searchParams.set('resource',resourceId);
      url.searchParams.delete('info');const canonical=taskAddress(url).url,target=canonical.pathname+canonical.search;
      if(state.tasks.find(task=>task.key===key)?.url===target)return target;
      await protect(()=>{const task=state.tasks.find(task=>task.key===key);if(task)task.url=target;});return target;
    },
    async rememberDirectory(input:URL,scroll=0,focus:string|null=null){
      const {url,route}=parse(input);if(route.kind!=='management')throw Error('目录返回目标无效。');
      await protect(()=>{state.directory=url.pathname+url.search;state.scroll=Math.max(0,scroll);state.focus=focus;});
    },
    async forgetAsset(asset:{pageId:string;resourceId:string}){await protect(()=>{state.tasks=state.tasks.filter(task=>{const {route}=taskAddress(task.url);return route.pageId!==asset.pageId||!!route.resourceId&&route.resourceId!==asset.resourceId;});if(!state.tasks.some(task=>task.key===state.current))state.current=null;});},
    dispose(){disposed=true;listeners.clear();runtimes.clear();}
  };
}
