<script lang="ts">
  // PROTOTYPE: one time control in the Dashboard's common top filter area.
  import PeriodPickerPrototype from './PeriodPickerPrototype.svelte';
  const modes = [{id:'year',label:'年'},{id:'quarter',label:'季'},{id:'month',label:'月'},{id:'rolling',label:'近一年'}];
  const currentDate = new Date();
  const pad = (n: number) => String(n).padStart(2,'0');
  const formatDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  const today = formatDate(currentDate);
  const rollingStart = new Date(currentDate.getFullYear(),currentDate.getMonth()-12,1);
  const rollingEnd = new Date(currentDate.getFullYear(),currentDate.getMonth(),0);
  const rollingLabel = `${String(rollingStart.getFullYear()).slice(2)}年${rollingStart.getMonth()+1}月~${String(rollingEnd.getFullYear()).slice(2)}年${rollingEnd.getMonth()+1}月`;
  let mode = $state('rolling');
  let anchor = $state(today);
  let showSpec = $state(false);
  const year = $derived(Number(anchor.slice(0,4)));
  const month = $derived(Number(anchor.slice(5,7)));
  const quarter = $derived(Math.ceil(month/3));
  const period = $derived.by(() => {
    if(mode === 'year') return {from:`${year}-01-01`,to:`${year}-12-31`,title:`${year} 年`,unit:'月'};
    if(mode === 'quarter') {const end = quarter*3; return {from:`${year}-${pad(end-2)}-01`,to:`${year}-${pad(end)}-${new Date(year,end,0).getDate()}`,title:`${year} 年 Q${quarter}`,unit:'月'};}
    if(mode === 'month') return {from:`${year}-${pad(month)}-01`,to:`${year}-${pad(month)}-${new Date(year,month,0).getDate()}`,title:`${year} 年 ${month} 月`,unit:'日'};
    return {from:formatDate(rollingStart),to:formatDate(rollingEnd),title:`近一年 · ${rollingLabel}`,unit:'月'};
  });
  const chartLabels = $derived(mode === 'month' ? ['01 日','05 日','10 日','15 日','20 日','25 日','月底'] : mode === 'quarter' ? [`${quarter*3-2} 月`,`${quarter*3-1} 月`,`${quarter*3} 月`] : mode === 'rolling' ? [0,2,4,6,8,11].map(offset => {const d=new Date(rollingStart.getFullYear(),rollingStart.getMonth()+offset,1);return `${String(d.getFullYear()).slice(2)} 年 ${d.getMonth()+1} 月`;}) : ['1 月','3 月','5 月','7 月','9 月','12 月']);
</script>

<svelte:head><title>Dashboard 时间选择 · OpenTiny 风格交互原型</title></svelte:head>

