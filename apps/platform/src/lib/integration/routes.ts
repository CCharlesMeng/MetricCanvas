export const CREATE_PATH = '/create';
export type PlatformRoute =
  | {kind:'create';path:typeof CREATE_PATH;pageId:string|null;resourceId:string|null;taskId:string|null;newTask:boolean;showPageInfo:boolean}
  | {kind:'management';path:'/manage';page:number;state:''|'draft'|'published'}
  | {kind:'reading';path:string;pageId:string;resourceId:string|null}
  | {kind:'not-found';path:string}
  | {kind:'invalid';path:string;message:string};

export function normalizeRouteBase(base:string):string {
  if(!base.startsWith('/')||/[?#\\]/.test(base)||base.includes('//')||/%|(?:^|\/)\.{1,2}(?:\/|$)/.test(base))throw Error('routeBase 必须是绝对路径前缀。');
  return base.replace(/\/+$/,'');
}
export function isPlatformPath(path:string,base:string):boolean {return path===base||path.startsWith(`${base}/`);}
export function platformPath(base:string,path:string,params?:{pageId:string}):string {
  return `${base}${path.replace('[pageId]',encodeURIComponent(params?.pageId??''))}`;
}

/** Compatibility and canonicalization have one owner; applying this twice is a no-op. */
export function resolvePlatformRoute(input:URL,base:string):{url:URL;route:PlatformRoute} {
  const url=new URL(input),original=new URL(input);
  let path=isPlatformPath(url.pathname,base)?url.pathname.slice(base.length)||'/':url.pathname;
  const invalid=()=>({url:original,route:{kind:'invalid',path,message:'页面地址参数无效，请检查页面、资源或任务身份。'} as const});
  if(!isPlatformPath(url.pathname,base))return {url,route:{kind:'not-found',path}};
  path=path.replace(/\/+$/,'')||'/';
  if(path==='/'||path==='/ask')path=CREATE_PATH;
  const detail=/^\/manage\/pages\/([^/]+)(\/edit)?$/.exec(path);
  if(detail?.[2]){
    try{const pageId=decodeURIComponent(detail[1]);if(!pageId.trim())return invalid();url.searchParams.set('page',pageId);}catch{return invalid();}
    path=CREATE_PATH;url.searchParams.delete('reading');
  }
  url.pathname=platformPath(base,path);
  const query=url.searchParams;
  if(path===CREATE_PATH){
    for(const name of ['page','resource','task','new','info'])if(query.getAll(name).length>1)return invalid();
    const pageId=query.get('page'),resourceId=query.get('resource'),taskId=query.get('task');
    if([pageId,resourceId,taskId].some(value=>value!==null&&!value.trim())||resourceId&&!pageId)return invalid();
    if(query.has('new')&&query.get('new')!=='1')return invalid();
    if(query.get('new')==='1'&&!taskId&&pageId)return invalid();
    if(taskId)query.delete('new');
    const newTask=query.get('new')==='1',showPageInfo=query.get('info')==='1';
    if(!showPageInfo)query.delete('info');
    query.delete('reading');query.sort();
    return {url,route:{kind:'create',path:CREATE_PATH,pageId,resourceId,taskId,newTask,showPageInfo}};
  }
  if(path==='/manage'){
    if(query.getAll('page').length>1||query.getAll('state').length>1)return invalid();
    const page=Number(query.get('page')??1),state=query.get('state')??'';
    if(!Number.isSafeInteger(page)||page<1||!['','draft','published'].includes(state))return invalid();
    if(query.has('page'))query.set('page',String(page));
    if(!state)query.delete('state');query.sort();
    return {url,route:{kind:'management',path:'/manage',page,state:state as ''|'draft'|'published'}};
  }
  if(detail){
    let pageId:string;try{pageId=decodeURIComponent(detail[1]);}catch{return invalid();}
    const resourceId=query.get('resource');
    if(!pageId.trim()||query.getAll('resource').length>1||resourceId!==null&&!resourceId.trim())return invalid();
    query.delete('reading');query.sort();
    return {url,route:{kind:'reading',path,pageId,resourceId}};
  }
  return {url,route:{kind:'not-found',path}};
}

export function createHref(base:string,input:{pageId?:string;resourceId?:string;taskId?:string;newTask?:boolean;showPageInfo?:boolean}={}):string {
  const query=new URLSearchParams();
  if(input.pageId!==undefined)query.set('page',input.pageId);
  if(input.resourceId!==undefined)query.set('resource',input.resourceId);
  if(input.taskId!==undefined)query.set('task',input.taskId);
  if(input.newTask)query.set('new','1');
  if(input.showPageInfo)query.set('info','1');
  query.sort();return platformPath(base,CREATE_PATH)+(query.size?`?${query}`:'');
}

export function workTaskKey(route:Extract<PlatformRoute,{kind:'create'}>):string|null {
  return route.taskId?`new:${route.taskId}`:route.pageId?JSON.stringify([route.pageId,route.resourceId]):null;
}

/** Allocate an explicit new-task command once, before publishing an address or awaiting guards. */
export function navigationTarget(input:URL,base:string):URL {
  const {url,route}=resolvePlatformRoute(input,base);
  if(route.kind==='create'&&route.newTask){url.searchParams.set('task',crypto.randomUUID());url.searchParams.delete('new');url.searchParams.sort();}
  return url;
}

export function managementHref(base:string,page:number,state:string=''):string {
  const query=new URLSearchParams({page:String(page)});if(state)query.set('state',state);
  return platformPath(base,'/manage')+`?${query}`;
}
export function readingHref(base:string,pageId:string,resourceId:string):string {
  return platformPath(base,'/manage/pages/[pageId]',{pageId})+`?${new URLSearchParams({resource:resourceId})}`;
}
