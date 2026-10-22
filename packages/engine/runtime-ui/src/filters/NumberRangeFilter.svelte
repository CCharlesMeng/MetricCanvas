<svelte:options css="injected" />
<script lang="ts">
  /**
   * 数值区间筛选器(纯渲染):上下界任一端可缺省,两端都空则清除。
   */
  import {RangePicker} from '@metriccanvas/ui';
  import {rangeInBaseUnits,type NumberRangeFilterDeclaration} from '@metriccanvas/page/internal';
  interface Props {
    declaration?:NumberRangeFilterDeclaration;
    unit?:{currency:'CNY'|'USD';label:string;scale:number;presets?:NumberRangeFilterDeclaration['presets']};
    label?: string;
    from?: number;
    to?: number;
    onchange: (range: { from?: number; to?: number } | null) => void;
  }

  let { declaration,unit,label, from, to, onchange }: Props = $props();

  function emit(nextFrom: string, nextTo: string) {
    const parsedFrom = nextFrom === '' ? undefined : Number(nextFrom);
    const parsedTo = nextTo === '' ? undefined : Number(nextTo);
    if (parsedFrom === undefined && parsedTo === undefined) {
      onchange(null);
      return;
    }
    if (parsedFrom !== undefined && !Number.isFinite(parsedFrom)) return;
    if (parsedTo !== undefined && !Number.isFinite(parsedTo)) return;
    onchange({ from: parsedFrom, to: parsedTo });
  }
</script>

{#if declaration?.constraints||declaration?.units||declaration?.presets}
<div class="filter">{#if label}<span class="label">{label}</span>{/if}<RangePicker label={label??'金额'} context={unit?.currency??''} unit={unit?.label} value={{...(from===undefined?{}:{from:from/(unit?.scale??1)}),...(to===undefined?{}:{to:to/(unit?.scale??1)})}} presets={unit?.presets??declaration.presets}
validate={range=>{try{rangeInBaseUnits(declaration,range,unit?.scale??1);return undefined;}catch{return '请输入合法范围；双边下限须严格小于上限，金额不能为负';}}}
onchange={range=>{const value=rangeInBaseUnits(declaration,range,unit?.scale??1);onchange(value.from===undefined&&value.to===undefined?null:value);}}/></div>
{:else}
<div class="filter">
  {#if label}<span class="label">{label}</span>{/if}
  <input
    type="number"
    value={from ?? ''}
    placeholder="下限"
    onchange={(e) => emit(e.currentTarget.value, to === undefined ? '' : String(to))}
  />
  <span class="sep">至</span>
  <input
    type="number"
    value={to ?? ''}
    placeholder="上限"
    onchange={(e) => emit(from === undefined ? '' : String(from), e.currentTarget.value)}
  />
  {#if from !== undefined || to !== undefined}
    <button type="button" class="clear" title="清除数值区间" onclick={() => onchange(null)}>✕</button>
  {/if}
</div>

{/if}
<style>
  /* 控件铬与外置字段名标签的可见性经 --mc-filter-* 下发,真源在统一运行时根部。
     区间控件是并排两个输入框,不吃单值控件的 --mc-filter-control-min-width;
     上下限的所指由 placeholder 承担,不依赖外置标签。 */
  .filter {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--mc-filter-font-size, 13px);
  }
  .label {
    display: var(--mc-filter-label-display, inline);
    color: #71717a;
    white-space: nowrap;
  }
  input {
    width: 96px;
    height: var(--mc-filter-control-height, auto);
    padding: 5px 8px;
    border: 1px solid var(--mc-filter-control-border-color, #e4e4e7);
    border-radius: var(--mc-filter-control-radius, 8px);
    background: #fff;
    font-size: var(--mc-filter-font-size, 13px);
    color: #18181b;
    font-family: inherit;
  }
  .sep {
    color: #a1a1aa;
  }
  .clear {
    border: 0;
    background: transparent;
    color: #a1a1aa;
    cursor: pointer;
    font-size: 12px;
    padding: 4px;
  }
  .clear:hover {
    color: #52525b;
  }
</style>
