<script lang="ts">
  // Throwaway: selected C on /preview?prototype=report-date&variant=C.
  // Existing preview data supplies context. Dates and extraction are simulated, never persisted.
  import { dev } from '$app/environment';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { RuntimeView } from '@metriccanvas/engine/ui';
  import { ReportHeader } from '@metriccanvas/engine/widgets';
  import { DEFAULT_PREVIEW_PAGE } from './preview-document';

  const body = structuredClone(DEFAULT_PREVIEW_PAGE) as any;
  body.sections = body.sections.filter((s: any) => !s.components.some((c: any) => c.type === 'reportHeader'));
  for (const ds of Object.values(body.dataSources) as any[]) {
    const rows = ds.source.initial?.rows ?? [];
    ds.source = { type: 'inline', rows: rows.map((row: any) => Object.fromEntries(
      Object.entries(ds.fields).map(([id, definition]: [string, any]) => [id, row[definition.queryField ?? id] ?? null])
    )) };
    for (const field of Object.values(ds.fields) as any[]) delete field.queryField;
  }
  const names: Record<string, string> = { A: '右上角常驻控件', B: '右上角期间按钮与浮层', C: '页头独立工具带' };
  const variant = $derived(['A', 'B', 'C'].includes(page.url.searchParams.get('variant') ?? '') ? page.url.searchParams.get('variant')! : 'C');
  let phase = $state<'draft' | 'candidate' | 'applied'>(page.url.searchParams.get('stage') === 'draft' ? 'draft' : page.url.searchParams.get('stage') === 'candidate' ? 'candidate' : 'applied');
  let kind = $state('month-range');
  let from = $state('2026-01');
  let to = $state('2026-06');
  let selectedFrom = $state('2026-01');
  let selectedTo = $state('2026-06');
  let open = $state(false);
  let exportView = $state(false);
  let exportPeriod = $state('');
  const inputType = $derived(kind.startsWith('month') ? 'month' : 'date');
  const range = $derived(kind.endsWith('range'));
  const period = $derived(selectedFrom === selectedTo ? selectedFrom : `${selectedFrom} 至 ${selectedTo}`);
  const valid = $derived(Boolean(from && (!range || to) && (!range || from <= to)));
  const prototypeState = $derived({ variant, phase, granularity: inputType, mode: range ? 'range' : 'single', params: phase === 'applied' ? ['report-period'] : [], dateControl: phase === 'applied', input: { from, to: range ? to : from }, selectedPeriod: period, exportView, exportPeriod, exportDateText: true });

  function changeKind(value: string) {
    kind = value;
    from = value.startsWith('month') ? '2026-01' : '2026-01-01';
    to = value.startsWith('month') ? '2026-06' : '2026-06-30';
    selectedFrom = from; selectedTo = value.endsWith('range') ? to : from;
  }
  function apply() {
    if (!valid) return;
    selectedFrom = from; selectedTo = range ? to : from;
    open = false;
  }
  function setVariant(value: string) {
    const url = new URL(page.url);
    url.searchParams.set('variant', value);
    void goto(url, { replaceState: true, noScroll: true, keepFocus: true });
  }
  function cycle(delta: number) {
    const keys = ['A', 'B', 'C']; setVariant(keys[(keys.indexOf(variant) + delta + 3) % 3]);
  }
  function beginExport() { exportPeriod = period; exportView = true; open = false; }
  function setPhase(value: 'draft' | 'candidate' | 'applied') {
    phase = value; exportView = false; open = false;
    const url = new URL(page.url); url.searchParams.set('stage', value);
    void goto(url, { replaceState: true, noScroll: true, keepFocus: true });
  }
  function reset() { setPhase('draft'); }
</script>

<svelte:head><title>日期筛选 prototype · MetricCanvas</title></svelte:head>
<svelte:window onkeydown={(event) => {
  if ((event.target as HTMLElement)?.closest('input, textarea, select, [contenteditable]')) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); cycle(event.key === 'ArrowLeft' ? -1 : 1); }
}} />

