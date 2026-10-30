<script lang="ts">
  import { Button } from '@metriccanvas/ui';
  import { RuntimeView } from '@metriccanvas/engine/ui';
  import { dataGateway, aiSummary } from '$lib/services';
  import dashboard from '../../../../../../pages/capabilities/layout/loading-structure-demo.json';
  import report from '../../../../../../pages/capabilities/layout/loading-ai-summary-demo.json';

  let replay = $state(0);
</script>

<svelte:head><title>全部组件加载总览 · MetricCanvas</title></svelte:head>
<div class="review-tools">
  <h1>全部组件加载总览</h1>
  <Button onclick={() => replay += 1}>重新播放全部加载</Button>
  <p>19种组件与IOC页头。查询等待3秒；AI总结使用本地Mock。静态组件直接显示，数据返回后转圈消失。</p>
</div>
{#key replay}
  <section aria-label="Dashboard 组件" data-review-surface="dashboard">
    <RuntimeView document={dashboard} {dataGateway} {aiSummary} />
  </section>
  <section aria-label="Report 组件" data-review-surface="report">
    <RuntimeView document={report} {dataGateway} {aiSummary} />
  </section>
{/key}

<style>
  .review-tools { display: flex; align-items: center; flex-wrap: wrap; gap: 12px 24px; padding: 20px 24px; border-bottom: 1px solid #e4e4e7; background: #fff; }
  h1 { margin: 0; font-size: 20px; }
  p { flex-basis: 100%; margin: 0; color: #71717a; font-size: 13px; line-height: 1.6; }
  section { min-width: 0; }
</style>
