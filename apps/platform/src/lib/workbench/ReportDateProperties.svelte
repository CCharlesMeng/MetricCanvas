<script lang="ts">
  import { untrack } from 'svelte';
  import PrimaryAction from '../PrimaryAction.svelte';
 import ToolAction from '../ToolAction.svelte';
  import {Input,Select,DatePicker} from '@metriccanvas/ui';
  import {dateBindingsForFilter} from './report-date-bindings';
  import {periodPolicyChoice, policyFromChoice, preservePeriodBinding, periodPolicyOptions, periodPolicyPreview, type PeriodPolicyChoice} from './period-policy-edit';
  import type { QueryPeriod, DqeFilterBinding } from '@metriccanvas/page/internal';
  import type { CanvasAuthoringDraft, ComponentLocator } from './document-edit';
  import { dateBindingChoices, type ReportDateEdit } from './report-date-edit';
  let {draft,locator,busy=false,onEdit}:{draft:CanvasAuthoringDraft;locator:ComponentLocator|null;busy?:boolean;onEdit:(edit:ReportDateEdit)=>void}=$props();
  const dashboard=$derived(draft.pageDocument.layout==='dashboard');
  let periodMode=$state<'year'|'quarter'|'month'|'last12Months'>('month');
  let periodPrecision=$state<'month'|'date'>('date');
  let filterId=$state(untrack(()=>draft.pageDocument.layout==='dashboard'?'statistics-period':'report-period-filter'));
  let label=$state(untrack(()=>draft.pageDocument.layout==='dashboard'?'统计期间':'报告期间'));
  let form=$state(untrack(()=>draft.pageDocument.layout==='dashboard'?'period':'monthRange'));
  let from=$state('');let to=$state('');let initialParam=$state('');
  let windowKind=$state<'period'|'yearToDate'|'lastN'>('period');let n=$state(12);
  let loadedBindings:Record<string,DqeFilterBinding>={};
  let policies=$state<Record<string,PeriodPolicyChoice>>({});
  let policyChanged=$state<Record<string,boolean>>({});
  let supported=$state<Record<string,QueryPeriod[]>>({});
  const previewNow=new Date();
  let windowChanged=$state(false);let formatChanged=$state(false);
  let selected=$state<string[]>([]);let valueFormat=$state<'iso'|'compact'>('iso');
  const granularity=$derived(form==='period'?periodPrecision:form.startsWith('month')?'month' as const:'date' as const);
  const range=$derived(form==='period'||form.endsWith('Range'));
  const window=$derived(windowKind==='period'?{kind:'period' as const,unit:granularity==='month'?'month' as const:'day' as const}:windowKind==='lastN'?{kind:'lastN' as const,unit:granularity==='month'?'month' as const:'day' as const,n}:{kind:'yearToDate' as const});
  const choices=$derived(dateBindingChoices(draft,granularity,range,window,form==='period'));
  const incompletePeriod=$derived(form==='period'&&choices.some(choice=>selected.includes(choice.id)&&periodChoiceIncomplete(choice)));
  function periodChoiceIncomplete(choice:typeof choices[number]){const current=policies[choice.id]??periodPolicyChoice(choice.binding,false);return !current||(current==='selection'&&!supported[choice.id]?.length);}
  const filters=$derived((draft.pageDocument.filters??[]) as Array<Record<string,any>>);
  function load(id:string) {
    windowChanged=false;formatChanged=false;loadedBindings={};selected=[];policies={};supported={};policyChanged={};
    filterId=id||(dashboard?'statistics-period':'report-period-filter');const f=filters.find(f=>f.id===id);if(!f){label=dashboard?'统计期间':'报告期间';form=dashboard?'period':'monthRange';from='';to='';initialParam='';return;}
    label=f.label??'报告期间';if(f.display==='period'){form='period';periodMode=f.default?.mode??f.initialMode??'month';periodPrecision=f.precision??'date';from=f.default?.value??'';to='';initialParam=f.initialParam??'';}else form=`${f.type==='timePoint'?f.granularity:f.precision??'date'}${f.type==='timeRange'?'Range':''}`;
    if(f.display!=='period')from=f.type==='timePoint'?f.default??'':f.default?.from??'';to=f.default?.to??'';initialParam=f.initialParam??'';
    selected=[];
    loadBindings(id);
  }
  function loadBindings(id:string){
    const sources=draft.pageDocument.dataSources as Record<string,any>;
    for(const {key,binding,mixed} of dateBindingsForFilter(sources,id)) {
      if(binding.target==='time'&&binding.window){if(binding.window.kind==='period'||binding.window.kind==='lastN'||binding.window.kind==='yearToDate')windowKind=binding.window.kind;n='n' in binding.window?binding.window.n:12;}
      if(binding.valueFormat&&binding.valueFormat!=='datetime')valueFormat=binding.valueFormat;
      loadedBindings[key]=binding;selected.push(key);
      policies[key]=mixed?'preserve':periodPolicyChoice(binding,true);
      supported[key]=binding.target==='time'&&binding.periodPolicy?.kind==='selection'?binding.periodPolicy.supportedPeriods:[];
    }
  }
  function save() {
    const baseDeclaration=form==='period'?{id:filterId,label,required:true,type:'timeRange' as const,display:'period' as const,precision:periodPrecision,...(initialParam?{initialParam,initialMode:periodMode==='last12Months'?'month' as const:periodMode}:{default:periodMode==='last12Months'?{mode:periodMode}:{mode:periodMode,...(from?{value:from}:{})}})}:{id:filterId,label,required:true,...(range?{type:'timeRange' as const,precision:granularity,...(initialParam?{initialParam}:{default:{from,to}})}:{type:'timePoint' as const,granularity,...(initialParam?{initialParam}:{default:from})})};
    const previous=filters.find(filter=>filter.id===filterId);
    const declaration=previous?.display==='period'&&form==='period'?{...previous,...baseDeclaration}:baseDeclaration;
    if(form==='period'&&!initialParam){delete (declaration as Record<string,unknown>).initialParam;delete (declaration as Record<string,unknown>).initialMode;}
    const bindings=choices.filter(c=>selected.includes(c.id)).map(c=>{
      const original=loadedBindings[c.id];
      if(form==='period'){
        const choice=policies[c.id]??periodPolicyChoice(c.binding,false);
        const policy=policyFromChoice(choice,supported[c.id]??[]);
        return {dataSourceId:c.dataSourceId,binding:policy?{target:'time' as const,periodPolicy:policy}:original??c.binding,preserve:preservePeriodBinding(choice,!!original,!!policyChanged[c.id])};
      }
      const binding=original?.target===c.binding.target&&!(original.target==='time'&&range&&original.window)?original:c.binding;
      return {dataSourceId:c.dataSourceId,binding:binding.target==='timePoint'?{...binding,...(formatChanged?{valueFormat}:{})}:windowChanged?c.binding:binding};
    });
    onEdit({filterId,declaration,bindings});
  }