{#snippet picker()}
  <div class="date-inputs">
    <span class="field-label">报告期间</span>
    <label><span class="sr-only">{range ? '开始期间' : '选择期间'}</span><input type={inputType} bind:value={from} /></label>
    {#if range}<span class="separator">至</span><label><span class="sr-only">结束期间</span><input type={inputType} bind:value={to} /></label>{/if}
    <button class="apply" disabled={!valid} onclick={apply}>应用</button>
    {#if !valid}<span class="invalid">请填写有效期间，起点不能晚于终点</span>{/if}
  </div>
{/snippet}

<main class:export-view={exportView} data-prototype-variant={variant}>
  <div class="lab">
    <div class="lab-heading"><div><b>日期筛选 Prototype</b><p>位置、四种输入与提取后生成控件。仅使用现有示例数据，日期变化不触发实际取数。</p></div><a href="/preview">返回 JSON 预览</a></div>
    <div class="lab-actions">
      <label>输入形态 <select value={kind} onchange={(e) => changeKind(e.currentTarget.value)}><option value="month-single">月份单选</option><option value="month-range">月份范围</option><option value="date-single">日期单选</option><option value="date-range">日期范围</option></select></label>
      <button onclick={reset}>1 初次创作</button>
      <button disabled={phase !== 'draft'} onclick={() => setPhase('candidate')}>2 模拟提取日期</button>
      <button disabled={phase !== 'candidate'} onclick={() => { setPhase('applied'); apply(); }}>3 确认候选并生成控件</button>
      <button disabled={phase !== 'applied'} onclick={beginExport}>导出视图预览</button>
      {#if exportView}<button onclick={() => exportView = false}>返回交互视图</button><button onclick={() => window.print()}>浏览器打印预览</button>{/if}
      <span class="fixed-policy">已确认：导出隐藏日期框，保留当前期间</span>
    </div>
    <p class="phase" role="status">{phase === 'draft' ? '初次创作：没有页面参数，也没有日期选择器。原始数据期间只读展示。' : phase === 'candidate' ? '提取候选：报告期间，原值 2026 年上半年。确认前不改变页面。' : '已应用：产物新增 report-period 参数与关联日期选择器，原值作为本次预览输入。'}{exportView ? ' 导出视图锁定刚才选择的期间，移除所有日期输入与交互按钮。' : ''}</p>
  </div>

  <div class="report" class:variant-b={variant === 'B'} class:variant-c={variant === 'C'}>
    <div class="header-frame">
      {#if variant === 'C' && !exportView && phase === 'applied'}
        <div class="toolband" data-date-controls><span>当前期间：{period}</span>{@render picker()}</div>
      {/if}
      <div class="header-body">
        <ReportHeader props={{ title: '中国区 Tokens 运营报告', badge: '中国区', generatedBy: '指标画布 · 报告示例', decoration: 'shortBar', ...(phase === 'applied' ? { asOf: {label: '报告期间', value: exportView ? exportPeriod : period} } : {}), subtitle: '日期选择器与参数提取联动的交互示例。下方复用现有报告中的概况、代表处对比、模型服务分布及明细；示例数据固定，不代表新期间的实际查询结果。' }} />
        {#if exportView}
        {:else if phase !== 'applied'}
          <div class="original-period"><span>原始数据期间</span><strong>2026-01 至 2026-06</strong></div>
        {:else if variant === 'A'}
          <div class="header-controls" data-date-controls>{@render picker()}</div>
        {:else if variant === 'B'}
          <div class="period-menu" data-date-controls>
            <button class="period-trigger" aria-expanded={open} onclick={() => open = !open}><span>报告期间</span><strong>{period}</strong><span aria-hidden="true">⌄</span></button>
            {#if open}<div class="popover">{@render picker()}</div>{/if}
          </div>
        {/if}
      </div>
    </div>
    <RuntimeView document={body} />
  </div>
  <details class="lab state" open><summary>当前完整 prototype 状态</summary><pre>{JSON.stringify(prototypeState, null, 2)}</pre></details>
  {#if dev}<div class="switcher" aria-label="原型布局切换"><button aria-label="上一方案" onclick={() => cycle(-1)}>←</button><span>{variant} · {names[variant]}</span><button aria-label="下一方案" onclick={() => cycle(1)}>→</button></div>{/if}
</main>

<style>
  main { padding: 24px 20px 90px; background: #f4f6fa; min-height: 100vh; }
  .lab { max-width: 1200px; margin: 0 auto 18px; color: #344155; }
  .lab-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
  .lab-heading b { font-size: 20px; } .lab-heading p { font-size: 13px; line-height: 1.7; margin: 7px 0 14px; color: #68748a; }
  a { color: #4c61ab; white-space: nowrap; font-size: 13px; }
  .lab-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
  .lab-actions label { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; }
  .fixed-policy { color: #62739e; font-size: 12px; }
  button, select, input:not([type=checkbox]) { box-sizing: border-box; font: inherit; border: 1px solid #d7ddeb; border-radius: 6px; background: white; color: #344155; padding: 8px 10px; }
  button { cursor: pointer; font-size: 13px; } button:disabled { opacity: .45; cursor: default; } button:hover:enabled { border-color: #657ec6; }
  .phase { padding: 11px 14px; background: #eaf0fc; font-size: 13px; border-radius: 6px; line-height: 1.7; }
  .report { max-width: 1200px; margin: 0 auto; background: #f1f4ff; box-shadow: 0 4px 26px #263c7110; container-type: inline-size; }
  .header-frame { position: relative; --mc-page-content-padding-inline: 0px; --mc-page-content-padding-block-start: 0px; padding-bottom: 0; }
  .header-body { position: relative; }
  .header-body :global(.report-cover) { min-height: 176px; box-sizing: border-box; padding-right: 540px; }
  .header-body :global(.report-summary) { padding: 8px 22px 0; }
  .header-controls, .original-period, .period-menu { position: absolute; top: 28px; right: 26px; }
  .date-inputs { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; font-size: 13px; max-width: 510px; }
  .field-label { width: 100%; text-align: right; color: #64739b; font-size: 12px; } .separator { color: #8794ae; }
  .date-inputs input { max-width: 164px; font-size: 13px; min-height: 36px; } .apply { background: #536bb1; color: white; border-color: #536bb1; }
  .invalid { width: 100%; color: #b34848; font-size: 12px; }
  .original-period { display: grid; gap: 10px; color: #445593; font-size: 13px; text-align: right; }
  .original-period span { color: #7180a3; font-size: 12px; }
  .variant-b .header-body :global(.report-cover) { padding-right: 410px; }
  .period-trigger { display: flex; gap: 14px; align-items: center; min-height: 42px; background: #ffffffbb; border-radius: 22px; padding: 8px 18px; }
  .period-trigger > span:first-child { color: #7383a8; font-size: 12px; }
  .popover { position: absolute; z-index: 20; right: 0; top: 52px; padding: 18px; width: 440px; box-sizing: border-box; background: white; box-shadow: 0 12px 36px #334c7826; border: 1px solid #e3e8f3; border-radius: 10px; }
  .popover .field-label { text-align: left; }
  .toolband { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 12px 26px; background: #e9eefc; border-bottom: 1px solid #d7dff5; color: #62739e; font-size: 12px; }
  .toolband .date-inputs { max-width: none; } .toolband .field-label { width: auto; }
  .variant-c .header-body :global(.report-cover) { padding-right: 26px; min-height: 148px; }
  .state { margin-top: 22px; padding: 12px 0; font-size: 13px; } pre { overflow: auto; background: white; padding: 16px; border-radius: 8px; line-height: 1.5; font-size: 12px; }
  .switcher { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%); z-index: 40; background: #25334e; color: white; display: flex; align-items: center; gap: 16px; padding: 7px; border-radius: 26px; box-shadow: 0 5px 22px #16294438; font-size: 13px; white-space: nowrap; }
  .switcher button { color: white; background: transparent; border: 0; font-size: 18px; border-radius: 50%; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  @container (max-width: 860px) {
    .header-body :global(.report-cover), .variant-b .header-body :global(.report-cover) { padding-right: 26px; padding-top: 145px; }
    .header-controls, .period-menu, .original-period { left: 26px; right: 26px; top: 20px; }
    .date-inputs { justify-content: flex-start; } .field-label { text-align: left; }
    .original-period { text-align: left; }
    .popover { left: 0; right: auto; width: min(440px, 100%); }
    .variant-c .header-body :global(.report-cover) { padding-top: 28px; }
    .toolband { flex-wrap: wrap; }
  }
  @media (max-width: 520px) {
    main { padding: 16px 10px 85px; } .lab-heading { flex-wrap: wrap; }
    .date-inputs input { max-width: 142px; }
    .header-body :global(.report-cover) { padding-left: 18px; padding-right: 18px; }
    .header-controls, .period-menu, .original-period { left: 18px; right: 18px; }
  }
  @media print {
    @page { size: A4; margin: 12mm; }
    main { padding: 0; background: white; } .lab, .switcher, .header-controls, .period-menu, .toolband { display: none !important; }
    .report { max-width: none; box-shadow: none; } .report :global(.page-content) { min-height: 0; padding-bottom: 0; }
    .report :global(.report-cover) { padding-top: 28px !important; }
    .report :global(.mc-component-box) { break-inside: avoid; }
  }
</style>
