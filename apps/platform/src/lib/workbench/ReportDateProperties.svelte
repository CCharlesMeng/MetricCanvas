<script lang="ts">
  import PrimaryAction from '../PrimaryAction.svelte';
 import ToolAction from '../ToolAction.svelte';
  import {Input,Select,DatePicker} from '@metriccanvas/ui';
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
  <div class="field"><span>编辑已有筛选</span><Select label="编辑已有筛选" disabled={busy} value={filters.some(f=>f.id===filterId)?filterId:''} options={[{value:'',label:'新增日期筛选'},...filters.filter(f=>['timePoint','timeRange'].includes(f.type)).map(f=>({value:String(f.id),label:String(f.label??f.id)}))]} onchange={load}/></div>
  <Input label="筛选器 ID" value={filterId} oninput={value=>filterId=value} disabled={busy}/>
  <Input label="标签" value={label} oninput={value=>label=value} disabled={busy}/>
  <div class="field"><span>选择形态</span><Select label="选择形态" value={form} options={[{value:'month',label:'单个月份'},{value:'monthRange',label:'月份范围'},{value:'date',label:'单个日期'},{value:'dateRange',label:'日期范围'}]} onchange={value=>{form=value;windowChanged=true;}} disabled={busy}/></div>
  <Input label="参数初值 ID（可选）" placeholder="参数初值 ID（可选）" value={initialParam} oninput={value=>initialParam=value} disabled={busy}/>
  {#if !initialParam}<DatePicker label="筛选初值" precision={granularity} {range} value={from?{from,to:range?to:from}:null} onchange={value=>{from=value?.from??'';to=value?.to??'';}} disabled={busy}/>{/if}
  {#if !range}<p class="hint">已有查询保留各自的时间窗口；修改下面选项会应用到所选查询。</p><Select label="查询时间窗口" value={windowKind} options={[{value:'period',label:'当期'},{value:'yearToDate',label:'年初至当前'},{value:'lastN',label:'最近 N 期'}]} onchange={value=>{windowKind=value as typeof windowKind;windowChanged=true;}} disabled={busy}/>{#if windowKind==='lastN'}<Input label="期数" type="number" value={String(n)} oncommit={value=>{n=Number(value);windowChanged=true;}} disabled={busy}/>{/if}<Select label="分区值格式" value={valueFormat} options={[{value:'iso',label:'YYYY-MM / YYYY-MM-DD'},{value:'compact',label:'YYYYMM / YYYYMMDD'}]} onchange={value=>{valueFormat=value as typeof valueFormat;formatChanged=true;}} disabled={busy}/>{/if}
  <fieldset disabled={busy}><legend>关联查询目标</legend>{#each choices as choice}<label class="binding"><input type="checkbox" bind:group={selected} value={choice.id}/>{choice.label}</label>{/each}</fieldset>
  <PrimaryAction disabled={busy||!filterId||!selected.length} onclick={save}>应用日期配置</PrimaryAction>
  {#if filters.some(f=>f.id===filterId)}<ToolAction danger disabled={busy} onclick={()=>onEdit({filterId,remove:true})}>删除此日期筛选</ToolAction>{/if}
</section>
<style>
  .date-properties { display:grid; gap:16px; margin-top:16px; }
  .hint { margin:0; font-size:12px; color:#808080; }
  h5 { margin:0; font-size:14px; }
  label { display:grid; gap:4px; font-size:14px; }
  .field{display:grid;gap:8px;font-size:14px}
  .binding { display:flex; align-items:center; gap:6px; }
  fieldset { display:grid; gap:6px; border:1px solid #f0f0f0; }
</style>
