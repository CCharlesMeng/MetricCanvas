<script lang="ts">
  import {Input,Textarea,Select} from '@metriccanvas/ui';
  import ConditionProperties from './ConditionProperties.svelte';
  import type {ConditionFilter} from './condition-editor';
  import type { PropertyControl, PropertyEdit } from './property-edit';
  let { controls, filters=[], busy = false, onEdit }: { controls: PropertyControl[]; filters?:ConditionFilter[]; busy?: boolean; onEdit: (edit: PropertyEdit) => string|void } = $props();
  const valueText = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  const fields=$derived(controls.filter(control=>control.target.kind!=='presentation'));
  const conditions=$derived(controls.filter(control=>control.target.kind==='presentation'));
  let conditionError=$state('');
  function submit(control: PropertyControl, raw: string) {
    let value: unknown = raw;
    if(control.kind==='json'){try{value=raw.trim()?JSON.parse(raw):undefined;conditionError='';}catch{conditionError='输入必须是合法JSON；原值未修改。';return;}}
    else if (control.kind === 'boolean') value = raw === '' ? undefined : raw === 'true';
    else if (control.kind === 'number') value = raw.trim() === '' ? undefined : Number(raw);
    else if (control.kind === 'choice') value = raw === '' ? undefined : raw;
    else if (control.kind === 'tags') value = raw.split('\n').map((item) => item.trim()).filter(Boolean);
    onEdit({ ...control.target, value });
  }
</script>
{#if fields.length}
  <section aria-label="展示属性">
    <h5>展示属性</h5>
    {#each fields as control (control.id)}
      <div class="property-field">
        <span>{control.label}</span>
        {#if control.kind === 'boolean' || control.kind === 'choice'}
          <Select label={control.label} disabled={busy} value={control.value === undefined?'':String(control.value)} options={[{value:'',label:'默认'},...(control.kind==='boolean'?[{value:'true',label:'开启'},{value:'false',label:'关闭'}]:(control.choices??[]).map(choice=>({value:choice,label:({content:'按内容',container:'适配容器',left:'左侧',right:'右侧',field:'字段',constant:'常量'} as Record<string,string>)[choice]??choice})))]} onchange={value=>submit(control,value)}/>
        {:else if control.kind==='json'}
          <Textarea label={control.label} disabled={busy} value={control.value===undefined?'':JSON.stringify(control.value,null,2)} oncommit={value=>submit(control,value)}/>
        {:else if control.kind === 'tags'}
          <Textarea label={control.label} disabled={busy} value={Array.isArray(control.value)?control.value.map(valueText).join('\n'):''} oncommit={value=>submit(control,value)}/>
        {:else}
          <Input label={control.label} type={control.kind==='number'?'number':'text'} disabled={busy} value={valueText(control.value)} oncommit={value=>submit(control,value)}/>
        {/if}
        {#if control.kind!=='json' && control.value && typeof control.value === 'object' && (!Array.isArray(control.value) || control.value.some((item) => item && typeof item === 'object'))}<small>此值含参数引用，编辑此项将替换为固定文字。</small>{/if}
      </div>
    {/each}
    {#if conditionError}<p role="alert">{conditionError}</p>{/if}
  </section>
{/if}
<ConditionProperties controls={conditions} {filters} {busy} {onEdit}/>
<style>
  section { display: grid; gap: 14px; padding-bottom: 18px; border-bottom: 1px solid #eef0f4; }
  h5 { margin: 0; color: #303b4d; font-size: 12px; }
  .property-field { display: grid; gap: 7px; font-size: 12px; color: #647084; }
  small { color: var(--muted); font-size: 11px; line-height: 1.6; }
</style>
