export const CREATE_PATH = '/create';
export type PlatformRoute =
  | {kind:'create';path:typeof CREATE_PATH;pageId:string|null;resourceId:string|null;taskId:string|null;sessionId:string|null;newTask:boolean;showPageInfo:boolean}
  | {kind:'management';path:'/manage';page:number;state:''|'draft'|'published'}
  | {kind:'reading'|'settings';path:string;pageId:string;resourceId:string|null}
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

type RouteResult={url:URL;route:PlatformRoute};
const invalid=(url:URL,path:string):RouteResult=>({url,route:{kind:'invalid',path,message:'页面地址参数无效，请检查页面、资源、任务或会话身份。'}});
function invalidIdentity(query:URLSearchParams,names:string[]):boolean {
  return names.some(name=>query.getAll(name).length>1||query.has(name)&&!query.get(name)!.trim());
}
function createRoute(url:URL,original:URL):RouteResult {
  const query=url.searchParams;
  if(invalidIdentity(query,['page','pageId','resource','task','sessionId','new','info']))return invalid(original,CREATE_PATH);
  if(query.has('pageId')){
    if(query.has('page')&&query.get('page')!==query.get('pageId'))return invalid(original,CREATE_PATH);
    query.set('page',query.get('pageId')!);query.delete('pageId');
  }
  const pageId=query.get('page'),resourceId=query.get('resource'),taskId=query.get('task'),sessionId=query.get('sessionId');
  if(resourceId&&!pageId)return invalid(original,CREATE_PATH);
  if(query.has('new')&&query.get('new')!=='1')return invalid(original,CREATE_PATH);
  if(query.get('new')==='1'&&!taskId&&pageId)return invalid(original,CREATE_PATH);
  if(taskId)query.delete('new');
  const newTask=query.get('new')==='1',showPageInfo=query.get('info')==='1';
  if(!showPageInfo)query.delete('info');
  query.delete('reading');query.sort();
  return {url,route:{kind:'create',path:CREATE_PATH,pageId,resourceId,taskId,sessionId,newTask,showPageInfo}};
}
function managementRoute(url:URL,original:URL):RouteResult {
  const query=url.searchParams;
  if(query.getAll('page').length>1||query.getAll('state').length>1)return invalid(original,'/manage');
  const page=Number(query.get('page')??1),state=query.get('state')??'';
  if(!Number.isSafeInteger(page)||page<1||!['','draft','published'].includes(state))return invalid(original,'/manage');
  if(query.has('page'))query.set('page',String(page));
  if(!state)query.delete('state');query.sort();
  return {url,route:{kind:'management',path:'/manage',page,state:state as ''|'draft'|'published'}};
}
function detailRoute(url:URL,original:URL,encoded:string,settings:boolean):RouteResult {
  let pageId:string;try{pageId=decodeURIComponent(encoded);}catch{return invalid(original,url.pathname);}
  if(!pageId.trim()||invalidIdentity(url.searchParams,['resource']))return invalid(original,url.pathname);
  const resourceId=url.searchParams.get('resource');url.searchParams.delete('reading');url.searchParams.sort();
  return {url,route:{kind:settings?'settings':'reading',path:url.pathname,pageId,resourceId}};
}
/** Compatibility and canonicalization have one owner; applying this twice is a no-op. */
export function resolvePlatformRoute(input:URL,base:string):RouteResult {
  const url=new URL(input),original=new URL(input);
  if(!isPlatformPath(url.pathname,base))return {url,route:{kind:'not-found',path:url.pathname}};
  let path=(url.pathname.slice(base.length)||'/').replace(/\/+$/,'')||'/';
  if(path==='/'||path==='/ask')path=CREATE_PATH;
  const detail=/^\/manage\/pages\/([^/]+)(\/edit|\/settings)?$/.exec(path);
  if(detail?.[2]==='/edit'){
    try{const id=decodeURIComponent(detail[1]);if(!id.trim())return invalid(original,path);url.searchParams.set('page',id);}catch{return invalid(original,path);}
    path=CREATE_PATH;url.searchParams.delete('reading');
  }
  url.pathname=platformPath(base,path);
  if(path===CREATE_PATH)return createRoute(url,original);
  if(path==='/manage')return managementRoute(url,original);
  if(detail)return detailRoute(url,original,detail[1],detail[2]==='/settings');
  return {url,route:{kind:'not-found',path}};
}

export function createHref(base:string,input:{pageId?:string;resourceId?:string;taskId?:string;sessionId?:string;newTask?:boolean;showPageInfo?:boolean}={}):string {
  const query=new URLSearchParams();
  if(input.pageId!==undefined)query.set('page',input.pageId);
  if(input.resourceId!==undefined)query.set('resource',input.resourceId);
  if(input.taskId!==undefined)query.set('task',input.taskId);
  if(input.sessionId!==undefined)query.set('sessionId',input.sessionId);
  if(input.newTask)query.set('new','1');
  if(input.showPageInfo)query.set('info','1');
  query.sort();return platformPath(base,CREATE_PATH)+(query.size?`?${query}`:'');
}

export function workTaskKey(route:Extract<PlatformRoute,{kind:'create'}>):string|null {
  if(route.sessionId)return 'session:'+route.sessionId;
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

export function settingsHref(base:string,pageId:string,resourceId:string):string {
  return platformPath(base,'/manage/pages/[pageId]/settings',{pageId})+'?'+new URLSearchParams({resource:resourceId});
}
