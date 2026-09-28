<script lang="ts">
  import {onMount,setContext,untrack} from 'svelte';
  import {PLATFORM_CONTEXT,type PlatformServices} from './integration/services';
  import PlatformFrame from './PlatformFrame.svelte';
  import ManagementList from './views/ManagementList.svelte';
  import AskView from './views/ask.svelte';
  import ManagementDetail from './views/ManagementDetail.svelte';
  import PageAuthoringWorkbench from './PageAuthoringWorkbench.svelte';
  let {services}: {services:PlatformServices} = $props();
  untrack(()=>setContext(PLATFORM_CONTEXT, services));
  let url = $state(untrack(()=>services.navigation.current()));
  let active = $state(untrack(()=>services.session.isActive()));
  let DevView = $state<import('svelte').Component | null>(null);
  let Prototype = $state<typeof import('./prototype/platform-style/PlatformStylePrototype.svelte').default|null>(null);
  const path = $derived(url.pathname.slice(services.navigation.base.length) || '/');
  const detail = $derived(/^\/manage\/pages\/([^/]+)(\/edit)?\/?$/.exec(path));
  const pageId = $derived.by(() => {try {return detail ? decodeURIComponent(detail[1]) : '';} catch {return '';}});
  const key = $derived(url.pathname + url.search);
  onMount(() => {
    const stopRoute=services.navigation.subscribe(value=>{url=value;});
    const stopSession=services.session.onInvalidate(()=>{active=false;});
    return ()=>{stopRoute();stopSession();};
  });
  $effect(() => {
    if (!services.embedded) document.title = path.startsWith('/manage') ? '页面管理 | MetricCanvas' : 'MetricCanvas 指标画布';
    if (detail?.[2]) {
      const query = new URLSearchParams(url.search);query.set('page',pageId);
      void services.navigation.navigate(`${services.navigation.resolve('/')}?${query}`,{replaceState:true});
    }
  });
  $effect(() => {
    DevView=null;Prototype=null;
    if (import.meta.env.DEV) {
      const labs:Record<string,()=>Promise<{default:import('svelte').Component}>>={
        '/dialogue':()=>import('./views/dialogue.svelte'), '/language':()=>import('./views/language.svelte'),
        '/language-recovery':()=>import('./views/language-recovery.svelte'), '/publication':()=>import('./views/publication.svelte'),
        '/apply-page':()=>import('./views/apply-page.svelte')
      };
      let cancelled=false;
      if(labs[path]) void labs[path]().then(m=>{if(!cancelled)DevView=m.default;});
      if(path==='/' && ['A','B','C'].includes(url.searchParams.get('variant')??'')) void import('./prototype/platform-style/PlatformStylePrototype.svelte').then(m=>{if(!cancelled)Prototype=m.default;});
      return()=>{cancelled=true;};
    }
  });
</script>
<PlatformFrame {path}>
  {#if !active}<p role="alert">身份或服务目标已变化，请重新打开平台。原恢复记录已保留。</p>
  {:else}
    {#key key}
      {#if DevView}<DevView/>
      {:else if Prototype}<Prototype variant={(url.searchParams.get('variant')??'A') as 'A'|'B'|'C'}/>
      {:else if path === '/'}<PageAuthoringWorkbench/>
      {:else if path === '/manage' || path === '/manage/'}<ManagementList/>
      {:else if detail && !detail[2] && pageId}<ManagementDetail {pageId} {url}/>
      {:else if detail?.[2]}<p>正在打开页面搭建工作台…</p>
      {:else if path === '/ask'}<AskView/>
      {:else}<p role="alert">页面不存在。</p>{/if}
    {/key}
  {/if}
</PlatformFrame>
