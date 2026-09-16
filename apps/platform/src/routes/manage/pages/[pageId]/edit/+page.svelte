<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  onMount(() => { const query=new URLSearchParams({page:page.params.pageId ?? ''});const resource=page.url.searchParams.get('resource');if(resource)query.set('resource',resource);void goto(`${resolve('/')}?${query}`,{replaceState:true}); });
</script>
<p>正在打开页面搭建工作台…</p>
