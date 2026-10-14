<script lang="ts">
  import { RuntimeView } from '@metriccanvas/engine/ui';
  import { applyPageParamSelection,extractPageParams,resolvePageParams, type PageDocument } from '@metriccanvas/page';
  import type { RuntimeDataGateway } from '@metriccanvas/engine';
  import fixture from '../../../../packages/page/fixtures/contract-valid/report-date-filters-page.json';
  import { downloadReportPdf } from './report-pdf-client';
  let mode=$state('monthRange');
  let phase=$state<'draft'|'candidate'|'applied'>('applied');
  let runtime:RuntimeView;
  let exportHost:HTMLDivElement;
  let exportMessage=$state('');let exporting=$state(false);
  function sourceFor(mode:string) {
    const p=structuredClone(fixture) as any;
    delete p.params;delete p.filters;delete p.sections[0].components[0].props.filterIds;
    const granularity=mode.startsWith('month')?'month':'date';const range=mode.endsWith('Range');
    const start=granularity==='month'?'2026-01':'2026-01-01';
    const end=range?(granularity==='month'?'2026-06':'2026-06-30'):start;
    const q=p.dataSources.sales.source.query;delete q.filterBindings;
    q.body.dsl_list[0].filter.time={period:granularity==='month'?'month':'day',is_aggregate:false,start,end};
    p.dataSources['tab-a']=structuredClone(p.dataSources.sales);p.dataSources['tab-b']=structuredClone(p.dataSources.sales);
    const a=structuredClone(p.sections[1].components[0]);a.id='tab-a-table';a.data.main='tab-a';a.props.title='区域明细';
    const b=structuredClone(a);b.id='tab-b-table';b.data.main='tab-b';b.props.title='项目明细';
    p.sections.push({id:'extra',container:'plain',title:'补充分析',components:[{id:'detail-tabs',type:'tabContainer',layout:{span:12},props:{tabs:[{id:'a',label:'区域',component:a},{id:'b',label:'项目',component:b}]}}]});
    p.dataSources.chart=structuredClone(p.dataSources.sales);delete p.dataSources.chart.source.query.body.dsl_list[0].order;
    p.sections.push({id:'trend',container:'plain',title:'趋势',components:[{id:'sales-chart',type:'barChart',layout:{span:12},data:{main:'chart'},props:{categoryField:'entry',series:[{field:'amount',label:'金额'}]}}]});
    p.sectionGroups=[{id:'main',label:'主要明细',sectionIds:['detail','trend']},{id:'more',label:'补充明细',sectionIds:['extra']}];
    p.defaultSectionGroup='main';
    return p;
  }
  const source=$derived(sourceFor(mode));
  const extraction=$derived(extractPageParams(source,{baseline:'local-synthetic-verified',timeIdentities:{sales:'business-period','tab-a':'business-period','tab-b':'business-period',chart:'business-period'}}));
  const applied=$derived(extraction.ok?applyPageParamSelection(extraction,extraction.candidates.map(c=>c.id)):null);
  const filled=$derived(applied?.ok?resolvePageParams(applied.document,applied.originalValues):null);
  const document=$derived(phase==='applied'&&filled?.ok?filled.document:source);
  const gateway:RuntimeDataGateway={async fetchData(query) {
    await new Promise(resolve=>setTimeout(resolve,50));
    const staticTime=query.body.dsl_list[0].filter as any;
    const range=query.filterValues.find(v=>v.target==='time');
    const period=range?.target==='time'?`${range.value.from} 至 ${range.value.to}`:`${staticTime?.time?.start} 至 ${staticTime?.time?.end}`;
    const offset=query.pagination?.offset??0;
    const limit=query.pagination?.limit??(query.body.dsl_list[0].order as any)?.limit??53;
    return {rows:Array.from({length:Math.max(0,Math.min(limit,53-offset))},(_,i)=>({entry:`项目 ${String(offset+i+1).padStart(2,'0')} · ${period}`,amount:(offset+i+1)*10})),totalCount:53};
  }};
  async function previewExport(fail=false) {
    exporting=true;exportMessage='准备完整导出视图…';exportHost.replaceChildren();
    try {
      await runtime.withExportView(async ({target,wideElements})=>{
        if(fail)throw Error('模拟集成应用导出失败');
        const copy=target.cloneNode(true) as HTMLElement;
        const style=getComputedStyle(target);
        for(const name of Array.from(style))if(name.startsWith('--mc-')||name==='font-family')copy.style.setProperty(name,style.getPropertyValue(name));
        exportHost.append(copy);
        exportMessage=`已准备 A4 完整视图：${target.querySelectorAll('tbody tr').length} 行，${wideElements.length} 个横向分区；日期输入已移除。`;
      });
    }catch(cause){exportMessage=cause instanceof Error?cause.message:'导出失败';}
    finally{exporting=false;}
  }
  async function exportPdf() {
    exporting=true;exportMessage='准备完整报告并按 A4 分页生成 PDF…';
    try {
      await runtime.withExportView(async ({target,signal,wideElements})=>{
        if(wideElements.length)throw Error('当前 PDF 示例仅支持竖向 A4；请调整过宽的内容分区，或由集成应用接入横向 PDF。');
        const rowCount=target.querySelectorAll('tbody tr').length;
        const {pageCount}=await downloadReportPdf(target,signal);
        exportMessage=`PDF 已生成并发起下载：${pageCount} 页、${rowCount} 行，包含全部分组、区域及项目内容。`;
      });
    }catch(cause){exportMessage=cause instanceof Error?cause.message:'PDF 导出失败';}
    finally{exporting=false;}
  }
