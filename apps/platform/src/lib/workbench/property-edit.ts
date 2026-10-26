import {presentationLabel} from './condition-editor';
import { chartValueControls, applyChartValueEdit, type ChartValueTarget } from './chart-value-edit';
import { pinnedTableControl, editPinnedTable } from './table-pinned-edit';
import {applyPresentationOperation,presentationTarget,presentationTargets,type PresentationTarget} from '@metriccanvas/page/internal';
import { versionPolicy, parsePage } from '@metriccanvas/page';
import { projectCanvasDraft, type CanvasAuthoringDraft, type ComponentLocator, type DocumentEditResult } from './document-edit';
type PropertyName = 'filterIds' | 'subtitle' | 'badge' | 'tags' | 'showTrendArrows' | 'horizontal' | 'stacked' | 'rounded' | 'showSegmentLabels' | 'showStackTotalLabels' | 'smooth' | 'areaGradient' | 'showPointLabels' | 'hideYAxis' | 'ring' | 'labelLine' | 'fit';
export type PropertyTarget = ChartValueTarget
  | {kind:'table-pinned'}
  | {kind:'presentation';target:PresentationTarget;field:'visibleWhen'|'enabledWhen'}
  | { kind: 'property'; name: PropertyName }
  | { kind: 'metric-before'; field: 'text' | 'gap' }
  | { kind: 'report-export'; format: 'pdf' | 'png'; field: 'enabled' | 'label' | 'filename' | 'scale' }
  | { kind: 'series-label'; index: number }
  | { kind: 'metric-row'; rows: 'rows' | 'secondaryRows'; index: number; field: 'label' | 'context' | 'unit' }
  | { kind: 'table-column'; indices: number[]; field: 'title' | 'width' | 'fixed' | 'align' };
export type PropertyEdit = PropertyTarget & { value: unknown };
export interface PropertyControl { id: string; label: string; kind: 'text' | 'tags' | 'boolean' | 'number' | 'choice' | 'json'; target: PropertyTarget; value: unknown; choices?: string[] }
const names: Record<string, readonly PropertyName[]> = {
  reportHeader: ['subtitle', 'badge', 'tags', 'filterIds'], metricCard: ['showTrendArrows'],
  barChart: ['horizontal', 'stacked', 'rounded', 'showSegmentLabels', 'showStackTotalLabels'],
  lineChart: ['smooth', 'areaGradient', 'showPointLabels', 'hideYAxis'], pieChart: ['ring', 'labelLine'], table: ['subtitle', 'fit']
};
const labels: Record<PropertyName, string> = { filterIds: '页头日期筛选器 ID（按显示顺序，每行一个）', subtitle: '副标题', badge: '徽标', tags: '标签（每行一个）', showTrendArrows: '趋势箭头', horizontal: '横向显示', stacked: '堆叠', rounded: '圆角', showSegmentLabels: '分段标签', showStackTotalLabels: '堆叠合计标签', smooth: '平滑曲线', areaGradient: '面积渐变', showPointLabels: '数据点标签', hideYAxis: '隐藏纵轴', ring: '环形内径（如 50%）', labelLine: '引导线', fit: '表格适配' };
const object = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

function exportButtons(props: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(props.exportButtons)) return props.exportButtons.map(value => ({...object(value)}));
  return [
    ...(object(props.pdfExport) ? [{format:'pdf',label:'下载 PDF',...object(props.pdfExport)}] : []),
    ...(object(props.pngExport) ? [{format:'png',...object(props.pngExport)}] : [])
  ];
}