</script>
<section class="date-properties" aria-label={dashboard?'Dashboard 日期筛选配置':'报告日期筛选配置'}>
  <h5>{dashboard?'Dashboard 日期筛选':'报告日期筛选'}</h5>
  <div class="field"><span>编辑已有筛选</span><Select label="编辑已有筛选" disabled={busy} value={filters.some(f=>f.id===filterId)?filterId:''} options={[{value:'',label:'新增日期筛选'},...filters.filter(f=>['timePoint','timeRange'].includes(f.type)).map(f=>({value:String(f.id),label:String(f.label??f.id)}))]} onchange={load}/></div>
  <Input label="筛选器 ID" value={filterId} oninput={value=>filterId=value} disabled={busy}/>
  <Input label="标签" value={label} oninput={value=>label=value} disabled={busy}/>
  <div class="field"><span>选择形态</span><Select label="选择形态" value={form} options={[{value:'month',label:'单个月份'},{value:'monthRange',label:'月份范围'},{value:'date',label:'单个日期'},{value:'dateRange',label:'日期范围'},...(dashboard?[{value:'period',label:'年／季／月／近一年'}]:[])]} onchange={value=>{if((form==='period')!==(value==='period')){from='';to='';initialParam='';}form=value;windowChanged=true;}} disabled={busy}/></div>
  {#if form==='period'}<Select label="初始模式" value={periodMode} options={[{value:'year',label:'年'},{value:'quarter',label:'季'},{value:'month',label:'月'},{value:'last12Months',label:'近一年'}]} onchange={value=>{periodMode=value as typeof periodMode;from='';initialParam='';}} disabled={busy}/>{#if Object.values(policies).includes('legacy')}<Select label="旧协议范围格式" value={periodPrecision} options={[{value:'date',label:'日期'},{value:'month',label:'月份'}]} onchange={value=>periodPrecision=value as typeof periodPrecision} disabled={busy}/>{/if}{/if}
  {#if form!=='period'||periodMode!=='last12Months'}<Input label="参数初值 ID（可选）" placeholder="参数初值 ID（可选）" value={initialParam} oninput={value=>initialParam=value} disabled={busy}/>{/if}
  {#if form==='period' && periodMode==='last12Months'}<p class="hint">自动取当前月之前 12 个完整月份。</p>{:else if !initialParam}<DatePicker label="筛选初值" precision={form==='period'&&periodMode!=='last12Months'?periodMode:granularity} range={form==='period'?false:range} value={from?{from,to:range?to:from}:null} onchange={value=>{from=value?.from??'';to=value?.to??'';}} disabled={busy}/>{/if}
  {#if !range}<p class="hint">已有查询保留各自的时间窗口；修改下面选项会应用到所选查询。</p><Select label="查询时间窗口" value={windowKind} options={[{value:'period',label:'当期'},{value:'yearToDate',label:'年初至当前'},{value:'lastN',label:'最近 N 期'}]} onchange={value=>{windowKind=value as typeof windowKind;windowChanged=true;}} disabled={busy}/>{#if windowKind==='lastN'}<Input label="期数" type="number" value={String(n)} oncommit={value=>{n=Number(value);windowChanged=true;}} disabled={busy}/>{/if}<Select label="分区值格式" value={valueFormat} options={[{value:'iso',label:'YYYY-MM / YYYY-MM-DD'},{value:'compact',label:'YYYYMM / YYYYMMDD'}]} onchange={value=>{valueFormat=value as typeof valueFormat;formatChanged=true;}} disabled={busy}/>{/if}
  <fieldset disabled={busy}><legend>关联查询目标</legend>{#each choices as choice}
    <div class="field"><label class="binding"><input type="checkbox" bind:group={selected} value={choice.id}/>{choice.label}</label>
    {#if form==='period'&&selected.includes(choice.id)}
      {@const current=policies[choice.id]??periodPolicyChoice(choice.binding,false)}
      <Select label={`${choice.dataSourceId} 查询期间策略`} value={current} options={periodPolicyOptions.filter(option=>option.value==='legacy'?periodPolicyChoice(loadedBindings[choice.id],!!loadedBindings[choice.id])==='legacy':option.value!=='preserve'||!!loadedBindings[choice.id])} onchange={value=>{policies[choice.id]=value as PeriodPolicyChoice;policyChanged[choice.id]=true;supported[choice.id]??=[];}}/>
      {#if current==='selection'}
        <span>此查询已确认支持的粒度</span>
        {#each ['month','year'] as period}<label class="binding"><input type="checkbox" value={period} bind:group={supported[choice.id]} onchange={()=>policyChanged[choice.id]=true}/>{period==='month'?'月':'年'}</label>{/each}
      {/if}
      <p class="hint">{current==='preserve'?'各分支保留各自配置；选择新策略后统一转换。':periodPolicyPreview(periodMode,from,policyFromChoice(current,supported[choice.id]??[]),previewNow)}</p>
      {#if current==='legacy'}<p class="hint">选择新策略才转换此查询的全部分支；其他查询继续保留。</p>{/if}
    {/if}</div>
  {/each}</fieldset>
  <PrimaryAction disabled={busy||!filterId||!selected.length||incompletePeriod} onclick={save}>应用日期配置</PrimaryAction>
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
