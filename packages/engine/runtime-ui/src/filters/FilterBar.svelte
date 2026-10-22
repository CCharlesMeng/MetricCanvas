<svelte:options css="injected" />
<script module lang="ts">
  import type { PeriodRange } from '@metriccanvas/page/internal';
</script>
<script lang="ts">
  import {selectedCase,appliedAmountRange} from '@metriccanvas/page/internal';
  import { candidateScopeKey } from '../../../runtime/src/dimension-values';
  /**
   * 筛选栏:页面筛选器声明 → 对应控件的唯一分发点。
   *
   * 从 RuntimeView 抽出,使新增筛选器类型只改这一个文件加一个控件,
   * 不再与组件分发、参数水合、表格交互挤在同一份源文件里。
   * 本身零状态:当前值与候选值由运行时传入,变更只上抛。
   */
  import type {
    FilterDeclaration,
    NumberRangeValue,
    TimeRangeValue
  } from '@metriccanvas/page/internal';
  import {
    dimensionValuesSnapshot,
    type DimensionValuesSnapshots,
    type FilterValues
  } from '../../../runtime/src';
  import DimensionFilter from './DimensionFilter.svelte';
  import HierarchyFilter from './HierarchyFilter.svelte';
  import {timeControlLimits,type TimeControlContext} from './time-controls';
  import {resolveRelativeTime,timeAvailabilityIssue,timeFilterBoundaryError} from '@metriccanvas/page/internal';
  import ModeTimeRangeFilter from './ModeTimeRangeFilter.svelte';
  import PeriodFilter from './PeriodFilter.svelte';
  import TimeRangeFilter from './TimeRangeFilter.svelte';
  import TimePointFilter from './TimePointFilter.svelte';
  import BooleanFilter from './BooleanFilter.svelte';
  import NumberRangeFilter from './NumberRangeFilter.svelte';
  import SearchFilter from './SearchFilter.svelte';
  import { dimensionValueOf } from './cascade';
  import { visibleFilterDeclarations } from './filter-bar';

  function closeInactiveMenus(node:HTMLElement) {
    const observer=new MutationObserver(()=>{ if(node.closest('[inert]')) for(const details of node.querySelectorAll('details[open]')) details.removeAttribute('open'); });
    const ancestor=node.closest('[data-ioc-filter]');
    if(ancestor)observer.observe(ancestor,{attributes:true,attributeFilter:['inert']});
    return {destroy:()=>observer.disconnect()};
  }
  type DimensionDeclaration = Extract<FilterDeclaration, { type: 'dimension' }>;

  interface Props {
    declarations: FilterDeclaration[];
    timeContext?:TimeControlContext;
    values: FilterValues;
    candidates: DimensionValuesSnapshots;
    ondimension: (declaration: DimensionDeclaration, values: string[], level?: string) => void;
    ontimerange: (filterId: string, range: TimeRangeValue | null) => void;
    ontimepoint: (filterId: string, granularity: 'month' | 'date', value: string | null) => void;
    onboolean: (filterId: string, checked: boolean) => void;
    onnumberrange: (filterId: string, range: NumberRangeValue | null) => void;
    onsearch: (filterId: string, query: string) => void;
    /** 保留筛选信息架构但不建立可变状态。 */
    onretry?: (filterId:string)=>void;
    readOnly?: boolean;
    note?: string;
  }

  let {
    declarations,
    timeContext={},
    values,
    candidates,
    ondimension,
    ontimerange,
    ontimepoint,
    onboolean,
    onnumberrange,
    onsearch,
    onretry,
    readOnly = false,
    note
  }: Props = $props();

  const hintPrefix=$props.id();
  const visible = $derived(visibleFilterDeclarations(declarations));
  let presetError=$state('');
  function preset(filter:Extract<FilterDeclaration,{type:'timeRange'}>,range:import('@metriccanvas/page/internal').RelativeTimeExpression){
    const now=new Date(),current=timeRangeValue(filter.id),precision=current?.mode==='month'||filter.precision==='month'?'month':'date';
    const next={...resolveRelativeTime(range,now,precision),...(current?.mode?{mode:current.mode}:{})};
    presetError=timeAvailabilityIssue(filter,{type:'timeRange',...next},timeContext.snapshot,timeContext.revision)??timeFilterBoundaryError(filter,{type:'timeRange',...next},now)??'';
    if(!presetError)ontimerange(filter.id,next);
  }

  function timeRangeValue(filterId: string): TimeRangeValue | null {
    const value = values.get(filterId);
    return value?.type === 'timeRange' ? value : null;
  }

  function timePointValue(filterId: string): string | null {
    const value = values.get(filterId);
    return value?.type === 'timePoint' ? value.value : null;
  }

  function booleanValue(filterId: string): boolean {
    const value = values.get(filterId);
    return value?.type === 'boolean' && value.value;
  }

  function numberRangeValue(filterId: string): NumberRangeValue {
    const value = values.get(filterId);
    return value?.type === 'numberRange' ? { from: value.from, to: value.to } : {};
  }

  function searchValue(filterId: string): string {
    const value = values.get(filterId);
    return value?.type === 'search' ? value.query : '';
  }

  function currentDimension(declaration: DimensionDeclaration): string {
    const current = dimensionValueOf(values, declaration.id);
    if (declaration.hierarchy) {
      const level =
        declaration.hierarchy.find((item) => item.id === current.level) ?? declaration.hierarchy[0];
      return level?.dimension ?? declaration.dimension;
    }
    return declaration.dimension;
  }

  function dimensionDisplay(declaration: DimensionDeclaration): string {
    const selected=dimensionValueOf(values,declaration.id).values;
    return (selected.length?selected.map(value=>declaration.options?.find(option=>option.value===value)?.label??value).join('、'):undefined) ?? declaration.emptyLabel ?? declaration.label ?? '全部';
  }
