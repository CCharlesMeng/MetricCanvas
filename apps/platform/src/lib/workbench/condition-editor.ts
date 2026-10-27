import {componentCatalog} from '@metriccanvas/page';
import {presentationTarget, type Condition, type PresentationTarget} from '@metriccanvas/page/internal';

export interface FilterConditionChoice {
  value: string;
  label: string;
  filter: string;
  part: 'values' | 'value' | 'from' | 'to' | 'mode';
  mode?: string;
  collection: boolean;
}
export interface ConditionFilter {id: string; label?: unknown; type: string; display?: string; periodModes?: string[]}

/** Basic controls only emit existing empty/nonempty tests; other conditions stay intact. */
export function filterConditionChoices(filters: readonly ConditionFilter[]): FilterConditionChoice[] {
  return filters.flatMap(filter => {
    const label = typeof filter.label === 'string' ? filter.label : filter.id;
    const parts = filter.type === 'timeRange' ? ['from', 'to'] as const
      : filter.type === 'timePoint' ? ['value'] as const : ['values'] as const;
    const choices:FilterConditionChoice[]=parts.map(part => ({value: `${filter.id}:${part}`, filter: filter.id, part,
      label: part === 'from' ? `${label} · 开始` : part === 'to' ? `${label} · 结束` : label,
      collection: part === 'values'}));
    return [...choices,...periodConditionChoices(filter,label)];
  });
}
function periodConditionChoices(filter:ConditionFilter,label:string):FilterConditionChoice[]{
  if(filter.type!=='timeRange'||filter.display!=='period')return [];
  const labels:Record<string,string>={year:'年',quarter:'季度',month:'月',last12Months:'近一年'};
  return (filter.periodModes??Object.keys(labels)).map(mode=>({value:`${filter.id}:mode:${mode}`,filter:filter.id,part:'mode',mode,collection:false,label:`${label} · 选择${labels[mode]}`}));
}

export function basicFilterCondition(choice: FilterConditionChoice, selected: boolean): Condition {
  if(choice.mode)return {filter:choice.filter,part:'mode',op:selected?'eq':'ne',value:choice.mode};
  const op = choice.collection ? (selected ? 'isNotEmpty' : 'isEmpty') : (selected ? 'isNotNull' : 'isNull');
  return {filter: choice.filter, part: choice.part, op};
}

export function basicConditionSelection(condition: Condition | undefined, choices: FilterConditionChoice[]) {
  if (!condition || !('filter' in condition)) return null;
  const choice = choices.find(item => item.filter === condition.filter && item.part === condition.part && (!item.mode || ('value' in condition&&item.mode===condition.value)));
  if (!choice) return null;
  for (const selected of [true, false]) {
    const expected=basicFilterCondition(choice, selected);
    if ('op' in expected && condition.op===expected.op) return {choice: choice.value, selected};
  }
  return null;
}

const operations: Record<string, string> = {
  eq:'等于', ne:'不等于', in:'属于', notIn:'不属于', containsAny:'包含任一', containsAll:'包含全部',
  gt:'大于', gte:'大于等于', lt:'小于', lte:'小于等于',
  isNull:'未填写', isNotNull:'已填写', isEmpty:'未选择或为空', isNotEmpty:'已选择且非空'
};

export function conditionSummary(condition: Condition, filters: readonly ConditionFilter[]): string {
  if ('all' in condition) return condition.all.map(item => `（${conditionSummary(item, filters)}）`).join(' 且 ');
  if ('any' in condition) return condition.any.map(item => `（${conditionSummary(item, filters)}）`).join(' 或 ');
  if ('not' in condition) return `不满足（${conditionSummary(condition.not, filters)}）`;
  if ('permission' in condition) return `已有权限「${condition.permission}」允许`;
  const subject = conditionSubject(condition, filters);
  if ('values' in condition) return `${subject} ${operations[condition.op]} ${condition.values.map(String).join('、')}`;
  if ('value' in condition) return `${subject} ${operations[condition.op]} ${String(condition.value)}`;
  return `${subject} ${operations[condition.op]}`;
}

function conditionSubject(condition: Extract<Condition, {op: string}>, filters: readonly ConditionFilter[]) {
  if ('fact' in condition) return `页面事实「${condition.fact}」`;
  if ('row' in condition) return `当前行「${condition.row}」`;
  const filter = filters.find(item => item.id === condition.filter);
  const label = typeof filter?.label === 'string' ? filter.label : condition.filter;
  const part = {level:'层级', values:'', value:'', from:'开始', to:'结束', mode:'期间模式'}[condition.part];
  return part ? `${label} · ${part}` : label;
}

/** Translate target labels at the workbench boundary without changing protocol identities. */
export function presentationLabel(document: unknown, target: PresentationTarget): string {
  const node = presentationTarget(document, target);
  const owner = presentationTarget(document, {kind:'component', id:target.id});
  const title = node?.title ?? node?.label ?? owner?.props?.title;
  const name = typeof title === 'string' ? title : target.id;
  const kinds = {section:'内容分区', filter:'筛选器', sectionGroup:'分区组', component:'组件', row:'表格行',
    tab:'标签页', part:'正文片段', action:'交互', link:'链接', toolbar:'表格工具', column:'表格列', tableColumn:'表格列'};
  if (target.kind === 'component') return `${name} · ${componentCatalog.find(item => item.type === node?.type)?.label ?? '组件'}`;
  if (target.kind === 'action') return `${name} · ${{navigate:'页面跳转', openDetail:'打开明细', writeFilter:'筛选联动'}[target.action]}`;
  if (target.kind === 'tab') return `${name} · 标签页 ${node?.label ?? target.tabId}`;
  if (target.kind === 'column') return `${name} · 列 ${target.field}`;
  if (target.kind === 'toolbar') return `${name} · ${target.slot === 'search' ? '搜索' : '导出'}`;
  return `${name} · ${kinds[target.kind]}`;
}