function componentOf(document: Record<string, unknown>, locator: ComponentLocator) {
  const section = (Array.isArray(document.sections) ? document.sections : []).map(object).find((value) => value?.id === locator.sectionId);
  return (Array.isArray(section?.components) ? section.components : []).map(object).find((value) => value?.id === locator.componentId) ?? null;
}
export function propertyControls(draft: CanvasAuthoringDraft | null, locator: ComponentLocator | null): PropertyControl[] {
  if (!draft || !locator) return [];
  const component = componentOf(draft.canvasDocument, locator), props = object(component?.props), type = String(component?.type);
  if (!props) return [];
  const controls: PropertyControl[] = (names[type] ?? []).map((name) => ({ id: name, label: labels[name], target: { kind: 'property', name }, value: props[name], kind: ['tags', 'filterIds'].includes(name) ? 'tags' : name === 'fit' ? 'choice' : ['subtitle', 'badge', 'ring'].includes(name) ? 'text' : 'boolean', ...(name === 'fit' ? { choices: ['content', 'container'] } : {}) }));
  controls.push(...chartValueControls(type, props));
  addMetricBeforeControls(draft, locator);
  if (isReportHeader(type, draft)) addExportControls(props);
  if (type === 'barChart' || type === 'lineChart') (Array.isArray(props.series) ? props.series : []).forEach((series, index) => controls.push({ id: `series-${index}`, label: `系列 ${index + 1} 标签`, kind: 'text', target: { kind: 'series-label', index }, value: object(series)?.label }));
  if (type === 'metricCard') for (const rows of ['rows', 'secondaryRows'] as const) (Array.isArray(props[rows]) ? props[rows] : []).forEach((row, index) => {
    for (const field of ['label', 'context', 'unit'] as const) controls.push({ id: `${rows}-${index}-${field}`, label: `${rows === 'rows' ? '主' : '次'}指标 ${index + 1} ${{ label: '行说明', context: '上下文', unit: '单位' }[field]}`, kind: 'text', target: { kind: 'metric-row', rows, index, field }, value: object(row)?.[field] });
  });
  if (type === 'table') {
    controls.push(pinnedTableControl(component));
    const visit = (columns: unknown, prefix: number[] = []) => {
      if (!Array.isArray(columns)) return;
      columns.forEach((column, index) => {
        const value = object(column), indices = [...prefix, index];
        if (value?.kind === 'group') { visit(value.children, indices); return; }
        if (!value) return;
        for (const field of ['title', 'width', 'fixed', 'align'] as const) controls.push({ id: `column-${indices.join('-')}-${field}`, label: `列 ${indices.map((i) => i + 1).join('.')} ${{ title: '标题', width: '宽度', fixed: '固定', align: '对齐' }[field]}`, kind: field === 'width' ? 'number' : field === 'title' ? 'text' : 'choice', target: { kind: 'table-column', indices, field }, value: value[field], ...(['fixed', 'align'].includes(field) ? { choices: ['left', 'right'] } : {}) });
      });
    }; visit(props.columns);
  }
  function isReportHeader(type: string, draft: CanvasAuthoringDraft): boolean {
    return type === 'reportHeader' && (draft.canvasDocument.layout ?? draft.canvasDocument.layoutForm ?? 'report') === 'report';
  }
  function addExportControls(props: Record<string, unknown>): void {

    const buttons = exportButtons(props);
    for (const format of ['pdf', 'png'] as const) {
      const button = buttons.find(value => value.format === format), label = format === 'pdf' ? 'PDF' : 'PNG';
      const target = { kind: 'report-export' as const, format };
      controls.push({ id: `export-${format}-enabled`, label: `导出 ${label}`, kind: 'boolean', target: { ...target, field: 'enabled' }, value: !!button });
      if (button) controls.push(
        { id: `export-${format}-label`, label: `${label} 按钮名称`, kind: 'text', target: { ...target, field: 'label' }, value: button.label },
        { id: `export-${format}-scale`, label: `${label} 清晰度（倍）`, kind: 'choice', choices: format === 'pdf' ? ['2', '3', '4'] : ['3', '4'], target: { ...target, field: 'scale' }, value: button.scale ?? (format === 'pdf' ? 2 : 3) },
        { id: `export-${format}-filename`, label: `${label} 文件名`, kind: 'text', target: { ...target, field: 'filename' }, value: button.filename }
      );
    }

  }
  function addMetricBeforeControls(draft: CanvasAuthoringDraft, locator: ComponentLocator): void {
    if (type === 'metricCard' && (draft.canvasDocument.layout ?? draft.canvasDocument.layoutForm) === 'dashboard') {
      const sections = Array.isArray(draft.canvasDocument.sections) ? draft.canvasDocument.sections : [];
      const section = sections.map(object).find(value => value?.id === locator.sectionId);
      if (section && ['plain', 'card'].includes(String(section.container)) && section.columnTracks === undefined) {
        const before = object(object(component?.layout)?.before);
        controls.push({ id: 'metric-before-text', label: '前置连接文字', kind: 'text', target: { kind: 'metric-before', field: 'text' }, value: before?.text });
        if (before) controls.push({ id: 'metric-before-gap', label: '连接文字两侧间距（px）', kind: 'choice', choices: ['4', '8', '12', '16', '24'], target: { kind: 'metric-before', field: 'gap' }, value: before.gap ?? 8 });
      }
    }
  }
  return [...controls, ...presentationControls(draft).filter(control => control.target.kind === 'presentation' && control.target.target.id === locator.componentId)];
}
type ResolvedProperty = { target: Record<string, unknown>; key: string };
const invalidProperty = (): DocumentEditResult => ({ ok: false, message: '属性不在白名单内或目标已变化，未修改页面。' });

