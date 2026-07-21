import type { Component, Page } from '@metriccanvas/page';

export interface ComponentLocator {
  sectionId: string;
  componentId: string;
}

export interface EditableComponent {
  locator: ComponentLocator;
  type: Component['type'];
  typeLabel: string;
  title: string;
  detail: string;
  detailLabel: string | null;
  span: number;
  position: number;
  count: number;
}

export interface ComponentEdit {
  title?: string;
  detail?: string;
  span?: number;
}

export interface PageEditorHistory {
  past: Page[];
  current: Page;
  future: Page[];
}

export function createPageEditorHistory(document: Page): PageEditorHistory {
  return { past: [], current: clonePage(document), future: [] };
}

export function commitPageEdit(
  history: PageEditorHistory,
  document: Page
): PageEditorHistory {
  if (JSON.stringify(history.current) === JSON.stringify(document)) return history;
  return {
    past: [...history.past.slice(-99), history.current],
    current: clonePage(document),
    future: []
  };
}

export function undoPageEdit(history: PageEditorHistory): PageEditorHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    current: clonePage(previous),
    future: [history.current, ...history.future]
  };
}

export function redoPageEdit(history: PageEditorHistory): PageEditorHistory {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, history.current],
    current: clonePage(next),
    future: history.future.slice(1)
  };
}

export function listEditableComponents(document: Page): EditableComponent[] {
  return document.sections.flatMap((section) =>
    section.components.map((component, index) => ({
      locator: { sectionId: section.id, componentId: component.id },
      type: component.type,
      typeLabel: componentTypeLabel(component.type),
      title: componentTitle(component),
      detail: componentDetail(component),
      detailLabel: componentDetailLabel(component),
      span: component.layout.span,
      position: index,
      count: section.components.length
    }))
  );
}

export function editComponent(
  document: Page,
  locator: ComponentLocator,
  edit: ComponentEdit
): Page {
  const next = clonePage(document);
  const component = locateComponent(next, locator);
  if (!component) return document;

  if (edit.span !== undefined) {
    component.layout.span = Math.min(12, Math.max(1, Math.round(edit.span)));
  }
  if (edit.title !== undefined) setComponentTitle(component, edit.title);
  if (edit.detail !== undefined) setComponentDetail(component, edit.detail);
  return next;
}

export function moveComponent(
  document: Page,
  locator: ComponentLocator,
  direction: -1 | 1
): Page {
  const next = clonePage(document);
  const section = next.sections.find((candidate) => candidate.id === locator.sectionId);
  if (!section) return document;
  const index = section.components.findIndex(
    (component) => component.id === locator.componentId
  );
  const target = index + direction;
  if (index < 0 || target < 0 || target >= section.components.length) return document;
  const [component] = section.components.splice(index, 1);
  if (!component) return document;
  section.components.splice(target, 0, component);
  return next;
}

function locateComponent(document: Page, locator: ComponentLocator): Component | null {
  const section = document.sections.find((candidate) => candidate.id === locator.sectionId);
  return section?.components.find((component) => component.id === locator.componentId) ?? null;
}

function componentTitle(component: Component): string {
  return component.type === 'text'
    ? component.props.heading ?? ''
    : component.props.title ?? '';
}

function setComponentTitle(component: Component, value: string): void {
  if (component.type === 'text') {
    setOptionalText(component.props, 'heading', value);
    return;
  }
  if (component.type === 'reportHeader') {
    component.props.title = value;
    return;
  }
  setOptionalText(component.props, 'title', value);
}

function componentDetail(component: Component): string {
  if (component.type === 'reportHeader' || component.type === 'table') {
    return component.props.subtitle ?? '';
  }
  return component.type === 'text' ? component.props.body ?? '' : '';
}

function componentDetailLabel(component: Component): string | null {
  if (component.type === 'reportHeader' || component.type === 'table') return '副标题';
  return component.type === 'text' ? '正文' : null;
}

function setComponentDetail(component: Component, value: string): void {
  if (component.type === 'reportHeader' || component.type === 'table') {
    setOptionalText(component.props, 'subtitle', value);
  } else if (component.type === 'text') {
    setOptionalText(component.props, 'body', value);
  }
}

function setOptionalText<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: string
): void {
  if (value.length === 0) delete target[key];
  else target[key] = value as T[K];
}

function componentTypeLabel(type: Component['type']): string {
  return {
    reportHeader: '报告页头',
    metricCard: '指标卡',
    barChart: '柱状图',
    lineChart: '折线图',
    pieChart: '饼图',
    table: '明细表',
    mapChart: '地图',
    rankingCard: '排行卡',
    text: '文本'
  }[type];
}

/** 页面文档是纯 JSON 领域对象；JSON 复制同时兼容 Svelte 响应式代理。 */
function clonePage(document: Page): Page {
  return JSON.parse(JSON.stringify(document)) as Page;
}
