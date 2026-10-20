import {timeAvailabilityIssue,modeRangeIssue,type DisplayInputsSnapshot} from '@metriccanvas/page/internal';
import { numberRangeIssue,rangeContextIssue, filterDependencies, dimensionSelectionIssue } from '@metriccanvas/page/internal';
import { resolvePeriodSelection, isPeriodSelection } from '@metriccanvas/page/internal';
import { filterURLKeys } from '@metriccanvas/page/internal';
import {
  timeFilterBoundaryError,
  dimensionOfLevel,
  validateCalendarTimeRange,
  validateTimePointValue,
  type FilterDeclaration
} from '@metriccanvas/page/internal';

import { initialFilterValues } from '@metriccanvas/data-execution/runtime';
import type { FilterValue, FilterValues } from '@metriccanvas/data-execution/runtime';
export { initialFilterValues };
export type { FilterValue, FilterValues, DimensionFilterValue, TimeRangeFilterValue, TimePointFilterValue, BooleanFilterValue, NumberRangeFilterValue, SearchFilterValue } from '@metriccanvas/data-execution/runtime';

/**
 * 筛选状态 store:页面级共享的筛选条件集合,联动的唯一总线。
 * 筛选器写入它,query 页面数据源声明订阅它,图表点击回写它;组件间不直接连线。
 * subscribe 兼容 svelte store 契约(立即同步推送当前值),subscribe/write 永不 throw。
 */
export type FilterIntent =
  | { type: 'set'; filterId: string; value: FilterValue }
  | { type: 'clear'; filterId: string }
  | { type: 'applyDraft'; changes: ReadonlyArray<readonly [string, FilterValue | null]> }
  | { type: 'initialize' | 'restore'; values: FilterValues }
  | { type: 'reset'; baseline: 'initial' };
export type CommitResult = { ok: true; filterRevision: number; changedIds: string[] } |
  { ok: false; issues: Array<{ filterId: string; code: string; message: string }> };
export interface FilterCoordinator { commit(intent: FilterIntent): CommitResult; }

interface CoordinatedFilterState extends FilterState, FilterCoordinator {
  /** A legality gate, independent of visibility. The owning runtime feeds candidate receipts. */
  blocked(): ReadonlySet<string>;
  refreshContext():void;
  readonly revision:number;
  clock():Date;
  candidate(filterId: string, status: 'loading' | 'ready' | 'empty' | 'error' | 'unavailable' | 'denied' | 'unconfigured', values?: readonly string[]): void;

}

export interface FilterState {
  readonly revision?: number;
  subscribe(run: (values: FilterValues) => void): () => void;
  write(filterId: string, value: FilterValue | null): void;
  /** 原子写入多个筛选值，只向订阅方推送一次完整状态。 */
  writeMany(updates: ReadonlyArray<readonly [string, FilterValue | null]>): void;
  /** 序列化为 URL 查询串(不含 '?'),筛选状态可分享 */
  toURL(declarations?: readonly FilterDeclaration[]): string;
  /** 从 URL 查询串整体还原状态;只解析声明的查询键，忽略无关参数与畸形值 */
  fromURL(search: string, declarations: readonly FilterDeclaration[]): void;
}

