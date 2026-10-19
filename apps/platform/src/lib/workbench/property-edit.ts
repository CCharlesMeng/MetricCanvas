import { versionPolicy } from '@metriccanvas/page';
import { projectCanvasDraft, type CanvasAuthoringDraft, type ComponentLocator, type DocumentEditResult } from './document-edit';
type PropertyName = 'filterIds' | 'subtitle' | 'badge' | 'tags' | 'showTrendArrows' | 'horizontal' | 'stacked' | 'rounded' | 'showSegmentLabels' | 'showStackTotalLabels' | 'smooth' | 'areaGradient' | 'showPointLabels' | 'hideYAxis' | 'ring' | 'labelLine' | 'fit';
export type PropertyTarget =
  | { kind: 'property'; name: PropertyName }
  | { kind: 'report-export'; format: 'pdf' | 'png'; field: 'enabled' | 'label' | 'filename' | 'scale' }
  | { kind: 'series-label'; index: number }
  | { kind: 'metric-row'; rows: 'rows' | 'secondaryRows'; index: number; field: 'label' | 'context' | 'unit' }
  | { kind: 'table-column'; indices: number[]; field: 'title' | 'width' | 'fixed' | 'align' };
export type PropertyEdit = PropertyTarget & { value: unknown };
export interface PropertyControl { id: string; label: string; kind: 'text' | 'tags' | 'boolean' | 'number' | 'choice'; target: PropertyTarget; value: unknown; choices?: string[] }
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
  if (!props || !names[type]) return [];
  const controls: PropertyControl[] = names[type].map((name) => ({ id: name, label: labels[name], target: { kind: 'property', name }, value: props[name], kind: ['tags','filterIds'].includes(name) ? 'tags' : name === 'fit' ? 'choice' : ['subtitle', 'badge', 'ring'].includes(name) ? 'text' : 'boolean', ...(name === 'fit' ? { choices: ['content', 'container'] } : {}) }));
  if (type === 'reportHeader' && (draft.canvasDocument.layout ?? draft.canvasDocument.layoutForm ?? 'report') === 'report') {
    const buttons = exportButtons(props);
    for (const format of ['pdf', 'png'] as const) {
      const button = buttons.find(value => value.format === format), label = format === 'pdf' ? 'PDF' : 'PNG';
      const target = { kind: 'report-export' as const, format };
      controls.push({id:`export-${format}-enabled`,label:`导出 ${label}`,kind:'boolean',target:{...target,field:'enabled'},value:!!button});
      if (button) controls.push(
        {id:`export-${format}-label`,label:`${label} 按钮名称`,kind:'text',target:{...target,field:'label'},value:button.label},
        {id:`export-${format}-scale`,label:`${label} 清晰度（倍）`,kind:'choice',choices:format === 'pdf' ? ['2','3','4'] : ['3','4'],target:{...target,field:'scale'},value:button.scale ?? (format === 'pdf' ? 2 : 3)},
        {id:`export-${format}-filename`,label:`${label} 文件名`,kind:'text',target:{...target,field:'filename'},value:button.filename}
      );
    }
  }
  if (type === 'barChart' || type === 'lineChart') (Array.isArray(props.series) ? props.series : []).forEach((series, index) => controls.push({ id: `series-${index}`, label: `系列 ${index + 1} 标签`, kind: 'text', target: { kind: 'series-label', index }, value: object(series)?.label }));
  if (type === 'metricCard') for (const rows of ['rows', 'secondaryRows'] as const) (Array.isArray(props[rows]) ? props[rows] : []).forEach((row, index) => {
    for (const field of ['label', 'context', 'unit'] as const) controls.push({ id: `${rows}-${index}-${field}`, label: `${rows === 'rows' ? '主' : '次'}指标 ${index + 1} ${{ label: '行说明', context: '上下文', unit: '单位' }[field]}`, kind: 'text', target: { kind: 'metric-row', rows, index, field }, value: object(row)?.[field] });
  });
  if (type === 'table') {
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
  return controls;
}
/** Closed targets only; no JSON path, binding, action, data source or component creation mutation. */
export function editProperty(draft: CanvasAuthoringDraft, locator: ComponentLocator, edit: PropertyEdit): DocumentEditResult {
  const next = JSON.parse(JSON.stringify(draft.canvasDocument)) as Record<string, unknown>, component = componentOf(next, locator), props = object(component?.props), type = String(component?.type);
  const fail = (): DocumentEditResult => ({ ok: false, message: '属性不在白名单内或目标已变化，未修改页面。' });
  if (!props || !names[type]) return fail();
  if (edit.kind === 'report-export') {
    if (type !== 'reportHeader' || !['pdf','png'].includes(edit.format) || !['enabled','label','filename','scale'].includes(edit.field)) return fail();
    next.schemaVersion = versionPolicy.current;
    const format = edit.format;
    const buttons = exportButtons(props), button = buttons.find(value => value.format === format);
    if (edit.field === 'enabled') {
      if (edit.value !== undefined && typeof edit.value !== 'boolean') return fail();
      if (edit.value && !button) buttons.push({format:edit.format});
      else if (!edit.value && button) buttons.splice(buttons.indexOf(button), 1);
    } else {
      if (!button) return fail();
      const allowed = edit.format === 'pdf' ? [2,3,4,'2','3','4'] : [3,4,'3','4'];
      const value = edit.field === 'scale' ? (allowed.includes(edit.value as number) ? Number(edit.value) : undefined) : edit.value;
      if (value === undefined || value === '') delete button[edit.field];
      else button[edit.field] = structuredClone(value);
    }
    delete props.pdfExport; delete props.pngExport;
    if (buttons.length) props.exportButtons = buttons; else delete props.exportButtons;
    return projectCanvasDraft(next);
  }
  let target: Record<string, unknown> | null = null, key: string;
  if (edit.kind === 'property') { if (!names[type].includes(edit.name)) return fail(); target = props; key = edit.name; }
  else if (edit.kind === 'series-label') {
    if (!['barChart', 'lineChart'].includes(type) || !Number.isInteger(edit.index) || edit.index < 0) return fail();
    target = object(Array.isArray(props.series) ? props.series[edit.index] : null); key = 'label';
  } else if (edit.kind === 'metric-row') {
    if (type !== 'metricCard' || !['rows', 'secondaryRows'].includes(edit.rows) || !['label', 'context', 'unit'].includes(edit.field) || !Number.isInteger(edit.index) || edit.index < 0) return fail();
    const rows = props[edit.rows];
    target = object(Array.isArray(rows) ? rows[edit.index] : null); key = edit.field;
  } else if (edit.kind === 'table-column') {
    if (type !== 'table' || !['title', 'width', 'fixed', 'align'].includes(edit.field) || !Array.isArray(edit.indices) || !edit.indices.length) return fail();
    let columns = props.columns;
    for (const [offset, index] of edit.indices.entries()) {
      if (!Number.isInteger(index) || index < 0 || !Array.isArray(columns)) return fail();
      target = object(columns[index]);
      if (offset < edit.indices.length - 1 && target?.kind !== 'group') return fail();
      columns = target?.children;
    }
    if (!target || target.kind === 'group') return fail(); key = edit.field;
  } else return fail();
  if (!target) return fail();
  if(edit.kind==='property' && edit.name==='filterIds') { next.schemaVersion=versionPolicy.current; if(Array.isArray(edit.value)&&edit.value.length===0) edit={...edit,value:undefined}; }
  if (edit.value === undefined) delete target[key]; else target[key] = structuredClone(edit.value);
  return projectCanvasDraft(next);
}