</script>

<div use:closeInactiveMenus class:read-only={readOnly} class="filter-bar">
  {#each visible as declaration (declaration.id)}
    {@const limits=timeControlLimits(declaration,timeContext)}
    <div data-filter-control data-filter-id={declaration.id} class="filter-control" role="group" aria-label={declaration.label} aria-describedby={typeof declaration.hint==='string'?`${hintPrefix}-${declaration.id}`:undefined}>
    {#if declaration.type === 'timeRange' && declaration.display === 'modes'}
      <ModeTimeRangeFilter {declaration} value={timeRangeValue(declaration.id)} readOnly={readOnly||!!limits.reason} max={limits.max} blockedRanges={limits.blockedRanges} snapshot={timeContext.snapshot} revision={timeContext.revision} onchange={next=>ontimerange(declaration.id,next)}/>
    {:else if declaration.type === 'timeRange' && declaration.display === 'period'}
      <PeriodFilter periodModes={declaration.periodModes} min={declaration.min} max={limits.max} blockedRanges={limits.blockedRanges} label={declaration.label} precision={declaration.precision === 'month' ? 'month' : 'date'} value={timeRangeValue(declaration.id) as PeriodRange | null} readOnly={readOnly||!!limits.reason} onchange={next=>ontimerange(declaration.id,next)}/>
    {:else if readOnly && declaration.type === 'boolean'}
      <label class="readonly-boolean">
        <input type="checkbox" checked={booleanValue(declaration.id)} disabled />
        <span data-filter-display>{declaration.label ?? '布尔筛选'}</span>
      </label>
    {:else if readOnly && declaration.type === 'timePoint'}
      <TimePointFilter label={declaration.label} required={declaration.required} min={declaration.min} granularity={declaration.granularity}
        value={timePointValue(declaration.id)} readOnly onchange={() => {}} />
    {:else if readOnly && declaration.type === 'timeRange'}
      <TimeRangeFilter label={declaration.label} required={declaration.required} precision={declaration.precision ?? 'date'}
        value={timeRangeValue(declaration.id)} readOnly onchange={() => {}} />
    {:else if readOnly && declaration.type === 'dimension'}
      <button type="button" class="readonly-select" aria-label={declaration.label} disabled>
        <span data-filter-display>{dimensionDisplay(declaration)}</span>
        <span aria-hidden="true" class="readonly-arrow">▾</span>
      </button>
    {:else if readOnly}
      <button type="button" class="readonly-select" aria-label={declaration.label} disabled>
        <span data-filter-display>{declaration.label ?? '筛选'}{#if declaration.type === 'numberRange' && (numberRangeValue(declaration.id).from !== undefined || numberRangeValue(declaration.id).to !== undefined)}：{declaration.units?appliedAmountRange(declaration,numberRangeValue(declaration.id),values):`${numberRangeValue(declaration.id)?.from??'不限'}～${numberRangeValue(declaration.id)?.to??'不限'}`}{:else if declaration.type === 'search' && searchValue(declaration.id)}：{searchValue(declaration.id)}{/if}</span>
      </button>
    {:else if declaration.type === 'dimension' && declaration.hierarchy}
      {@const current = dimensionValueOf(values, declaration.id)}
      <HierarchyFilter selection={declaration.selection??(declaration.options?{mode:'multiple'}:undefined)} structural={declaration.treeSelection==='level'} searchable={declaration.searchable??true} treeSelection={declaration.treeSelection==='level'?undefined:declaration.treeSelection} onretry={onretry?()=>onretry(declaration.id):undefined}
        label={declaration.label}
        emptyLabel={declaration.emptyLabel}
        candidateLevels={Object.fromEntries(declaration.hierarchy.map(item=>[item.id,dimensionValuesSnapshot(candidates,candidateScopeKey(declaration.id,item.dimension,item.id))]))}
        levels={declaration.hierarchy}
        level={current.level ?? declaration.defaultLevel ?? declaration.hierarchy[0]!.id}
        values={current.values}
        picker={declaration.hierarchyPicker ?? 'tabs'}
        display={declaration.display ?? 'select'}
        candidates={dimensionValuesSnapshot(candidates, candidates.has(candidateScopeKey(declaration.id,currentDimension(declaration),current.level ?? declaration.defaultLevel ?? declaration.hierarchy[0]?.id)) ? candidateScopeKey(declaration.id,currentDimension(declaration),current.level ?? declaration.defaultLevel ?? declaration.hierarchy[0]?.id) : currentDimension(declaration))}
        onchange={(next) => ondimension(declaration, next.values, next.level)}
      />
    {:else if declaration.type === 'dimension'}
      <DimensionFilter searchable={declaration.searchable??true} treeSelection={declaration.treeSelection==='level'?undefined:declaration.treeSelection} selection={declaration.selection??(declaration.options?{mode:'multiple'}:undefined)}
        onretry={onretry?()=>onretry(declaration.id):undefined}
        label={declaration.label}
        emptyLabel={declaration.emptyLabel}
        candidates={declaration.options?{status:'ready',candidates:declaration.options}:dimensionValuesSnapshot(candidates, candidates.has(candidateScopeKey(declaration.id,declaration.dimension)) ? candidateScopeKey(declaration.id,declaration.dimension) : declaration.dimension)}
        value={dimensionValueOf(values, declaration.id).values}
        display={declaration.display ?? 'select'}
        onchange={(next) => ondimension(declaration, next)}
      />
    {:else if declaration.type === 'timeRange'}
      <TimeRangeFilter
        label={declaration.label}
        required={declaration.required}
        readOnly={!!limits.reason} min={declaration.min} max={limits.max} blockedRanges={limits.blockedRanges} disableFuture={declaration.disableFuture}
        precision={declaration.precision ?? 'date'}
        value={timeRangeValue(declaration.id)}
        onchange={(range) => ontimerange(declaration.id, range)}
      />
    {:else if declaration.type === 'timePoint'}
      <TimePointFilter
        label={declaration.label}
        required={declaration.required}
        granularity={declaration.granularity}
        min={declaration.min} max={limits.max} blockedRanges={limits.blockedRanges} readOnly={!!limits.reason}
        disableFuture={declaration.disableFuture}
        value={timePointValue(declaration.id)}
        onchange={(value) => ontimepoint(declaration.id, declaration.granularity, value)}
      />
    {:else if declaration.type === 'boolean'}
      <BooleanFilter
        label={declaration.label}
        value={booleanValue(declaration.id)}
        onchange={(checked) => onboolean(declaration.id, checked)}
      />
    {:else if declaration.type === 'numberRange'&&declaration.units&&dimensionValueOf(values,declaration.units.filterId).values.length!==1}
      <span>等待合法币种选择</span>
    {:else if declaration.type === 'numberRange'}
      {@const range = numberRangeValue(declaration.id)}
      <NumberRangeFilter declaration={declaration} unit={declaration.units?selectedCase(declaration.units.cases,dimensionValueOf(values,declaration.units.filterId).values):undefined}
        label={declaration.label}
        from={range.from}
        to={range.to}
        onchange={(next) => onnumberrange(declaration.id, next)}
      />
    {:else}
      <SearchFilter
        label={declaration.label}
        value={searchValue(declaration.id)}
        onchange={(query) => onsearch(declaration.id, query)}
      />
    {/if}
    {#if limits.reason}<span role="status">{limits.reason}</span>{/if}
    {#if declaration.type==='timeRange'&&declaration.presets&&!readOnly}<div class="time-presets" role="group" aria-label="时间快捷预设">{#each declaration.presets as item}<button type="button" disabled={!!limits.reason} onclick={()=>preset(declaration,item.range)}>{item.label}</button>{/each}</div>{/if}
    {#if typeof declaration.hint==='string'}<span class="filter-hint" id={`${hintPrefix}-${declaration.id}`} data-filter-hint>{declaration.hint}</span>{/if}
    </div>
  {/each}
  {#if presetError}<p role="status">{presetError}</p>{/if}
  {#if note}<p class="filter-note">{note}</p>{/if}
</div>

<style>
.time-presets{display:flex;flex-wrap:wrap;gap:4px;max-width:100%}.time-presets button{background:#fff;border:1px solid #e4e4e7;border-radius:4px;color:#52525b;padding:4px 7px;font:inherit;font-size:12px;cursor:pointer}
.filter-hint{color:#71717a;font-size:12px;max-width:280px;overflow-wrap:anywhere}.filter-control{flex-wrap:wrap}
  .filter-bar {
    min-width:0; max-width:100%; box-sizing:border-box;
    display: flex;
    flex: var(--mc-filter-bar-flex, 0 1 auto);
    flex-wrap: var(--mc-filter-bar-wrap, wrap);
    align-items: center;
    justify-content: var(--mc-filter-bar-justify-content, normal);
    gap: var(--mc-filter-bar-gap, 20px);
    padding: var(--mc-filter-bar-padding, 12px 16px);
    margin: var(--mc-filter-bar-margin, 0 0 18px);
    background: var(--mc-filter-bar-background, var(--mc-color-surface));
    border: var(--mc-filter-bar-border, 1px solid var(--mc-color-border));
    border-radius: var(--mc-filter-bar-radius, var(--mc-radius-cell));
  }
  .filter-control {
    flex: var(--mc-filter-control-flex, none);
    min-width:0; max-width:100%;
  }
  .readonly-boolean {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #191919;
    font-size: 14px;
    white-space: nowrap;
  }
  .readonly-select {
    box-sizing: border-box;
    height: 32px;
    padding: 0 10px;
    color: #595959;
    background: #fff;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    font: inherit;
    font-size: 14px;
  }
  .readonly-select {
    display: inline-flex;
    min-width: 112px;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .readonly-select:disabled,
  .readonly-boolean input:disabled {
    cursor: not-allowed;
    opacity: 1;
  }
  .readonly-arrow {
    color: #8c8c8c;
  }
  .filter-note {
    flex: var(--mc-filter-note-flex, 1 0 100%);
    margin: 0;
    color: #8c8c8c;
    font-size: 12px;
    line-height: 18px;
    white-space: var(--mc-filter-note-white-space, normal);
  }
</style>
