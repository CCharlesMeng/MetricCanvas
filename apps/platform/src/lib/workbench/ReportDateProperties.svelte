<script lang="ts">
  import type { DqeFilterBinding } from '@metriccanvas/page/internal';
  import type { CanvasAuthoringDraft, ComponentLocator } from './document-edit';
  import { dateBindingChoices, type ReportDateEdit } from './report-date-edit';
  let {draft,locator,busy=false,onEdit}:{draft:CanvasAuthoringDraft;locator:ComponentLocator;busy?:boolean;onEdit:(edit:ReportDateEdit)=>void}=$props();
  let filterId=$state('report-period-filter');
  let label=$state('报告期间');
  let form=$state('monthRange');
  let from=$state('');let to=$state('');let initialParam=$state('');
  let windowKind=$state<'period'|'yearToDate'|'lastN'>('period');let n=$state(12);
  let loadedBindings:Record<string,DqeFilterBinding>={};
  let windowChanged=$state(false);let formatChanged=$state(false);
  let selected=$state<string[]>([]);let valueFormat=$state<'iso'|'compact'>('iso');
  const granularity=$derived(form.startsWith('month')?'month' as const:'date' as const);
  const range=$derived(form.endsWith('Range'));
  const window=$derived(windowKind==='period'?{kind:'period' as const,unit:granularity==='month'?'month' as const:'day' as const}:windowKind==='lastN'?{kind:'lastN' as const,unit:granularity==='month'?'month' as const:'day' as const,n}:{kind:'yearToDate' as const});
  const choices=$derived(dateBindingChoices(draft,granularity,range,window));
  const filters=$derived((draft.pageDocument.filters??[]) as Array<Record<string,any>>);
  function load(id:string) {
    windowChanged=false;formatChanged=false;loadedBindings={};selected=[];
    filterId=id||'report-period-filter';const f=filters.find(f=>f.id===id);if(!f){label='报告期间';form='monthRange';from='';to='';initialParam='';return;}
    label=f.label??'报告期间';form=`${f.type==='timePoint'?f.granularity:f.precision??'date'}${f.type==='timeRange'?'Range':''}`;
    from=f.type==='timePoint'?f.default??'':f.default?.from??'';to=f.default?.to??'';initialParam=f.initialParam??'';
    selected=[];
    const sources=draft.pageDocument.dataSources as Record<string,any>;
    for(const [sourceId,source] of Object.entries(sources)) {
      const binding=source.source.query?.filterBindings?.[id];if(!binding)continue;
      if(binding.window){windowKind=binding.window.kind;n=binding.window.n??12;}
      if(binding.valueFormat)valueFormat=binding.valueFormat;
      const key=`${sourceId}:${binding.target==='time'?'time':binding.queryField}`;
      loadedBindings[key]=binding;selected.push(key);
    }
  }
  function save() {
    const declaration={id:filterId,label,required:true,...(range?{type:'timeRange' as const,precision:granularity,...(initialParam?{initialParam}:{default:{from,to}})}:{type:'timePoint' as const,granularity,...(initialParam?{initialParam}:{default:from})})};
    const bindings=choices.filter(c=>selected.includes(c.id)).map(c=>{
      const original=loadedBindings[c.id];
      const binding=original?.target===c.binding.target&&!(original.target==='time'&&range&&original.window)?original:c.binding;
      return {dataSourceId:c.dataSourceId,binding:binding.target==='timePoint'?{...binding,...(formatChanged?{valueFormat}:{})}:windowChanged?c.binding:binding};
    });
    onEdit({filterId,declaration,bindings});
  }
</script>
<section class="date-properties" aria-label="报告日期筛选配置">
  <h5>报告日期筛选</h5>
  <label>编辑已有筛选<select disabled={busy} onchange={e=>load(e.currentTarget.value)}><option value="">新增日期筛选</option>{#each filters.filter(f=>['timePoint','timeRange'].includes(f.type)) as f}<option value={f.id}>{f.label??f.id}</option>{/each}</select></label>
  <label>筛选器 ID<input bind:value={filterId} disabled={busy}/></label>
  <label>标签<input bind:value={label} disabled={busy}/></label>
  <label>选择形态<select bind:value={form} onchange={()=>windowChanged=true} disabled={busy}><option value="month">单个月份</option><option value="monthRange">月份范围</option><option value="date">单个日期</option><option value="dateRange">日期范围</option></select></label>
  <label>参数初值 ID（可选）<input bind:value={initialParam} disabled={busy}/></label>
  {#if !initialParam}<label>{range?'开始':'初值'}<input type={granularity} bind:value={from} disabled={busy}/></label>{#if range}<label>结束<input type={granularity} bind:value={to} disabled={busy}/></label>{/if}{/if}
  {#if !range}<p class="hint">已有查询保留各自的时间窗口；修改下面选项会应用到所选查询。</p><label>查询时间窗口<select bind:value={windowKind} onchange={()=>windowChanged=true}><option value="period">当期</option><option value="yearToDate">年初至当前</option><option value="lastN">最近 N 期</option></select></label>{#if windowKind==='lastN'}<label>期数<input type="number" min="1" bind:value={n} oninput={()=>windowChanged=true}/></label>{/if}<label>分区值格式<select bind:value={valueFormat} onchange={()=>formatChanged=true}><option value="iso">YYYY-MM / YYYY-MM-DD</option><option value="compact">YYYYMM / YYYYMMDD</option></select></label>{/if}
  <fieldset disabled={busy}><legend>关联查询目标</legend>{#each choices as choice}<label class="binding"><input type="checkbox" bind:group={selected} value={choice.id}/>{choice.label}</label>{/each}</fieldset>
  <button type="button" disabled={busy||!filterId||!selected.length} onclick={save}>应用日期配置</button>
  {#if filters.some(f=>f.id===filterId)}<button type="button" disabled={busy} onclick={()=>onEdit({filterId,remove:true})}>删除此日期筛选</button>{/if}
</section>
<style>
  .date-properties { display:grid; gap:10px; margin-top:16px; }
  .hint { margin:0; font-size:12px; color:#71717a; }
  h5 { margin:0; font-size:12px; }
  label { display:grid; gap:4px; font-size:12px; }
  input,select,button { min-height:30px; border:1px solid #d4d4d8; border-radius:6px; padding:4px 8px; background:#fff; font:inherit; }
  .binding { display:flex; align-items:center; gap:6px; }
  fieldset { display:grid; gap:6px; border:1px solid #e4e4e7; }
</style>
