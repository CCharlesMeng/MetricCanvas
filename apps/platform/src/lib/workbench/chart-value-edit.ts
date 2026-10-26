import { valueFormatPresets } from '@metriccanvas/page/internal';
import type { PropertyControl } from './property-edit';

type Scope = 'main' | 'series' | 'tooltip' | 'summary';
type Key = 'source' | 'binding' | 'value' | 'format' | 'unit' | 'currency';
export type ChartValueTarget =
  | { kind: 'chart-value'; scope: Scope; index: number; key: Key }
  | { kind: 'chart-empty' }
  | { kind: 'chart-series-add' };
const chartTypes = new Set(['barChart', 'lineChart', 'pieChart', 'mapChart', 'gauge']);
const object = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;

interface Position { scope: Scope; index: number; label: string; target: Record<string, unknown>; fieldKey: 'field' | 'valueField' }
function positions(type: string, props: Record<string, unknown>): Position[] {
  if (!chartTypes.has(type)) return [];
  const result: Position[] = [];
  if (type === 'barChart' || type === 'lineChart') append('series', props.series, '系列');
  else result.push({ scope: 'main', index: 0, label: '数值', target: props, fieldKey: 'valueField' });
  if (type === 'mapChart') {
    append('tooltip', props.tooltipFields, '提示项');
    append('summary', object(props.pinnedSummary)?.fields, '地域摘要项');
  }
  return result;
  function append(scope: Scope, entries: unknown, label: string): void {
    if (!Array.isArray(entries)) return;
    entries.forEach((entry, index) => {
      const target = object(entry);
      if (target) result.push({ scope, index, label: `${label} ${index + 1}`, target, fieldKey: 'field' });
    });
  }
}

export function chartValueControls(type: string, props: Record<string, unknown>): PropertyControl[] {
  if (!chartTypes.has(type)) return [];
  const controls: PropertyControl[] = [{ id: 'chart-empty', label: '无数据时显示常量', kind: 'boolean', target: { kind: 'chart-empty' }, value: props.emptyBehavior === 'showConstants' }];
  for (const position of positions(type, props)) controls.push(...positionControls(position));
  if (type === 'barChart' || type === 'lineChart') controls.push({
    id: 'chart-series-add', label: '增加系列', kind: 'choice', choices: ['constant'],
    target: { kind: 'chart-series-add' }, value: undefined
  });
  return controls;
}

function positionControls(position: Position): PropertyControl[] {
  const {scope, index, label, target, fieldKey} = position;
  const constant = Object.hasOwn(target, 'value');
  const control = (key: Key, suffix: string, kind: PropertyControl['kind'], value: unknown, choices?: string[]): PropertyControl => ({
    id: `chart-${scope}-${index}-${key}`, label: `${label}${suffix}`, kind, value, choices,
    target: { kind: 'chart-value', scope, index, key }
  });
  const result = [control('source', '来源', 'choice', constant ? 'constant' : 'field', ['field', 'constant'])];
  if (!constant) {
    const binding = target[fieldKey];
    result.push(control('binding', '字段', typeof binding === 'string' ? 'text' : 'json', binding));
    return result;
  }
  result.push(control('value', '固定值', 'json', target.value));
  result.push(control('format', '格式', 'choice', target.format, [...valueFormatPresets]));
  result.push(control('unit', '单位', 'text', target.unit));
  result.push(control('currency', '币种', 'choice', target.currency, ['CNY', 'USD']));
  return result;
}

/** Mutates only the caller's cloned document; whole-document projection commits atomically. */
export function applyChartValueEdit(document: Record<string, unknown>, component: Record<string, unknown>, edit: ChartValueTarget & {value: unknown}): string | undefined {
  const props = object(component.props), type = String(component.type);
  if (!props || !chartTypes.has(type)) return '当前组件不支持图表取值编辑';
  if (edit.kind === 'chart-empty') {
    props.emptyBehavior = edit.value === true ? 'showConstants' : 'default';
    return;
  }
  if (edit.kind === 'chart-series-add') return appendConstantSeries(document, component, type, props, edit.value);
  const position = positions(type, props).find(p => p.scope === edit.scope && p.index === edit.index);
  if (!position) return '取值位置已变化，未修改图表';
  if (edit.key === 'source') return changeSource(document, component, position, edit.value);
  const key = edit.key === 'binding' ? position.fieldKey : edit.key;
  if (edit.value === undefined) delete position.target[key];
  else position.target[key] = structuredClone(edit.value);
}

function appendConstantSeries(document: Record<string, unknown>, component: Record<string, unknown>, type: string, props: Record<string, unknown>, value: unknown): string | undefined {
  if (!['barChart', 'lineChart'].includes(type) || value !== 'constant' || !Array.isArray(props.series)) return '无法增加常量系列';
  const series: Record<string, unknown> = {value: 0, label: `常量 ${props.series.length + 1}`};
  const explicit = props.series.some(item => object(item)?.axis !== undefined);
  if (explicit) {
    const first = props.series.map(object).find(item => item?.axis === 'primary');
    series.axis = 'primary'; series.kind = 'bar';
    if (first) {
      const fields = mainFields(document, component);
      const binding = first.field;
      const definition = object(fields[typeof binding === 'string' ? binding : String(object(binding)?.field)]);
      copyPresentation(series, definition ?? first, object(binding));
    }
  }
  props.series.push(series);
}

function changeSource(document: Record<string, unknown>, component: Record<string, unknown>, position: Position, source: unknown): string | undefined {
  if (source !== 'field' && source !== 'constant') return '请选择字段或常量';
  const {target, fieldKey} = position;
  if (source === 'constant' && Object.hasOwn(target, 'value')) return;
  if (source === 'field' && target[fieldKey] !== undefined) return;
  const fields = mainFields(document, component);
  if (source === 'field') {
    const candidate = Object.entries(fields).find(([, definition]) => eligibleField(definition, position.scope));
    if (!candidate) return '没有可用的数值字段，请先绑定页面数据源';
    delete target.value;
    for (const key of ['format', 'currency', 'missingText', 'unit']) delete target[key];
    target[fieldKey] = candidate[0];
    return;
  }
  const binding = target[fieldKey];
  const definition = object(fields[typeof binding === 'string' ? binding : String(object(binding)?.field)]);
  delete target[fieldKey]; target.value = 0;
  copyPresentation(target, definition, object(binding));
}

function mainFields(document: Record<string, unknown>, component: Record<string, unknown>): Record<string, unknown> {
  const sourceId = String(object(component.data)?.main);
  return object(object(object(document.dataSources)?.[sourceId])?.fields) ?? {};
}

function copyPresentation(target: Record<string, unknown>, definition?: Record<string, unknown>, binding?: Record<string, unknown>): void {
  for (const key of ['unit', 'currency']) if (definition?.[key] !== undefined) target[key] = definition[key];
  const format = binding?.format ?? definition?.defaultFormat;
  if (format !== undefined) target.format = format;
}

function eligibleField(value: unknown, scope: Scope): boolean {
  const definition = object(value);
  if (!definition) return false;
  if (scope === 'tooltip' || scope === 'summary') return definition.role !== 'detail';
  return definition.role === 'measure';
}
