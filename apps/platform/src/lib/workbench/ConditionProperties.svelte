<script lang="ts">
  import {Dialog,Select} from '@metriccanvas/ui';
  import type {Condition} from '@metriccanvas/page/internal';
  import ToolAction from '../ToolAction.svelte';
  import ConditionRuleEditor from './ConditionRuleEditor.svelte';
  import {conditionSummary,type ConditionFilter} from './condition-editor';
  import type {PropertyControl,PropertyEdit} from './property-edit';
  let {controls,filters,busy,onEdit}: {controls:PropertyControl[];filters:ConditionFilter[];busy:boolean;onEdit:(edit:PropertyEdit)=>string|void}=$props();
  let editing=$state<string|null>(null);
  const configured=$derived(controls.filter(control=>control.value!==undefined));
  const current=$derived(controls.find(control=>control.id===editing));
  function apply(value:unknown){if(busy||!current)return '页面当前不可编辑。';return onEdit({...current.target,value});}
</script>
{#if controls.length}
  <section aria-label="条件规则">
    <h5>条件规则</h5>
    {#if configured.length}
      {#each configured as control(control.id)}
        <div>
          <b>{control.label}</b>
          <p>{conditionSummary(control.value as Condition,filters)}</p>
          <ToolAction disabled={busy} onclick={()=>editing=control.id}>编辑规则</ToolAction>
          <ToolAction disabled={busy} onclick={()=>onEdit({...control.target,value:undefined})}>移除规则</ToolAction>
        </div>
      {/each}
    {:else}<p>未设置附加条件，沿用页面默认行为。</p>{/if}
    <ToolAction disabled={busy} onclick={()=>editing=controls.find(control=>control.value===undefined)?.id??controls[0].id}>添加条件</ToolAction>
  </section>
{/if}
<Dialog open={!!current} title="配置条件规则" onclose={()=>editing=null}>
  {#if current}
    <div class="target-field"><p>作用对象与条件</p><Select label="作用对象与条件" value={current.id} options={controls.map(control=>({value:control.id,label:control.label}))} disabled={busy} onchange={next=>editing=next}/></div>
    {#key current.id+JSON.stringify(current.value)}
      <ConditionRuleEditor value={current.value as Condition|undefined} {filters} {busy} onapply={apply} onclose={()=>editing=null}/>
    {/key}
    <p>应用后可在画布检查效果；确认保存后才会写入页面资产。无效条件不会覆盖原规则。</p>
  {/if}
</Dialog>
<style>
  section{display:grid;gap:14px;padding-bottom:18px;border-bottom:1px solid #eef0f4;font-size:12px;color:#647084}
  h5{margin:0;color:#303b4d;font-size:12px}p{margin:0;line-height:1.6;overflow-wrap:anywhere}
  .target-field{display:grid;gap:8px;margin-bottom:20px}
</style>