/** Closed targets only; chart value changes use their own atomic projection. */
export function editProperty(draft: CanvasAuthoringDraft, locator: ComponentLocator, edit: PropertyEdit): DocumentEditResult {
  if (isChartValueEdit(edit)) return editChartProperty(draft, locator, edit);
  return editExistingProperty(draft, locator, edit);
}

function isChartValueEdit(edit: PropertyEdit): edit is ChartValueTarget & {value: unknown} {
  return edit.kind === 'chart-value' || edit.kind === 'chart-empty' || edit.kind === 'chart-series-add';
}

function editChartProperty(draft: CanvasAuthoringDraft, locator: ComponentLocator, edit: ChartValueTarget & {value: unknown}): DocumentEditResult {
  const next = JSON.parse(JSON.stringify(draft.canvasDocument)) as Record<string, unknown>;
  const component = componentOf(next, locator);
  if (!component) return invalidProperty();
  const parsed = parsePage(draft.pageDocument);
  if (!parsed.ok) return {ok: false, message: '当前页面数据契约不可用，未修改取值来源'};
  const message = applyChartValueEdit({dataSources: parsed.page.dataSources}, component, edit);
  if (message) return {ok: false, message};
  next.schemaVersion = versionPolicy.current;
  return projectCanvasDraft(next);
}

function editExistingProperty(draft: CanvasAuthoringDraft, locator: ComponentLocator, edit: PropertyEdit): DocumentEditResult {
  if (edit.kind === 'presentation') {
    const result = applyPresentationOperation(draft.canvasDocument, { type: 'set_presentation_condition', target: edit.target, field: edit.field, condition: (edit.value ?? null) as import('@metriccanvas/page/internal').Condition | null });
    return result.ok && result.document ? projectCanvasDraft(result.document) : { ok: false, message: result.errors.map(error => error.message).join('；') };
  }

  const next = JSON.parse(JSON.stringify(draft.canvasDocument)) as Record<string, unknown>;
  const component = componentOf(next, locator), props = object(component?.props), type = String(component?.type);
  if (!props || !names[type]) return invalidProperty();
  const special = editSpecialProperty(next, component, props, type, edit);
  if (special) return special;

  const resolved = propertyTarget(type, props, edit);
  if (!resolved) return invalidProperty();
  const { target, key } = resolved;
  if (edit.kind === 'property' && edit.name === 'filterIds') {
    next.schemaVersion = versionPolicy.current;
    if (Array.isArray(edit.value) && edit.value.length === 0) edit = { ...edit, value: undefined };
  }
  if (edit.value === undefined) delete target[key];
  else target[key] = structuredClone(edit.value);
  return projectCanvasDraft(next);
}

function propertyTarget(type: string, props: Record<string, unknown>, edit: PropertyEdit): ResolvedProperty | null {
  switch (edit.kind) {
    case 'property': return names[type].includes(edit.name) ? { target: props, key: edit.name } : null;
    case 'series-label': {
      if (!['barChart', 'lineChart'].includes(type) || !Number.isInteger(edit.index) || edit.index < 0) return null;
      const target = object(Array.isArray(props.series) ? props.series[edit.index] : null);
      return target ? { target, key: 'label' } : null;
    }
    case 'metric-row': return metricRowTarget(type, props, edit);
    case 'table-column': return columnTarget(type, props, edit);
    default: return null;
  }
}

function metricRowTarget(type: string, props: Record<string, unknown>, edit: Extract<PropertyEdit, { kind: 'metric-row' }>): ResolvedProperty | null {
  if (type !== 'metricCard' || !['rows', 'secondaryRows'].includes(edit.rows) || !['label', 'context', 'unit'].includes(edit.field) || !Number.isInteger(edit.index) || edit.index < 0) return null;
  const rows = props[edit.rows];
  const target = object(Array.isArray(rows) ? rows[edit.index] : null);
  return target ? { target, key: edit.field } : null;
}

