<script lang="ts">
  import {onMount,setContext,untrack} from 'svelte';
  import PrimaryAction from './PrimaryAction.svelte';
  import {createHref,resolvePlatformRoute} from './integration/routes';
  import ToolAction from './ToolAction.svelte';
  import {PLATFORM_CONTEXT,type PlatformServices} from './integration/services';
  import PlatformFrame from './PlatformFrame.svelte';
  import ManagementList from './views/ManagementList.svelte';
  import PageReading from './views/PageReading.svelte';
  import PageInfoView from './views/PageInfoView.svelte';
  import PageAuthoringWorkbench from './PageAuthoringWorkbench.svelte';
  let {services}: {services:PlatformServices} = $props();
  untrack(()=>setContext(PLATFORM_CONTEXT, services));
  let url = $state(untrack(()=>services.navigation.current()));
  let active = $state(untrack(()=>services.session.isActive()));
  let work=$state(untrack(()=>services.workSession.snapshot()));
  let restored=$state(false);let opening=$state(false);let workError=$state('');
  let DevView = $state<import('svelte').Component | null>(null);
  const route = $derived(resolvePlatformRoute(url,services.navigation.base).route);
  const path = $derived(route.path);
  const creating = $derived(route.kind==='create');
  const key = $derived(url.pathname + url.search);
  onMount(() => {
    const stopWork=services.workSession.subscribe(value=>{work=value;});
    void services.workSession.restore().then(()=>{restored=true;}).catch(error=>{workError=String(error);});
    const stopRoute=services.navigation.subscribe(value=>{url=value;});
    const stopSession=services.session.onInvalidate(()=>{active=false;});
    return ()=>{stopRoute();stopSession();stopWork();};
  });
  $effect(()=>{
    if(!active||!restored||route.kind!=='create'||DevView)return;
    workError='';opening=true;
    const next=new URL(url),from=services.navigation.checkpoint(),controller=new AbortController();
    const currentRoute=route;
    void (async()=>{
      if(services.dialogueSessions){
        const id=await services.dialogueSessions.open(currentRoute.sessionId,next.href);
        controller.signal.throwIfAborted();next.searchParams.set('sessionId',id);next.searchParams.delete('task');next.searchParams.delete('new');next.searchParams.sort();
      }
      if(currentRoute.pageId&&!currentRoute.resourceId&&!currentRoute.taskId){
        const asset=await services.pageAssets.resolve(currentRoute.pageId,controller.signal);
        controller.signal.throwIfAborted();next.searchParams.set('resource',asset.resourceId);
      }
      const target=await services.workSession.open(next,controller.signal);
      const destination=new URL(target,next);destination.hash=next.hash;
      if(!controller.signal.aborted&&destination.href!==from.href)await services.navigation.navigate(destination,{replaceState:true,signal:controller.signal,from});
    })().catch(error=>{if(!controller.signal.aborted)workError=String(error);}).finally(()=>{if(!controller.signal.aborted)opening=false;});
    return()=>{controller.abort();opening=false;};
  });
  $effect(() => {
    if (!services.embedded) document.title = (route.kind==='management'||route.kind==='settings') ? '页面管理 | MetricCanvas' : 'MetricCanvas 指标画布';
  });
  $effect(() => {
    DevView=null;
    if (import.meta.env.DEV) {
      const labs:Record<string,()=>Promise<{default:import('svelte').Component}>>={
        '/dialogue':()=>import('./views/dialogue.svelte'), '/language':()=>import('./views/language.svelte'),
        '/language-recovery':()=>import('./views/language-recovery.svelte'), '/publication':()=>import('./views/publication.svelte'),
        '/apply-page':()=>import('./views/apply-page.svelte')
      };
      let cancelled=false;
      if(labs[path]) void labs[path]().then(m=>{if(!cancelled)DevView=m.default;});
      return()=>{cancelled=true;};
    }
  });
</script>
<PlatformFrame {path}>
  {#if !active}<p role="alert">身份或服务目标已变化，请重新打开平台。原恢复记录已保留。</p>
  {:else}
    {#if workError}<p role="alert">{workError} 原恢复记录已保留。</p>{/if}
    {#if creating&&services.dialogueSessions&&(opening||workError)&&route.kind==='create'&&route.pageId}<PageReading pageId={route.pageId} resourceId={route.resourceId} editable={false}/>{/if}
    {#if restored}
      <div class="work-stack" class:work-stack-hidden={!creating||!work.current||!!DevView||opening||!!workError}>
        {#each work.tasks as task(task.key)}<div class="work-task" hidden={work.current!==task.key||!!DevView||opening||!!workError}><PageAuthoringWorkbench taskUrl={new URL(task.url,url.origin)} showPageInfo={route.kind==='create'&&route.showPageInfo&&work.current===task.key} active={creating&&work.current===task.key&&!DevView&&!opening&&!workError}/></div>{/each}
      </div>
      {#if creating&&!work.current&&!DevView&&!opening&&!workError}<section class="empty-workbench" aria-label="页面搭建工作台"><h1>页面搭建工作台</h1><p>尚无当前页面。点击新建页面开始创作，或从页面管理选择已有页面。</p><PrimaryAction onclick={()=>services.navigation.navigate(createHref(services.navigation.base,{newTask:true}))}>新建页面</PrimaryAction><ToolAction onclick={()=>services.navigation.navigate(work.directory)}>页面管理</ToolAction></section>{/if}
    {/if}
    {#key key}
      {#if DevView}<DevView/>
      {:else if creating}{#if !restored}<p role="status">正在恢复工作会话…</p>{/if}
      {:else if route.kind === 'management'}<ManagementList/>
      {:else if route.kind === 'settings'}<PageInfoView pageId={route.pageId} resourceId={route.resourceId}/>
      {:else if route.kind === 'reading'}<PageReading pageId={route.pageId} resourceId={route.resourceId}/>
      {:else if route.kind === 'invalid'}<p role="alert">{route.message}</p>
      {:else}<p role="alert">页面不存在。</p>{/if}
    {/key}
  {/if}
</PlatformFrame>

<style>.empty-workbench{padding:24px;max-width:900px;margin:auto;font-size:14px}.empty-workbench h1{font-size:20px;line-height:28px;font-weight:600}.empty-workbench p{color:#595959;line-height:1.6}.work-stack{height:100%;min-height:0}.work-stack.work-stack-hidden{display:none}.work-task{height:100%;min-height:0}.work-task[hidden]{display:none}</style>