</script>
<svelte:head><title>报告日期筛选 · 实现验收</title></svelte:head>
<main>
  <div class="example-tools">
    <b>报告日期筛选 · 实现验收</b>
    <label>验收场景<select bind:value={mode}><option value="monthRange">月份范围</option><option value="month">单个月份</option><option value="dateRange">日期范围</option><option value="date">单个日期</option></select></label>
    <button type="button" onclick={()=>{phase='draft';exportMessage='';exportHost.replaceChildren();}}>初次创作</button>
    <button type="button" onclick={()=>{phase='candidate';exportMessage='';exportHost.replaceChildren();}}>提取日期</button>
    <button type="button" onclick={()=>{phase='applied';exportMessage='';exportHost.replaceChildren();}}>确认提取</button>
    <button type="button" disabled={exporting} onclick={()=>previewExport()}>准备完整导出视图</button>
    <button type="button" disabled={exporting} onclick={exportPdf}>导出 PDF</button>
    <button type="button" disabled={exporting} onclick={()=>previewExport(true)}>模拟导出失败</button>
    <span>本页使用本地合成数据和正式引擎。“主要明细”显示经营明细及趋势，“补充明细”显示区域、项目分析；点击“导出 PDF”直接下载包含两组全部内容的 PDF。正文以图片保存。</span>
  </div>
  {#if phase==='candidate'&&extraction.ok}<p role="status">识别到 {extraction.candidates.length} 个日期候选；确认后增加参数和页头筛选器。</p>{/if}
  <RuntimeView bind:this={runtime} {document} dataGateway={gateway}/>
  {#if exportMessage}<p role="status">{exportMessage}</p>{/if}
  <div class="export-preview" bind:this={exportHost}></div>
</main>
<style>
  main { max-width:1200px; margin:0 auto; padding:20px; }
  .example-tools { display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:20px;padding:16px;border:1px solid #e4e4e7;border-radius:8px;background:#fff; }
  .example-tools span { flex-basis:100%;font-size:12px;color:#71717a; }
  button,select { padding:6px 10px;border:1px solid #d4d4d8;border-radius:6px;background:#fff;font:inherit;font-size:13px; }
  label { display:flex;align-items:center;gap:6px;font-size:13px; }
  .export-preview { max-width:100%;overflow:auto;border-top:1px solid #e4e4e7; }
</style>