export function createFilterState(initial?: FilterValues, declarations: readonly FilterDeclaration[] = [], dimensionOptions: ReadonlyMap<string, readonly string[]> = new Map(), editing: { readOnly?: () => boolean; candidates?: boolean;displayInputs?:()=>DisplayInputsSnapshot|undefined;now?:()=>Date } = {}): CoordinatedFilterState {
  function accepted(id: string, value: FilterValue | null | undefined): boolean {
    const options = dimensionOptions.get(id);
    return !options || !!value && value.type === 'dimension' && value.values.length === 1 && options.includes(value.values[0]!);
  }
  const byId = new Map(declarations.map(declaration => [declaration.id, declaration]));
  let current: Map<string, FilterValue> = new Map();
  for (const [id, value] of initial ?? []) {
    const declaration = byId.get(id);
    const timed = declaration?.type === 'timeRange' || declaration?.type === 'timePoint';
    if (declarations.length && (!declaration || !matchesDeclaration(value,declaration))) throw new Error(`筛选器 ${id} 初值不符合声明`);
    const valid = normalize(value, declaration,editing.now?.());
    if (valid === undefined || timed && !valid) throw new Error(`筛选器 ${id} 初值不符合时间边界`);
    if (!accepted(id, valid)) throw new Error(`图表筛选器 ${id} 初值不在候选项中`);
    if (valid) current.set(id, valid);
  }
  for(const declaration of declarations)if(declaration.type==='numberRange'&&current.has(declaration.id)&&rangeContextIssue(declaration,current))throw new Error('金额币种初值未通过校验');
  const baseline = new Map(current);
  let revision = 0,operationClock=editing.now?.()??new Date();
  const receipts = new Map<string, { status: string; values?: readonly string[] }>();
  // Cleared descendants require an explicit choice/clear, never an automatic broadened query.
  const confirmation = new Set<string>();
  const intersections = new Set<string>();
  function invalidate(changed:readonly string[],normalized:Map<string,FilterValue|null>,trusted:boolean) {
    const queue=[...changed],visited=new Set<string>();
    for(const parent of queue)for(const declaration of declarations){
      if(!filterDependencies(declaration).includes(parent))continue;
      if(!visited.has(declaration.id)){visited.add(declaration.id);queue.push(declaration.id);}
      receipts.delete(declaration.id);
      const intersect=declaration.type==='dimension'&&declaration.candidateContext?.reconcile==='intersection'&&!declaration.clearOnChangeOf?.includes(parent);
      if(intersect&&!normalized.has(declaration.id))intersections.add(declaration.id);
      else if(!intersect){intersections.delete(declaration.id);if(!trusted&&!normalized.has(declaration.id)){normalized.set(declaration.id,null);confirmation.add(declaration.id);}}
    }
  }
  function blocked(): Set<string> {
    const result = new Set(confirmation);
    for(const declaration of declarations)if(timeAvailabilityIssue(declaration,current.get(declaration.id),editing.displayInputs?.(),revision)||((declaration.type==='timeRange'||declaration.type==='timePoint')&&declaration.required&&!current.has(declaration.id)))result.add(declaration.id);
    for (const declaration of declarations) {
      const selected = current.get(declaration.id);
      if(declaration.type!=='dimension')continue;
      if(declaration.selection?.required && (selected?.type!=='dimension'||selected.values.length!==1))result.add(declaration.id);
      if(intersections.has(declaration.id))result.add(declaration.id);
      if(!editing.candidates||dimensionOptions.has(declaration.id)||declaration.options)continue;
      if(declaration.candidateContext||declaration.treeSelection||declaration.candidateWindow){if(receipts.get(declaration.id)?.status!=='ready')result.add(declaration.id);}
      if(selected?.type!=='dimension'||!selected.values.length)continue;
      const receipt = receipts.get(declaration.id);
      if (!receipt || receipt.status !== 'ready' || selected.values.some(value => !receipt.values?.includes(value))) result.add(declaration.id);
    }
    const queue=[...result];for(const parent of queue)for(const declaration of declarations)if(!result.has(declaration.id)&&filterDependencies(declaration).includes(parent)){result.add(declaration.id);queue.push(declaration.id);}
    return result;
  }
  const subscribers = new Set<(values: FilterValues) => void>();

  function replace(next: Map<string, FilterValue>) {
    // 先构造新 Map 再整体替换:已推送出去的实例永不被原地修改,订阅方可安全持有与比较
    current = next;
    for (const run of subscribers) notify(run, current);
  }

  function commit(intent: FilterIntent): CommitResult {
    const now=editing.now?.()??new Date(),facts=editing.displayInputs?.();
    const trusted = intent.type === 'initialize' || intent.type === 'restore';
    const changes: ReadonlyArray<readonly [string, FilterValue | null]> =
      intent.type === 'set' ? [[intent.filterId, intent.value]] : intent.type === 'clear' ? [[intent.filterId, null]] :
      intent.type === 'applyDraft' ? intent.changes : [...new Set([...(intent.type==='initialize'?[]:byId.keys()), ...current.keys(), ...(intent.type === 'reset' ? baseline : intent.values).keys()])]
        .map(id => [id, (intent.type === 'reset' ? baseline : intent.values).get(id) ?? null] as const);
    const issues: Array<{filterId:string;code:string;message:string}> = [];
    const normalized = new Map<string, FilterValue | null>();
    for (const [id, value] of changes) {
      const declaration = byId.get(id);
      const invalid = declarations.length > 0 && !declaration || value && declaration && !matchesDeclaration(value, declaration);
      const next = invalid ? undefined : normalize(value, declaration,now);
      const availability=next&&declaration?timeAvailabilityIssue(declaration,next,facts,revision):undefined;
      if (availability || (!trusted && editing.readOnly?.()) || invalid || next === undefined || !accepted(id, next)) {
        issues.push({filterId:id,code:'INVALID_FILTER_INTENT',message:'筛选写入不符合声明、边界或只读约束'});
      } else normalized.set(id, next);
    }
    const preview=new Map(current);for(const [id,value]of normalized)if(value)preview.set(id,value);else preview.delete(id);
    for(const declaration of declarations)if(declaration.type==='numberRange'&&preview.has(declaration.id)&&rangeContextIssue(declaration,preview))issues.push({filterId:declaration.id,code:'INVALID_FILTER_INTENT',message:'金额币种未通过校验'});
    if (issues.length) return {ok:false,issues};
    const map = new Map(current);
    const changed = [...normalized].filter(([id, value]) => !sameValue(current.get(id), value)).map(([id]) => id);
    let gatesChanged = false;
    for(const id of changed){const before=current.get(id),after=normalized.get(id);if(before?.type==='dimension'&&after?.type==='dimension'&&(before.dimension!==after.dimension||before.level!==after.level))receipts.delete(id);}
    for(const [id] of changes)if(intersections.delete(id))gatesChanged=true;
    invalidate(changed,normalized,trusted);
    for (const [id] of changes) if (confirmation.delete(id)) gatesChanged = true;
    for (const [id, value] of normalized) { if (value) map.set(id, value); else map.delete(id); }
    const changedIds = [...new Set([...current.keys(), ...map.keys()])].filter(id => !sameValue(current.get(id), map.get(id) ?? null));
    if (changedIds.length || gatesChanged) { revision++;operationClock=now; replace(map); }
    return {ok:true,filterRevision:revision,changedIds};
  }

  return {
    subscribe(run) {
      subscribers.add(run);
      notify(run, current);
      return () => {
        subscribers.delete(run);
      };
    },

    commit,
    blocked,
    get revision(){return revision;},clock:()=>new Date(operationClock),
    refreshContext(){operationClock=editing.now?.()??new Date();replace(new Map(current));},
    candidate(filterId, status, values) {
      const previous = [...blocked()].sort().join('\0');
      receipts.set(filterId, { status, values });
      if(status==='ready'&&intersections.delete(filterId)){
        const selected=current.get(filterId);
        const kept=selected?.type==='dimension'?selected.values.filter(value=>values?.includes(value)):[];
        if(!kept.length)confirmation.add(filterId);else confirmation.delete(filterId);
        if(selected?.type==='dimension'&&kept.length!==selected.values.length){
          const normalized=new Map<string,FilterValue|null>([[filterId,kept.length?{...selected,values:kept}:null]]);
          invalidate([filterId],normalized,false);
          const next=new Map(current);for(const [id,value]of normalized)if(value)next.set(id,value);else next.delete(id);
          revision++;replace(next);return;
        }
      }
      if ([...blocked()].sort().join('\0') !== previous) replace(new Map(current));
    },
    write(filterId, value) { commit({type:'applyDraft', changes:[[filterId,value]]}); },
    writeMany(updates) { commit({type:'applyDraft', changes:updates}); },

    toURL(explicitDeclarations = declarations) {
      return filterSearch(current, explicitDeclarations);
    },
    fromURL(search, declarations) {
      for (const declaration of declarations) byId.set(declaration.id, declaration);
      const next = new Map(parseFilterSearch(search, declarations));
      for (const declaration of declarations) {
        if (next.has(declaration.id) || !(declaration.type === 'timeRange' && (declaration.display === 'period' || declaration.required)) && !(declaration.type === 'timePoint' && (declaration.min !== undefined || declaration.disableFuture !== false) && declaration.required)) continue;
        const fallback = current.get(declaration.id) ?? initialFilterValues([declaration]).get(declaration.id);
        if (fallback) next.set(declaration.id, fallback);
      }
      for (const id of dimensionOptions.keys()) {
        if (accepted(id, next.get(id))) continue;
        const declaration = byId.get(id);
        const fallback = current.get(id) ?? (declaration ? initialFilterValues([declaration]).get(id) : undefined);
        if (fallback) next.set(id, fallback);
      }
      commit({type:'restore', values:next});
    }

  };
}

