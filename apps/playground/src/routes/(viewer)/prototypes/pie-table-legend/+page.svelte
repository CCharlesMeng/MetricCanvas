<!-- THROWAWAY: three arrangements of the agreed table legend in the Playground.
     ?variant=A|B|C. Synthetic data only; no production page contract is changed. -->
<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { Button, Select } from '@metriccanvas/ui';
  import PrototypeSwitcher from '$lib/prototypes/PrototypeSwitcher.svelte';
  import LegendChart from '../../../../../../../packages/engine/widgets/src/components/pie-chart/prototype/LegendChart.svelte';
  import { bands, variants, orderedBands, moveBand, type Order, type Position } from '../../../../../../../packages/engine/widgets/src/components/pie-chart/prototype/model';

  const variant = $derived(variants.find(item => item.key === page.url.searchParams.get('variant')) ?? variants[0]!);
  let position = $state<Position>('right');
  let order = $state<Order>('stable');
  let ring = $state(true);
  let columns = $state('both');
  let suppliedShare = $state(true);
  let custom = $state(bands.map(band => band.name));
  let narrow = $state(false);
  const rows = $derived(orderedBands(order, custom));
  const settings = $derived({ position, order, ring, columns, suppliedShare });
  const prototypeState = $derived({ variant: variant.key, ...settings, width: narrow ? '窄卡片' : '标准卡片', rowOrder: rows.map(row => row.name) });

  $effect(() => {
    position = variant.key === 'B' ? 'left' : 'right';
    ring = variant.key !== 'B';
    narrow = variant.key === 'C';
  });
  function switchVariant(key: string) {
    const url = new URL(page.url);
    url.searchParams.set('variant', key);
    void goto(url, { replaceState: true, noScroll: true, keepFocus: true });
  }
  function move(index: number, direction: number) {
    custom = moveBand(rows, index, direction);
    order = 'custom';
  }
</script>

<svelte:head><title>饼图表格式图例 · 交互原型</title></svelte:head>

<main>
  <header class="page-header">
    <div><p class="eyebrow">客户经营分析 · 交互原型</p><h1>框架执行概况</h1></div>
    <span class="data-note">合成演示数据 · 非真实客户数据</span>
  </header>

  <section class="controls" aria-label="原型配置">
    <label>图例位置<Select label="图例位置" value={position} searchable={false} options={[{value:'right',label:'右侧'},{value:'left',label:'左侧'}]} onchange={value => position = value as Position} /></label>
    <label>排列顺序<Select label="排列顺序" value={order} searchable={false} options={[{value:'stable',label:'固定图例顺序'},{value:'desc',label:'客户数量降序'},{value:'asc',label:'客户数量升序'},{value:'custom',label:'自定义顺序'}]} onchange={value => order = value as Order} /></label>
    <label>图表形态<Select label="图表形态" value={ring ? 'ring' : 'pie'} searchable={false} options={[{value:'ring',label:'环形图'},{value:'pie',label:'饼图'}]} onchange={value => ring = value === 'ring'} /></label>
    <label>数据列<Select label="数据列" value={columns} searchable={false} options={[{value:'both',label:'客户数量 / 占比'},{value:'share-first',label:'占比 / 客户数量'},{value:'count',label:'仅客户数量'}]} onchange={value => columns = value} /></label>
    <label>占比来源<Select label="占比来源" value={suppliedShare ? 'field' : 'computed'} searchable={false} options={[{value:'field',label:'返回字段'},{value:'computed',label:'按客户数计算'}]} onchange={value => suppliedShare = value === 'field'} /></label>
    <Button onclick={() => narrow = !narrow}>{narrow ? '恢复标准宽度' : '查看窄卡片'}</Button>
  </section>

  <div class="workspace">
    <section class="chart-card" class:narrow aria-label="图表预览">
      <h2>框架执行率分布区间的客户数及占比</h2>
      <LegendChart {rows} {settings} />
    </section>

    <section class="review-note" aria-label="原型说明">
      <h3>{variant.name}</h3><p>{variant.note}</p>
      <p>默认按区间配置顺序排列，客户数量变化不重排。扇区从十二点方向顺时针跟随图例。悬停扇区可查看数据；图例点击不会隐藏区间。</p>
      <div class="current-state" aria-live="polite">{position === 'right' ? '右侧' : '左侧'}图例 · {({stable:'固定图例顺序',desc:'数量降序',asc:'数量升序',custom:'自定义顺序'})[order]} · {ring ? '环形图' : '饼图'} · {rows.length} 个区间</div>
      <h3 class="order-title">自定义顺序</h3>
      <p>用上下箭头调整；调整后自动切到自定义。</p>
      <ol>{#each rows as row, index (row.name)}
        <li><span><i style:background={row.color}></i>{row.name}</span><div>
          <Button ariaLabel={`上移 ${row.name}`} disabled={index === 0} onclick={() => move(index, -1)}>↑</Button>
          <Button ariaLabel={`下移 ${row.name}`} disabled={index === rows.length - 1} onclick={() => move(index, 1)}>↓</Button>
        </div></li>
      {/each}</ol>
      <details><summary>查看原型状态</summary><pre>{JSON.stringify(prototypeState, null, 2)}</pre></details>
      <p class="boundary">区间文案、数量及占比均为合成数据。该原型仅验证呈现与排序，尚未接入正式页面协议。</p>
    </section>
  </div>
</main>

<PrototypeSwitcher {variants} value={variant.key} onchange={switchVariant} />

<style>
  main { max-width: 1420px; margin: auto; padding: 28px 32px 110px; }
  .page-header { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
  .eyebrow { color: #777; font-size: 12px; margin: 0 0 8px; }
  h1 { margin: 0; font-size: 24px; font-weight: 600; }
  .data-note { font-size: 12px; color: #999; }
  .controls { display: flex; align-items: end; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
  .controls label { display: grid; gap: 8px; font-size: 12px; color: #595959; min-width: 120px; }
  .workspace { display: grid; grid-template-columns: minmax(0, 1fr) 240px; gap: 28px; align-items: start; }
  .chart-card { background: white; border-radius: 8px; padding: 20px; min-width: 0; width: 100%; box-sizing: border-box; }
  .chart-card.narrow { max-width: 510px; }
  h2 { margin: 0; font-size: 16px; font-weight: 500; line-height: 24px; color: #191919; }
  .review-note { font-size: 12px; line-height: 1.8; color: #777; }
  h3 { margin: 0 0 4px; font-size: 13px; color: #191919; font-weight: 500; }
  p { margin: 0 0 14px; }
  .current-state { color: #595959; margin: 18px 0 24px; }
  .order-title { margin-top: 18px; }
  ol { margin: 0; padding: 0; list-style: none; }
  li { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 5px 0; }
  li > span { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
  li > div { display: flex; gap: 5px; }
  i { width: 8px; height: 8px; border-radius: 50%; }
  details { margin-top: 24px; }
  summary { cursor: pointer; }
  pre { font-size: 10px; white-space: pre-wrap; line-height: 1.6; }
  .boundary { margin-top: 22px; font-size: 11px; color: #999; }
  @media (max-width: 1000px) { .workspace { grid-template-columns: minmax(0, 1fr); } .review-note { max-width: 580px; } }
  @media (max-width: 600px) { main { padding: 20px 16px 110px; } .page-header { align-items: start; flex-direction: column; gap: 10px; } .controls { gap: 14px 12px; } .controls label { width: calc(50% - 6px); min-width: 0; } .chart-card { padding: 16px 10px; } h2 { font-size: 14px; } }
</style>
