<script lang="ts">
  import {onMount,setContext,untrack} from 'svelte';
  import PrimaryAction from './PrimaryAction.svelte';
  import ToolAction from './ToolAction.svelte';
  import {PLATFORM_CONTEXT,type PlatformServices} from './integration/services';
  import PlatformFrame from './PlatformFrame.svelte';
  import ManagementList from './views/ManagementList.svelte';
  import PageReading from './views/PageReading.svelte';
  import PageAuthoringWorkbench from './PageAuthoringWorkbench.svelte';
  let {services}: {services:PlatformServices} = $props();
  untrack(()=>setContext(PLATFORM_CONTEXT, services));
  let url = $state(untrack(()=>services.navigation.current()));
  let active = $state(untrack(()=>services.session.isActive()));
  let work=$state(untrack(()=>services.workSession.snapshot()));
  let restored=$state(false);let opening=$state(false);let workError=$state('');
  let DevView = $state<import('svelte').Component | null>(null);
  const path = $derived(url.pathname.slice(services.navigation.base.length) || '/');
  const detail = $derived(/^\/manage\/pages\/([^/]+)(\/edit)?\/?$/.exec(path));
  const pageId = $derived.by(() => {try {return detail ? decodeURIComponent(detail[1]) : '';} catch {return '';}});
  const key = $derived(url.pathname + url.search);
  onMount(() => {
    const stopWork=services.workSession.subscribe(value=>{work=value;});
    void services.workSession.restore().then(()=>{restored=true;}).catch(error=>{workError=String(error);});
    const stopRoute=services.navigation.subscribe(value=>{url=value;});
    const stopSession=services.session.onInvalidate(()=>{active=false;});
    return ()=>{stopRoute();stopSession();stopWork();};
  });
  $effect(()=>{
    if(!restored||path!=='/'||DevView)return;
    workError='';opening=true;
    const next=new URL(url),controller=new AbortController();
    void (async()=>{
      if(next.searchParams.has('page')&&!next.searchParams.has('resource')&&!next.searchParams.has('task')){
        const asset=await services.pageAssets.resolve(next.searchParams.get('page')!,controller.signal);
        if(controller.signal.aborted)return;next.searchParams.set('resource',asset.resourceId);
      }
      const target=await services.workSession.open(next);
      if(!controller.signal.aborted&&target!==url.pathname+url.search&&path==='/')await services.navigation.navigate(target,{replaceState:true});
    })().catch(error=>{if(!controller.signal.aborted)workError=String(error);}).finally(()=>{if(!controller.signal.aborted)opening=false;});
    return()=>controller.abort();
  });
  $effect(() => {
    if (!services.embedded) document.title = path.startsWith('/manage') ? '页面管理 | MetricCanvas' : 'MetricCanvas 指标画布';
    if(path==='/ask')void services.navigation.navigate(services.navigation.resolve('/'),{replaceState:true});
    if (detail && (detail[2] || url.searchParams.get('reading')!=='1')) {
      const query = new URLSearchParams(url.search);query.set('page',pageId);
      query.delete('reading');if(!detail[2])query.set('info','1');
      void services.navigation.navigate(`${services.navigation.resolve('/')}?${query}`,{replaceState:true});
    }
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
    {#if restored}
      {#each work.tasks as task(task.key)}<div class="work-task" hidden={path!=='/'||work.current!==task.key||!!DevView||opening||!!workError}><PageAuthoringWorkbench taskUrl={new URL(task.url,url.origin)} showPageInfo={url.searchParams.get('info')==='1'&&work.current===task.key} active={path==='/'&&work.current===task.key&&!DevView&&!opening&&!workError}/></div>{/each}
      {#if path==='/'&&!work.current&&!DevView&&!url.searchParams.has('page')&&!url.searchParams.has('task')&&!url.searchParams.has('new')}<section class="empty-workbench" aria-label="页面搭建工作台"><h1>页面搭建工作台</h1><p>尚无当前页面。点击新建页面开始创作，或从页面管理选择已有页面。</p><PrimaryAction onclick={()=>services.navigation.navigate(`${services.navigation.resolve('/')}?new=1`)}>新建页面</PrimaryAction><ToolAction onclick={()=>services.navigation.navigate(work.directory)}>页面管理</ToolAction></section>{/if}
    {/if}
    {#key key}
      {#if DevView}<DevView/>
      {:else if path === '/'}{#if !restored}<p role="status">正在恢复工作会话…</p>{/if}
      {:else if path === '/manage' || path === '/manage/'}<ManagementList/>
      {:else if detail && !detail[2] && pageId}<PageReading {pageId} {url}/>
      {:else if detail?.[2]}<p>正在打开页面搭建工作台…</p>
      {:else if path === '/ask'}<p role="status">正在打开创作入口…</p>
      {:else}<p role="alert">页面不存在。</p>{/if}
    {/key}
  {/if}
</PlatformFrame>

<style>.empty-workbench{padding:24px;max-width:900px;margin:auto;font-size:14px}.empty-workbench h1{font-size:20px;line-height:28px;font-weight:600}.empty-workbench p{color:#595959;line-height:1.6}.work-task{height:100%;min-height:0}.work-task[hidden]{display:none}</style>