{#snippet timeControl()}
  <div class="time-control">
    <div class="segments" role="group" aria-label="时间粒度">
      {#each modes as item}<button class:active={mode===item.id} aria-pressed={mode===item.id} onclick={() => mode=item.id}>{item.label}</button>{/each}
    </div>
    {#if mode === 'rolling'}
      <span class="rolling-range" aria-label="近一年数据范围">{rollingLabel}</span>
    {:else}
      <PeriodPickerPrototype {mode} {anchor} onchange={date => anchor=date} />
    {/if}
  </div>
{/snippet}

<div class="prototype-banner"><span><i></i> 交互设计稿 <b>/</b> Dashboard 时间选择</span><button onclick={() => showSpec=!showSpec}>{showSpec?'收起联动说明':'查看联动说明'} <span aria-hidden="true">↗</span></button></div>
<div class="shell">
  <aside class="sidebar"><div class="brand"><span class="brand-mark">M</span> MetricCanvas</div><div class="workspace">数据工作空间 <span>⌄</span></div><div class="nav-title">数据应用</div><div class="nav-item selected"><span>▦</span> 经营概览</div><div class="nav-item"><span>▤</span> 专题分析</div><div class="nav-item"><span>▧</span> 数据报表</div><div class="sidebar-bottom"><span class="avatar">林</span><div>林晓 <small>数据分析师</small></div></div></aside>
  <main>
    <div class="breadcrumb">数据应用 <span>/</span> 经营概览</div>
    <section class="page-heading"><div><div class="eyebrow">BUSINESS OVERVIEW · 示例数据</div><h1>经营概览</h1><p>关注核心经营表现，洞察业务增长趋势</p></div></section>
    <section class="filter-row" aria-label="Dashboard 顶部筛选栏"><span class="filter-label">统计时间</span>{@render timeControl()}</section>
    <div class="period-note"><span class="blue-dot"></span><strong>{period.title}</strong><span class="divider"></span><span>{period.from} 至 {period.to}</span><small>示例数据</small></div>
    <div class="metrics">
      {#each [{label:'营业收入',value:'2,846.52',unit:'万元',change:'+12.8%',line:'M0 30 L15 26 L30 31 L45 21 L60 24 L75 15 L90 18 L110 5'}, {label:'成交订单',value:'18,392',unit:'笔',change:'+8.6%',line:'M0 30 L15 32 L30 25 L45 28 L60 18 L75 20 L90 9 L110 6'}, {label:'活跃客户',value:'6,248',unit:'位',change:'+6.2%',line:'M0 32 L15 22 L30 25 L45 15 L60 20 L75 11 L90 13 L110 7'}, {label:'订单转化率',value:'24.68',unit:'%',change:'+2.4%',line:'M0 25 L15 29 L30 24 L45 17 L60 20 L75 12 L90 15 L110 4'}] as card}
        <section class="metric"><div class="metric-label">{card.label}<span>ⓘ</span></div><div class="metric-number">{card.value}<small>{card.unit}</small></div><div class="metric-bottom"><span>同比 <b>{card.change}</b></span><svg viewBox="0 0 110 40" aria-hidden="true"><path d={card.line}/></svg></div></section>
      {/each}
    </div>
    <section class="chart-card">
      <div class="chart-heading"><div><h2>收入趋势</h2><p>{period.title} · 按{period.unit}查看经营走势</p></div><div class="legend"><span></span>营业收入 <i></i>上年同期</div></div>
      <div class="chart"><div class="axis"><span>800</span><span>600</span><span>400</span><span>200</span><span>0</span></div><div class="plot"><div class="grid-lines"><i></i><i></i><i></i><i></i><i></i></div><svg viewBox="0 0 1000 220" preserveAspectRatio="none" role="img" aria-label="示例收入趋势图"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1476ff" stop-opacity=".14"/><stop offset="100%" stop-color="#1476ff" stop-opacity="0"/></linearGradient></defs><path d="M0 175 C45 175 55 120 100 127 S155 170 200 135 S250 100 300 110 S345 140 400 97 S450 55 500 73 S550 120 600 78 S650 100 700 57 S755 65 800 47 S860 70 900 35 S960 48 1000 12 L1000 220 L0 220Z" fill="url(#fill)"/><path d="M0 185 C70 170 90 185 150 160 S235 172 300 145 S380 160 450 130 S530 148 600 118 S680 138 750 95 S840 123 900 85 S970 100 1000 70" fill="none" stroke="#b8c9e0" stroke-width="2" stroke-dasharray="6 5"/><path d="M0 175 C45 175 55 120 100 127 S155 170 200 135 S250 100 300 110 S345 140 400 97 S450 55 500 73 S550 120 600 78 S650 100 700 57 S755 65 800 47 S860 70 900 35 S960 48 1000 12" fill="none" stroke="#1476ff" stroke-width="2.5"/></svg><div class="x-axis">{#each chartLabels as label}<span>{label}</span>{/each}</div></div></div>
    </section>
    <section class="design-note"><span class="note-icon">↔</span><div><strong>{mode==='rolling'?'近一年 · 自动计算数据范围':'时间粒度与日期选择联动'}</strong><p>{mode==='year'?'选择完整自然年，右侧展开年份面板。切换年／季／月时，沿用已选日期所在的期间。':mode==='quarter'?'选择自然季度，右侧展开季度面板，可切换年份。切换年／季／月时，沿用已选日期所在的期间。':mode==='month'?'选择完整自然月，右侧复用现有 OpenTiny 风格月份选择器。切换年／季／月时，沿用已选日期所在的期间。':'右侧仅展示数据范围，不提供日期选择。从当前月份向前取 12 个完整月份，不含当前月，不受年／季／月的已选日期影响。'}</p></div>{#if mode!=='rolling'}<button onclick={() => {anchor=today;}}>回到当前期间</button>{/if}</section>
    {#if showSpec}<section class="spec"><h2>联动说明</h2><table><thead><tr><th>左侧选项</th><th>右侧日期框</th><th>实际时间范围</th></tr></thead><tbody><tr><td>年</td><td>2026 年 → 年份面板</td><td>2026-01-01 至 2026-12-31</td></tr><tr><td>季</td><td>2026 年 Q4 → 季度面板</td><td>2026-10-01 至 2026-12-31</td></tr><tr><td>月</td><td>2026-10 → 月份面板</td><td>2026-10-01 至 2026-10-31</td></tr><tr><td>近一年</td><td>只读文本：25年10月~26年9月</td><td>当前为 2026 年 10 月时：2025-10-01 至 2026-09-30</td></tr></tbody></table><p>近一年按页面打开时的当前月份计算，不含当前月，不受日期锚点影响；范围含首尾。年／季为扩展草案，月复用现有月份组件。组件统一放置于 Dashboard 顶部筛选栏。图表与指标为静态示例。</p><pre aria-label="当前联动状态">{JSON.stringify({mode,...(mode==='rolling'?{currentMonth:today.slice(0,7)}:{anchor}),from:period.from,to:period.to},null,2)}</pre></section>{/if}
    <footer>METRICCANVAS <span>Dashboard 时间筛选组件 · OpenTiny OS 风格</span></footer>
  </main>
</div>

<style>
  :global(body) { margin:0; color:#191919; background:#f5f6f8; font:14px/1.5 Helvetica,Arial,'PingFang SC','Microsoft YaHei',sans-serif; }
  :global(*) { box-sizing:border-box; }
  button { font:inherit; cursor:pointer; }
  button:focus-visible { outline:2px solid #1476ff; outline-offset:2px; }
  .prototype-banner { height:40px; padding:0 28px; display:flex; align-items:center; justify-content:space-between; background:#fff; border-bottom:1px solid #e8e8e8; font-size:12px; color:#595959; }
  .prototype-banner i,.blue-dot { display:inline-block; width:6px; height:6px; border-radius:50%; background:#1476ff; margin-right:8px; }
  .prototype-banner b { font-weight:400; color:#c2c2c2; margin:0 12px; }.prototype-banner button { border:0; background:none; color:#595959; font-size:12px; }
  .shell { display:flex; min-height:calc(100vh - 40px); }.sidebar { width:200px; flex-shrink:0; background:#fff; border-right:1px solid #edf0f3; padding:26px 16px; display:flex; flex-direction:column; }
  .brand { display:flex; align-items:center; gap:9px; font-size:17px; font-weight:600; letter-spacing:-.5px; }.brand-mark { display:grid; place-items:center; width:28px; height:28px; background:#1476ff; color:white; border-radius:7px; font-size:19px; }.workspace { margin:30px 0 28px; padding:9px 10px; border:1px solid #e5e5e5; border-radius:6px; font-size:12px; }.workspace span {float:right;}.nav-title {font-size:11px; color:#999; padding:0 12px; margin-bottom:12px;}.nav-item {padding:11px 12px; border-radius:6px; margin-bottom:6px; color:#595959;}.nav-item>span {margin-right:12px;font-size:18px;}.selected {color:#1476ff; background:#edf4ff; font-weight:500;}.sidebar-bottom {margin-top:auto; padding:28px 8px 4px; display:flex; gap:10px; align-items:center;}.avatar {width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:#edf4ff;color:#1476ff;}.sidebar-bottom small {display:block;font-size:11px;color:#999;}
  main {padding:24px 32px 72px;flex:1;min-width:0;max-width:1680px;}.breadcrumb {font-size:12px;color:#808080;margin-bottom:26px;}.breadcrumb span {margin:0 12px;color:#c2c2c2;}.page-heading {display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;}.eyebrow {font-size:10px;letter-spacing:1.5px;color:#808080;}h1 {font-size:24px;font-weight:600;margin:6px 0;}h2 {font-size:16px;font-weight:600;margin:0;}.page-heading p {margin:0;color:#808080;font-size:12px;}
  .time-control {display:flex;align-items:center;gap:12px; flex-wrap:wrap;}.segments {height:32px;display:flex;border:1px solid #c2c2c2;border-radius:6px;background:#fff;overflow:hidden;}.segments button {height:30px;min-width:46px;padding:0 14px;border:0;border-right:1px solid #e5e5e5;background:#fff;color:#595959;white-space:nowrap;}.segments button:last-child {border-right:0;min-width:70px;}.segments button:hover {color:#1476ff;}.segments button.active {color:#1476ff;background:#deecff;font-weight:500;}
  .period-note {display:flex;align-items:center;gap:8px; margin:25px 0 18px; font-size:12px; color:#808080;flex-wrap:wrap;}.period-note .blue-dot {margin:0;width:5px;height:5px;}.period-note strong {font-weight:500;color:#595959;}.divider {height:12px;border-left:1px solid #d9d9d9;margin:0 4px;}.period-note small {margin-left:auto;font-size:11px;background:#edeff2;border-radius:4px;padding:2px 7px;color:#808080;}.filter-row {min-width:0;max-width:100%;margin:24px 0 18px;padding:12px 16px;background:#fff;border:1px solid #e4e4e7;border-radius:10px;display:flex;align-items:center;gap:20px;flex-wrap:wrap;}.filter-label {font-size:14px;color:#595959;}.rolling-range {display:inline-flex;align-items:center;min-height:32px;color:#191919;font-size:14px;white-space:nowrap;}
  .metrics {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px; margin-top:20px;}.metric {background:white;border:1px solid #edf0f3;border-radius:8px;padding:20px;}.metric-label {display:flex;justify-content:space-between;color:#595959;font-size:12px;}.metric-label>span {color:#b2b2b2;}.metric-number {margin-top:16px;font-size:28px;letter-spacing:-.5px;font-weight:600;white-space:nowrap;}.metric-number small {font-size:12px;color:#808080;margin-left:7px;font-weight:400;}.metric-bottom {display:flex;align-items:end;justify-content:space-between;gap:5px;margin-top:12px;}.metric-bottom>span {font-size:11px;color:#999;white-space:nowrap;}.metric-bottom b {font-weight:400;color:#199f61;margin-left:5px;}.metric svg {width:75px;height:30px;}.metric path {fill:none;stroke:#5c96ec;stroke-width:1.5;}
  .chart-card {background:#fff;border:1px solid #edf0f3;border-radius:8px;margin-top:20px;padding:24px;}.chart-heading {display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap;}.chart-heading p {font-size:12px;color:#999;margin:6px 0 0;}.legend {display:flex;align-items:center;gap:7px;font-size:11px;color:#808080;}.legend>span {width:7px;height:7px;background:#1476ff;border-radius:50%;}.legend i {width:7px;height:7px;background:#b8c9e0;border-radius:50%;margin-left:12px;}.chart {display:flex;gap:16px;margin-top:32px;height:230px;padding-right:8px;}.axis {display:flex;flex-direction:column;justify-content:space-between;padding-bottom:29px;font-size:10px;color:#999;width:24px;}.plot {position:relative;flex:1;min-width:0;}.grid-lines {position:absolute;inset:6px 0 28px;display:flex;flex-direction:column;justify-content:space-between;}.grid-lines i {border-top:1px dashed #e8ecf1;}.plot>svg {position:absolute;inset:5px 0 28px;width:100%;height:calc(100% - 33px);overflow:visible;}.x-axis {position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:space-between;font-size:10px;color:#999;}
  .design-note {display:flex;align-items:center;gap:14px;padding:20px 0;color:#808080;}.note-icon {display:grid;place-items:center;width:30px;height:30px;flex-shrink:0;border-radius:50%;background:#e9eef5;color:#6f839e;}.design-note strong {font-size:12px;font-weight:500;color:#595959;}.design-note p {font-size:11px;line-height:1.8;margin:3px 0 0;}.design-note>button {margin-left:auto;flex-shrink:0;border:1px solid #c2c2c2;background:white;border-radius:6px;height:28px;padding:0 12px;font-size:11px;color:#595959;}
  footer {border-top:1px solid #e5e8ee;padding-top:14px;color:#b0b4bd;font-size:9px;letter-spacing:1px;}footer span {float:right;letter-spacing:0;font-size:10px;}.spec {background:white;border-radius:8px;padding:24px;margin-bottom:24px;}.spec table {width:100%;border-collapse:collapse;font-size:12px;margin-top:16px;text-align:left;}.spec th,.spec td {padding:12px;border-bottom:1px solid #f0f0f0;}.spec th {background:#f5f6f8;font-weight:500;}.spec p {font-size:12px;color:#808080;}.spec pre {background:#f5f6f8;padding:12px;font-size:12px;}
  @media(min-width:1600px){main {padding:32px 48px 80px;}.chart {height:300px;}.metrics {gap:24px;}}
  @media(max-width:1150px){.sidebar {width:176px;}.brand {font-size:14px;}main {padding:24px 24px 72px;}.metric {padding:16px;}.metric-number {font-size:23px;}.metric svg {width:50px;}.page-heading {align-items:start;}}
  @media(max-width:820px){.sidebar {display:none;}.metrics {grid-template-columns:repeat(2,minmax(0,1fr));}.design-note {align-items:start;}.design-note>button {margin-top:4px;} }
  @media(max-width:480px){main {padding:18px 16px 84px;}.prototype-banner {padding:0 16px;}.prototype-banner>button {font-size:10px;}.time-control {gap:10px;}.metrics {gap:10px;}.metric-number {font-size:23px;}.metric svg {display:none;}.chart-card {padding:16px;}.design-note {flex-wrap:wrap;}.design-note>div {flex:1;}.design-note>button {margin-left:44px;}footer span {float:none;display:block;margin-top:4px;}.spec {padding:12px;overflow:auto;}.spec table {min-width:520px;}}
</style>
