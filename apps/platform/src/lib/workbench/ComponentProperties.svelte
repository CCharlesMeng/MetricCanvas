<script lang="ts">
  import {Input,Textarea,Select} from '@metriccanvas/ui';
  import type { PropertyControl, PropertyEdit } from './property-edit';
  let { controls, busy = false, onEdit }: { controls: PropertyControl[]; busy?: boolean; onEdit: (edit: PropertyEdit) => void } = $props();
  const valueText = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  function submit(control: PropertyControl, raw: string) {
    let value: unknown = raw;
    if (control.kind === 'boolean') value = raw === '' ? undefined : raw === 'true';
    else if (control.kind === 'number') value = raw.trim() === '' ? undefined : Number(raw);
    else if (control.kind === 'choice') value = raw === '' ? undefined : raw;
    else if (control.kind === 'tags') value = raw.split('\n').map((item) => item.trim()).filter(Boolean);
    onEdit({ ...control.target, value });
  }
</script>
{#if controls.length}
  <section aria-label="展示属性">
    <h5>展示属性</h5>
    {#each controls as control (control.id)}
      <div class="property-field">
        <span>{control.label}</span>
        {#if control.kind === 'boolean' || control.kind === 'choice'}
          <Select label={control.label} disabled={busy} value={control.value === undefined?'':String(control.value)} options={[{value:'',label:'默认'},...(control.kind==='boolean'?[{value:'true',label:'开启'},{value:'false',label:'关闭'}]:(control.choices??[]).map(choice=>({value:choice,label:({content:'按内容',container:'适配容器',left:'左侧',right:'右侧'} as Record<string,string>)[choice]??choice})))]} onchange={value=>submit(control,value)}/>
        {:else if control.kind === 'tags'}
          <Textarea label={control.label} disabled={busy} value={Array.isArray(control.value)?control.value.map(valueText).join('\n'):''} oncommit={value=>submit(control,value)}/>
        {:else}
          <Input label={control.label} type={control.kind==='number'?'number':'text'} disabled={busy} value={valueText(control.value)} oncommit={value=>submit(control,value)}/>
        {/if}
        {#if control.value && typeof control.value === 'object' && (!Array.isArray(control.value) || control.value.some((item) => item && typeof item === 'object'))}<small>此值含参数引用，编辑此项将替换为固定文字。</small>{/if}
      </div>
    {/each}
  </section>
{/if}
<style>
  section { display: grid; gap: 16px; }
  h5 { margin: 0; color: #595959; font-size: 14px; }
  .property-field { display: grid; gap: 8px; font-size: 14px; color: #595959; }
  small { color: var(--muted); }
</style>
