<script lang="ts">
  import { Tabs, Select, Button } from '@metriccanvas/ui';
  import { RuntimeView } from '@metriccanvas/engine/ui';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { pageRepository } from '$lib/services';
  import { businessReviewPages, businessScenarios, createIocBusinessPreview } from '$lib/ioc-business-preview';

  const selected=$derived(businessReviewPages.some(item=>item.value===page.url.searchParams.get('view'))
    ?page.url.searchParams.get('view')!:businessReviewPages[0]!.value);
  let scenario=$state('ready'),context=$state(1);
  const preview=$derived(createIocBusinessPreview(selected,scenario,`review-${context}`));
  const document=$derived(pageRepository.load(selected));
  const labels:Record<string,string>={ready:'正常',slow:'慢请求',error:'失败与重试',empty:'成功为空',forbidden:'无权限',unconfigured:'未配置',partial:'候选不完整','read-only':'只读'};
  const navigation={returnContext:{entryId:'/',label:'返回'},back:()=>void goto('/')};
</script>

<svelte:head><title>IOC页头 · B组整体确认</title></svelte:head>
<div class="review-tools">
  <div class="tabs"><Tabs options={businessReviewPages} value={selected} label="B组验收场景" onchange={value=>void goto(`/ioc-header-review?view=${value}`)}/></div>
  <div class="controls">
    <Select label="合成输入场景" value={scenario} options={businessScenarios.map(value=>({value,label:labels[value]!}))} onchange={value=>scenario=value}/>
    <Button onclick={()=>context+=1}>切换合成上下文</Button>
    <a href={`/pages/${selected}`}>独立打开当前页面</a>
  </div>
  <p>本页用于一次查看B组组件与交互。候选、权限对象和查询均含合成数据；原始字典、真实服务与逐源接线的缺口在各场景正文说明。</p>
</div>
{#key `${selected}-${scenario}-${context}`}
  {#await document}<p role="status">加载验收页面…</p>{:then document}
    <RuntimeView {document} {navigation}
      displayInputs={preview.displayInputs} dataGateway={preview.dataGateway}
      filterEditing={{readOnly:scenario==='read-only'}}/>
  {:catch}<p role="alert">验收页面加载失败</p>{/await}
{/key}

<style>
  .review-tools{padding:12px 20px;background:#fafafa;border-bottom:1px solid #e4e4e7}
  .tabs{overflow-x:auto}.controls{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:12px}
  p,a{font-size:13px;color:#52525b}p{line-height:1.6}
</style>