/** 兑现"subscribe/write 永不 throw":单个订阅方的异常不得中断写入与其余订阅方的通知 */
function notify(run: (values: FilterValues) => void, values: FilterValues): void {
  try {
    run(values);
  } catch (cause) {
    console.error('筛选状态订阅方回调抛出异常(已隔离):', cause);
  }
}

/** 空值集合等同不筛选,归一为清除,保持 URL 与状态干净 */
function normalize(value: FilterValue | null, declaration?: FilterDeclaration, now=new Date()): FilterValue | null | undefined {
  if (value && !validShape(value)) return undefined;
  if(declaration?.type==='numberRange'&&value?.type==='numberRange'&&numberRangeIssue(declaration,value))return undefined;
  if(declaration?.type==='dimension' && dimensionSelectionIssue(declaration,value?.type==='dimension'?value.values:[]))return undefined;
  if(declaration?.type==='timeRange'&&declaration.display==='modes'){if(value?.type!=='timeRange'||modeRangeIssue(declaration,value)||timeFilterBoundaryError(declaration,value,now))return undefined;return value;}
  if (declaration?.type === 'timeRange' && declaration.display === 'period') {
    if (value?.type !== 'timeRange' || !isPeriodSelection(value.selection)) return undefined;
    if (timeFilterBoundaryError(declaration, value,now)) return undefined;
    try {
      const resolved = resolvePeriodSelection(value.selection,now,declaration.precision === 'month' ? 'month' : 'date');
      if (value.selection.mode !== 'last12Months' && (resolved.from !== value.from || resolved.to !== value.to)) return undefined;
      return {type:'timeRange',...resolved};
    } catch { return undefined; }
  }
  if (declaration?.type === 'timePoint') {
    if (!value) return declaration.required ? undefined : null;
    if (value.type !== 'timePoint' || value.granularity !== declaration.granularity) return undefined;
    if (validateTimePointValue(value.value, declaration.granularity, declaration.min, declaration.disableFuture !== false,now)) return undefined;
  }
  if (declaration?.type === 'timeRange') {
    if (!value) return declaration.required ? undefined : null;
    if (value.type !== 'timeRange' || validateCalendarTimeRange(value, declaration.precision).length || timeFilterBoundaryError(declaration, value,now)) return undefined;
  }
  if (value?.type === 'dimension' && declaration?.type === 'dimension') {
    if(declaration.hierarchy) {
      const level=value.level ?? declaration.defaultLevel ?? declaration.hierarchy[0]?.id;
      if(!declaration.hierarchy.some(item=>item.id===level))return undefined;
      return {...value,level,dimension:dimensionOfLevel(declaration,level)};
    }
    if(value.level!==undefined)return undefined;
  }
  if (value && value.type === 'dimension' && value.values.length === 0) return declaration?.type==='dimension'&&declaration.treeSelection?value:null;
  if (value?.type === 'timeRange' && validateCalendarTimeRange(value).length > 0) {
    return undefined;
  }
  if (value?.type === 'timePoint') {
    return validateTimePointValue(value.value, value.granularity) ? undefined : value;
  }
  if (value?.type === 'search') return value.query.trim() === '' ? null : value;
  if (value?.type === 'numberRange') {
    if (value.from === undefined && value.to === undefined) return null;
    if (
      value.from !== undefined &&
      value.to !== undefined &&
      (value.from > value.to || !Number.isFinite(value.from) || !Number.isFinite(value.to))
    ) {
      return undefined;
    }
    if (value.from !== undefined && !Number.isFinite(value.from)) return undefined;
    if (value.to !== undefined && !Number.isFinite(value.to)) return undefined;
  }
  return value;
}