function columnTarget(type: string, props: Record<string, unknown>, edit: Extract<PropertyEdit, { kind: 'table-column' }>): ResolvedProperty | null {
  if (type !== 'table' || !['title', 'width', 'fixed', 'align'].includes(edit.field) || !Array.isArray(edit.indices) || !edit.indices.length) return null;
  let columns = props.columns, target: Record<string, unknown> | null = null;
  for (const [offset, index] of edit.indices.entries()) {
    if (!Number.isInteger(index) || index < 0 || !Array.isArray(columns)) return null;
    target = object(columns[index]);
    if (offset < edit.indices.length - 1 && target?.kind !== 'group') return null;
    columns = target?.children;
  }
  return !target || target.kind === 'group' ? null : { target, key: edit.field };
}

function editReportExport(document: Record<string, unknown>, type: string, props: Record<string, unknown>, edit: Extract<PropertyEdit, { kind: 'report-export' }>): DocumentEditResult {
  if (type !== 'reportHeader' || !['pdf', 'png'].includes(edit.format) || !['enabled', 'label', 'filename', 'scale'].includes(edit.field)) return invalidProperty();
  document.schemaVersion = versionPolicy.current;
  const buttons = exportButtons(props);
  if (!changeExportButton(buttons, edit)) return invalidProperty();
  delete props.pdfExport;
  delete props.pngExport;
  if (buttons.length) props.exportButtons = buttons;
  else delete props.exportButtons;
  return projectCanvasDraft(document);
}

function changeExportButton(buttons: Record<string, unknown>[], edit: Extract<PropertyEdit, { kind: 'report-export' }>): boolean {
  const button = buttons.find(value => value.format === edit.format);
  if (edit.field === 'enabled') {
    if (edit.value !== undefined && typeof edit.value !== 'boolean') return false;
    if (edit.value && !button) buttons.push({ format: edit.format });
    else if (!edit.value && button) buttons.splice(buttons.indexOf(button), 1);
  } else {
    if (!button) return false;
    const allowed = edit.format === 'pdf' ? [2, 3, 4, '2', '3', '4'] : [3, 4, '3', '4'];
    const value = edit.field === 'scale' ? (allowed.includes(edit.value as number) ? Number(edit.value) : undefined) : edit.value;
    if (value === undefined || value === '') delete button[edit.field];
    else button[edit.field] = structuredClone(value);
  }
  return true;
}



export function presentationControls(draft:CanvasAuthoringDraft|null):PropertyControl[]{
 if(!draft)return [];
 return presentationTargets(draft.canvasDocument).flatMap(({target,enabled})=>{
  const node=presentationTarget(draft.canvasDocument,target);
  const label=presentationLabel(draft.canvasDocument,target);
  return (enabled?['visibleWhen','enabledWhen'] as const:['visibleWhen'] as const).map(field=>({id:`condition-${JSON.stringify(target)}-${field}`,label:`${label} · ${field==='visibleWhen'?'显示条件':'执行条件'}`,kind:'json' as const,target:{kind:'presentation' as const,target,field},value:node?.[target.kind==='row'?'rowVisibleWhen':field]}));
 });
}
function editMetricBefore(next: Record<string, unknown>, type: string, component: Record<string, unknown> | null, edit: Extract<PropertyEdit, { kind: 'metric-before' }>): DocumentEditResult {
  if (type !== 'metricCard' || !component || !['text', 'gap'].includes(edit.field)) return invalidProperty();
  const layout = object(component.layout); if (!layout) return invalidProperty();
  const before = object(layout.before);
  if (edit.field === 'text') {
    if (edit.value !== undefined && typeof edit.value !== 'string') return invalidProperty();
    if (typeof edit.value === 'string' && edit.value.trim()) layout.before = { ...before, text: edit.value };
    else delete layout.before;
  } else {
    if (!before) return invalidProperty();
    if (edit.value === undefined || edit.value === '') delete before.gap;
    else if ([4, 8, 12, 16, 24, '4', '8', '12', '16', '24'].includes(edit.value as number)) before.gap = Number(edit.value);
    else return invalidProperty();
  }
  next.schemaVersion = versionPolicy.current;
  return projectCanvasDraft(next);
}

function editSpecialProperty(document: Record<string, unknown>, component: Record<string, unknown> | null, props: Record<string, unknown>, type: string, edit: PropertyEdit): DocumentEditResult | undefined {
  if (edit.kind === 'table-pinned') return editPinnedTable(document, component, edit.value);
  if (edit.kind === 'metric-before') return editMetricBefore(document, type, component, edit);
  if (edit.kind === 'report-export') return editReportExport(document, type, props, edit);
  return undefined;
}
