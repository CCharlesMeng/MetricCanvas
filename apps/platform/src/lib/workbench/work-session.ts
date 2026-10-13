import {createIndexedAuthoringStorage,type AuthoringStorage,type StorageScope} from './authoring-storage';
export interface WorkTask { key:string; url:string }
export interface WorkSessionState {format:1;current:string|null;tasks:WorkTask[];directory:string;scroll:number;focus:string|null}
/** One instance owns its task pointer and directory return context; it stores no credentials or page content. */
export function createWorkSession(options:{scope:StorageScope;base:string;origin:string;storage?:AuthoringStorage<WorkSessionState>}) {
 const storage=options.storage??createIndexedAuthoringStorage<WorkSessionState>();let version=0;let state:WorkSessionState={format:1,current:null,tasks:[],directory:options.base+'/manage',scroll:0,focus:null};let serial:Promise<unknown>=Promise.resolve();let disposed=false;
 const runtimes=new Map<string,()=>{pageId:string|null;resourceId:string|null;busy:boolean}>();
 const listeners=new Set<(value:WorkSessionState)=>void>();const snapshot=()=>structuredClone(state);const emit=()=>{for(const listener of listeners)listener(snapshot());};
 const valid=(value:string)=>{const url=new URL(value,options.origin);return url.origin===options.origin&&(url.pathname===options.base+'/'||url.pathname===options.base+'/manage');};
 function protect(change:()=>void){const result=serial.then(async()=>{if(disposed)throw Error('平台工作会话已失效。');const before=snapshot();change();try{version=await storage.write(options.scope,version,snapshot());emit();}catch(error){state=before;throw error;}});serial=result.catch(()=>{});return result;}
 return {snapshot,
 register(key:string,read:()=>{pageId:string|null;resourceId:string|null;busy:boolean}){runtimes.set(key,read);return()=>{if(runtimes.get(key)===read)runtimes.delete(key);};},
 canMutate(asset:{pageId:string;resourceId:string}){return ![...runtimes.values()].some(read=>{const value=read();return value.pageId===asset.pageId&&(!value.resourceId||value.resourceId===asset.resourceId)&&value.busy;});},
 subscribe(listener:(value:WorkSessionState)=>void){listeners.add(listener);listener(snapshot());return()=>{listeners.delete(listener);};},
 async restore(){const record=await storage.read(options.scope);if(disposed)return;if(record){const value=record.value;if(value.format!==1||!Array.isArray(value.tasks)||!value.tasks.every(task=>typeof task.key==='string'&&valid(task.url))||!valid(value.directory)||value.tasks.some((task,index)=>value.tasks.findIndex(other=>other.key===task.key)!==index)||value.current!==null&&!value.tasks.some(task=>task.key===value.current))throw Error('工作会话恢复记录无效，原记录已保留。');version=record.version;state=structuredClone(value);}emit();},
 async open(input:URL):Promise<string>{
  if(!valid(input.pathname+input.search)||input.origin!==options.origin)throw Error('工作任务目标无效。');
  if(input.searchParams.get('new')==='1'&&!input.searchParams.has('task')){input=new URL(input);input.searchParams.set('task',crypto.randomUUID());}
  const page=input.searchParams.get('page'),resource=input.searchParams.get('resource');
  if(!page&&!input.searchParams.has('task'))return state.tasks.find(task=>task.key===state.current)?.url??input.pathname;
  const key=input.searchParams.has('task')?'new:'+input.searchParams.get('task'):JSON.stringify([page,resource??null]);const storedUrl=new URL(input);storedUrl.searchParams.delete('info');const url=storedUrl.pathname+storedUrl.search;
  await protect(()=>{if(!state.tasks.some(task=>task.key===key))state.tasks.push({key,url});state.current=key;});const target=new URL(state.tasks.find(task=>task.key===key)!.url,options.origin);if(input.searchParams.get('info')==='1')target.searchParams.set('info','1');return target.pathname+target.search;
 },
 async bind(taskUrl:URL,pageId:string,resourceId?:string){
  const taskId=taskUrl.searchParams.get('task');if(!taskId)return;const key='new:'+taskId;const url=new URL(taskUrl);url.searchParams.set('page',pageId);if(resourceId)url.searchParams.set('resource',resourceId);const target=url.pathname+url.search;
  if(state.tasks.find(task=>task.key===key)?.url===target)return;
  await protect(()=>{const task=state.tasks.find(task=>task.key===key);if(task)task.url=target;});
 },
 async rememberDirectory(url:URL,scroll=0,focus:string|null=null){const path=url.pathname+url.search;if(!valid(path)||url.pathname!==options.base+'/manage')throw Error('目录返回目标无效。');await protect(()=>{state.directory=path;state.scroll=Math.max(0,scroll);state.focus=focus;});},
 async forgetAsset(asset:{pageId:string;resourceId:string}){await protect(()=>{state.tasks=state.tasks.filter(task=>{const url=new URL(task.url,options.origin);return url.searchParams.get('page')!==asset.pageId||!!url.searchParams.get('resource')&&url.searchParams.get('resource')!==asset.resourceId;});if(!state.tasks.some(task=>task.key===state.current))state.current=null;});},
 dispose(){disposed=true;listeners.clear();runtimes.clear();}
 };
}