function sameValue(a: FilterValue | undefined, b: FilterValue | null): boolean {
  if (!a || !b) return !a && !b;
  if (a.type !== b.type) return false;
  if (a.type === 'dimension' && b.type === 'dimension') {
    return (
      a.dimension === b.dimension &&
      a.level === b.level &&
      a.values.length === b.values.length &&
      a.values.every((v, i) => v === b.values[i])
    );
  }
  if (a.type === 'timeRange' && b.type === 'timeRange') {
    return a.from === b.from && a.to === b.to && JSON.stringify(a.selection) === JSON.stringify(b.selection) && a.mode===b.mode;
  }
  if (a.type === 'timePoint' && b.type === 'timePoint') {
    return a.granularity === b.granularity && a.value === b.value;
  }
  if (a.type === 'boolean' && b.type === 'boolean') return a.value === b.value;
  if (a.type === 'search' && b.type === 'search') return a.query === b.query;
  if (a.type === 'numberRange' && b.type === 'numberRange') {
    return a.from === b.from && a.to === b.to;
  }
  return false;
}

function stripQuestionMark(search: string): string {
  return search.startsWith('?') ? search.slice(1) : search;
}

/** 类型只来自接收页面声明，不从字符串前缀或参数内容猜测。 */
export function parseFilterSearch(search: string, declarations: readonly FilterDeclaration[],now=new Date()): FilterValues {
  const query = new URLSearchParams(stripQuestionMark(search));
  const result = new Map<string, FilterValue>();
  for (const declaration of declarations) {
    const keys = filterURLKeys(declaration);
    const read = (part: string) => keys[part] ? query.get(keys[part]!) : null;
    let value: FilterValue | null | undefined;
    if (declaration.type === 'dimension') {
      const values = query.getAll(keys.value!).filter(v => v !== '');
      if (!values.length && !(declaration.hierarchy && read('level'))) continue;
      const level = read('level') ?? declaration.defaultLevel ?? declaration.hierarchy?.[0]?.id;
      if (level && declaration.hierarchy && !declaration.hierarchy.some(l => l.id === level)) continue;
      value = { type: 'dimension', values, dimension: dimensionOfLevel(declaration, level), ...(level ? { level } : {}) };
    } else if (declaration.type === 'timeRange') {
      if(declaration.display==='modes'){const mode=query.get(`${declaration.id}.mode`);const from=read('from'),to=read('to');if(!mode&&!from&&!to)continue;if(!mode||!from||!to||query.getAll(`${declaration.id}.mode`).length!==1||query.getAll(keys.from!).length!==1||query.getAll(keys.to!).length!==1||modeRangeIssue(declaration,{mode:mode as import('@metriccanvas/page/internal').TimeMode,from,to}))throw new Error('模式URL须为合法完整mode/from/to');result.set(declaration.id,{type:'timeRange',mode:mode as import('@metriccanvas/page/internal').TimeMode,from,to});continue;}
      if (declaration.display === 'period') {
        const raw = read('value'); if (!raw) continue;
        const split = raw.indexOf(':');
        const selection = split < 0 ? {mode:raw} : {mode:raw.slice(0,split),value:raw.slice(split+1)};
        if (!isPeriodSelection(selection)) continue;
        if (selection.mode !== 'last12Months' && selection.value === undefined) continue;
        try {
          const value = {type:'timeRange' as const,...resolvePeriodSelection(selection,now,declaration.precision === 'month' ? 'month' : 'date')};
          if (!timeFilterBoundaryError(declaration, value,now)) result.set(declaration.id,value);
        } catch {}
        continue;
      }
      const from = read('from'), to = read('to');
      if (!from || !to || validateCalendarTimeRange({from,to}, declaration.precision).length) continue;
      value = {type:'timeRange', from, to};
    } else if (declaration.type === 'numberRange') {
      const fromText = read('from'), toText = read('to');
      value = {type:'numberRange', ...(fromText?.trim() ? {from:Number(fromText)} : {}), ...(toText?.trim() ? {to:Number(toText)} : {})};
    } else if (declaration.type === 'timePoint') {
      const raw = read('value');
      if (!raw || validateTimePointValue(raw, declaration.granularity, declaration.min, declaration.disableFuture !== false,now)) continue;
      value = {type:'timePoint', granularity:declaration.granularity, value:raw};
    } else if (declaration.type === 'boolean') {
      const raw = read('value');
      if (raw !== 'true' && raw !== 'false') continue;
      // false 明确覆盖默认 true，仍保留在 URL 中以便恢复。
      value = {type:'boolean', value:raw === 'true'};
    } else {
      const raw = read('value');
      if (!raw?.trim()) continue;
      value = {type:'search', query:raw};
    }
    const valid = normalize(value, declaration);
    if (valid) result.set(declaration.id, valid);
  }
  return result;
}

