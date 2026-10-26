<script lang="ts">
  import {untrack} from 'svelte';
  import {Select,Textarea} from '@metriccanvas/ui';
  import type {Condition} from '@metriccanvas/page/internal';
  import PrimaryAction from '../PrimaryAction.svelte';
  import ToolAction from '../ToolAction.svelte';
  import {basicConditionSelection,basicFilterCondition,filterConditionChoices,type ConditionFilter} from './condition-editor';
  let {value,filters,busy,onapply,onclose}: {value: Condition | undefined;filters: ConditionFilter[];busy:boolean;
    onapply:(value:unknown)=>string|void;onclose:()=>void}=$props();
  const choices=$derived(filterConditionChoices(filters));
  const initial=untrack(()=>basicConditionSelection(value,choices));
  let mode=$state(untrack(()=>value&&!initial?'advanced':'basic'));
  let choiceId=$state(untrack(()=>initial?.choice??choices[0]?.value??''));
  let selected=$state(initial?.selected!==false);
  let raw=$state(untrack(()=>value?JSON.stringify(value,null,2):''));
  let error=$state('');
  function commit(value:unknown){const message=onapply(value);if(message)error=message;else onclose();}
  function apply(){
    if(busy)return;
    if(mode==='basic'){
      const choice=choices.find(item=>item.value===choiceId);
      if(choice)commit(basicFilterCondition(choice,selected));
      return;
    }
    try{commit(raw.trim()?JSON.parse(raw):undefined);}
    catch{error='条件必须是合法 JSON；原规则未修改。';}
  }
</script>
<div class="fields">
<div><p>编辑方式</p><Select label="编辑方式" value={mode} options={[{value:'basic',label:'基础筛选条件'},{value:'advanced',label:'高级：JSON 条件'}]} disabled={busy} onchange={next=>mode=next}/></div>
{#if mode==='basic'}
  {#if value&&!initial}<p>应用基础条件将替换这条原有规则。关闭窗口会保留原规则。</p>{/if}
  {#if choices.length}
    <div><p>关联筛选器</p><Select label="关联筛选器" value={choiceId} options={choices} disabled={busy} onchange={next=>choiceId=next}/></div>
    <div><p>满足条件</p><Select label="满足条件" value={selected?'selected':'empty'} options={[{value:'selected',label:'已选择／已填写'},{value:'empty',label:'未选择／未填写'}]} disabled={busy} onchange={next=>selected=next==='selected'}/></div>
  {:else}<p>当前页面没有筛选器。可在高级编辑中配置已有权限、页面事实或组合条件。</p>{/if}
{:else}
  <p>保留原有 Condition 协议。支持已有权限、页面事实、行条件及组合条件；应用时仍执行页面校验。</p>
  <Textarea label="条件 JSON" value={raw} disabled={busy} oninput={next=>raw=next}/>
{/if}
{#if error}<p role="alert">{error}</p>{/if}
<div><ToolAction disabled={busy} onclick={onclose}>取消</ToolAction>
<PrimaryAction disabled={busy||(mode==='basic'&&!choiceId)} onclick={apply}>应用条件</PrimaryAction></div>
</div>
<style>.fields{display:grid;gap:20px}p{margin:0 0 8px;font-size:14px}</style>