export function filterSearch(values: FilterValues, declarations: readonly FilterDeclaration[] = []): string {
  const query = new URLSearchParams();
  for (const [id, value] of values) {
    const declaration = declarations.find(d => d.id === id);
    const keys = declaration ? filterURLKeys(declaration) : {
      value:id, from:`${id}.from`, to:`${id}.to`, level:`${id}.level`
    };
    const put = (part: string, item: string | number | boolean | undefined) => {
      if (item !== undefined && keys[part]) query.append(keys[part]!, String(item));
    };
    if (value.type === 'dimension') {
      value.values.forEach(item => put('value',item));
      put('level',value.level);
    } else if(value.type==='timeRange'&&value.mode){query.set(`${id}.mode`,value.mode);query.set(keys.from!,value.from);query.set(keys.to!,value.to);
    } else if (value.type === 'timeRange' && value.selection && declaration?.type === 'timeRange' && declaration.display === 'period') {
      put('value',value.selection.mode === 'last12Months' ? 'last12Months' : `${value.selection.mode}:${value.selection.value}`);
    } else if (value.type === 'timeRange' || value.type === 'numberRange') {
      put('from',value.from); put('to',value.to);
    } else if (value.type === 'search') put('value',value.query);
    else put('value',value.value);
  }
  return query.toString();
}

function matchesDeclaration(value: FilterValue, declaration: FilterDeclaration): boolean {
  if (value.type !== declaration.type) return false;
  if (value.type === 'dimension' && declaration.type === 'dimension') {
    if (!Array.isArray(value.values) || !value.values.every(item => typeof item === 'string')) return false;
    if (declaration.hierarchy) {
      const level = declaration.hierarchy.find(item => item.id === value.level);
      return !!level && level.dimension === value.dimension;
    }
    return value.dimension === declaration.dimension && value.level === undefined;
  }
  if (value.type === 'timePoint' && declaration.type === 'timePoint') return value.granularity === declaration.granularity;
  if (value.type === 'boolean') return typeof value.value === 'boolean';
  if (value.type === 'search') return typeof value.query === 'string';
  if (value.type === 'numberRange') return (value.from === undefined || typeof value.from === 'number') && (value.to === undefined || typeof value.to === 'number');
  return true;
}

/** Internal gate seam; custom legacy FilterState implementations remain valid. */
export function filterBlockedIds(state?: FilterState): ReadonlySet<string> {
  return (state as Partial<CoordinatedFilterState> | undefined)?.blocked?.() ?? new Set();
}
function validShape(value: FilterValue): boolean {
  switch(value.type) {
    case 'dimension': return typeof value.dimension==='string' && Array.isArray(value.values) && value.values.every(item=>typeof item==='string') && (value.level===undefined || typeof value.level==='string');
    case 'timeRange': return typeof value.from==='string' && typeof value.to==='string' && (value.selection===undefined || isPeriodSelection(value.selection));
    case 'timePoint': return typeof value.value==='string' && ['date','month'].includes(value.granularity);
    case 'boolean': return typeof value.value==='boolean';
    case 'search': return typeof value.query==='string';
    case 'numberRange': return (value.from===undefined || typeof value.from==='number') && (value.to===undefined || typeof value.to==='number');
    default: return false;
  }
}
