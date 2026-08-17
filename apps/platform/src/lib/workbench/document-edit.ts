import {
  assembleTransientPage,
  recommendComponents,
  resultShapeOfUnit,
  type ComponentCandidate,
  type ExecutedDataRequestUnit
} from '@metriccanvas/mcp';
import { validate, type QueryFieldDefinition } from '@metriccanvas/page';
import {
  normalizeAuthoringDropTarget,
  type AuthoringDraftSection,
  type AuthoringDropTarget
} from '@metriccanvas/runtime-ui/types';

/**
 * 画布与配置面板的本地文档改写(#65 检查器):全部为纯函数,输入输出都是
 * 创作态使用原子双投影：canvasDocument 允许内容分区暂时为空，
 * pageDocument 非破坏性忽略空分区后整体 validate，是查询、Agent、保存、
 * 沉淀与 metadata 的唯一输入。组件类型替换复用装配唯一实现
 * (assembleTransientPage)推导新组件 props，不手写第二份组件构造逻辑。
 */

export interface ComponentLocator {
  sectionId: string;
  componentId: string;
}

export type ComponentDropTarget = AuthoringDropTarget;

export interface CanvasAuthoringDraft {
  /** 画布唯一真源；移动最后一个组件后保留空内容分区的身份和顺序。 */
  canvasDocument: Record<string, unknown>;
  /** 正式消费者唯一输入；空内容分区已过滤且通过完整页面校验。 */
  pageDocument: Record<string, unknown>;
  /** Runtime 只用这份轻量排布覆盖正式页面的 Section 渲染顺序。 */
  authoringSections: AuthoringDraftSection[];
}

export type DocumentEditResult =
  | { ok: true; draft: CanvasAuthoringDraft }
  | { ok: false; message: string };

/** 只从正式有效 PageDocument 建立创作草稿；外部无效文档不得借草稿层进入。 */
export function createCanvasAuthoringDraft(
  document: Record<string, unknown>
): DocumentEditResult {
  const errors = validate(document);
  if (errors.length > 0) return invalidResult(errors);
  return projectCanvasDraft(jsonClone(document));
}

/** 由文档数据源反推取数单元(装配输入):字段契约、查询定义与内嵌初始行。 */
export function unitOfDataSource(
  document: Record<string, unknown>,
  dataSourceId: string,
  overrides?: Partial<Pick<ExecutedDataRequestUnit, 'title' | 'pinnedComponent'>>
): ExecutedDataRequestUnit | null {
  const dataSources = recordOf(document.dataSources);
  const dataSource = recordOf(dataSources?.[dataSourceId]);
  const source = recordOf(dataSource?.source);
  const fields = recordOf(dataSource?.fields);
  const query = recordOf(source?.query);
  if (!source || !fields || !query || source.type !== 'query') return null;
  const initial = recordOf(source.initial);
  return {
    dataSourceId,
    fields: fields as Record<string, QueryFieldDefinition>,
    query: query as unknown as ExecutedDataRequestUnit['query'],
    ...(initial &&
    typeof initial.capturedAt === 'string' &&
    Array.isArray(initial.rows)
      ? {
          initial: {
            capturedAt: initial.capturedAt,
            rows: initial.rows as ExecutedDataRequestUnit['initial'] extends
              | { rows: infer R }
              | undefined
              ? R
              : never,
            ...(typeof initial.totalCount === 'number'
              ? { totalCount: initial.totalCount }
              : {})
          }
        }
      : {}),
    ...(overrides?.title === undefined ? {} : { title: overrides.title }),
    ...(overrides?.pinnedComponent === undefined
      ? {}
      : { pinnedComponent: overrides.pinnedComponent })
  };
}

/** 选中组件可切换的组件候选:硬闸与排序由推荐唯一实现给出。 */
export function componentCandidatesFor(
  document: Record<string, unknown>,
  dataSourceId: string
): ComponentCandidate[] {
  const unit = unitOfDataSource(document, dataSourceId);
  if (!unit) return [];
  return recommendComponents(resultShapeOfUnit(unit));
}

/**
 * 单组件类型替换:反推该数据源的取数单元并以目标类型钉住重装配,
 * 从装配产物取出新组件的 type/props 替换进原文档(保留组件 id、
 * 用户调过的宽度与数据槽),出口整体 validate。
 */
export function changeComponentType(
  draft: CanvasAuthoringDraft,
  locator: ComponentLocator,
  newType: ComponentCandidate['type']
): DocumentEditResult {
  const next = jsonClone(draft.canvasDocument);
  const component = findComponent(next, locator);
  if (!component) return { ok: false, message: '选中的组件不在当前文档里' };
  const dataSourceId =
    typeof recordOf(component.data)?.main === 'string'
      ? (recordOf(component.data)!.main as string)
      : null;
  if (!dataSourceId) return { ok: false, message: '该组件不消费页面数据源,无法切换形态' };

  const currentTitle = recordOf(component.props)?.title;
  const unit = unitOfDataSource(next, dataSourceId, {
    ...(typeof currentTitle === 'string' ? { title: currentTitle } : {}),
    pinnedComponent: newType
  });
  if (!unit) return { ok: false, message: '无法从文档反推取数单元' };

  const pageId = typeof next.id === 'string' ? next.id : 'ask-transient-00000000';
  const assembled = assembleTransientPage({ pageId, units: [unit] });
  if (!assembled.ok) {
    return {
      ok: false,
      message: assembled.issues.map((issue) => issue.message).join(';')
    };
  }
  const rebuilt = assembled.document.sections[0]?.components[0];
  if (!rebuilt) return { ok: false, message: '装配产物缺少组件' };

  component.type = rebuilt.type;
  component.props = rebuilt.props;
  return projectCanvasDraft(next);
}

/**
 * 组件重排：把 source 移动到目标内容分区的插槽。
 * 插槽索引基于拖拽开始前的目标组件数组，支持首位、组件之间与末位。
 */
export function moveComponent(
  draft: CanvasAuthoringDraft,
  source: ComponentLocator,
  destination: ComponentDropTarget
): DocumentEditResult {
  const next = jsonClone(draft.canvasDocument);
  const fromSection = findSection(next, source.sectionId);
  const toSection = findSection(next, destination.sectionId);
  if (!fromSection || !toSection) return { ok: false, message: '分区不存在' };
  const fromIndex = componentIndex(fromSection, source.componentId);
  if (fromIndex < 0) return { ok: false, message: '被移动的组件不在当前文档里' };
  const destinationComponents = toSection.components as unknown[];
  const normalized = normalizeAuthoringDropTarget(
    { sectionId: source.sectionId, index: fromIndex },
    destination,
    destinationComponents.length
  );
  if (normalized.kind === 'invalid') {
    return { ok: false, message: '目标插槽不在当前文档里' };
  }
  if (normalized.kind === 'unchanged') {
    return { ok: true, draft };
  }

  const [moved] = (fromSection.components as unknown[]).splice(fromIndex, 1);
  destinationComponents.splice(normalized.destination.index, 0, moved);
  return projectCanvasDraft(next);
}

/** 组件标题与宽度编辑;宽度夹取在 1–12 列。 */
export function editComponent(
  draft: CanvasAuthoringDraft,
  locator: ComponentLocator,
  edit: { title?: string; span?: number }
): DocumentEditResult {
  const next = jsonClone(draft.canvasDocument);
  const component = findComponent(next, locator);
  if (!component) return { ok: false, message: '选中的组件不在当前文档里' };
  if (edit.title !== undefined) {
    const props = recordOf(component.props) ?? {};
    if (edit.title.trim() === '') delete props.title;
    else props.title = edit.title;
    component.props = props;
  }
  if (edit.span !== undefined) {
    const layout = recordOf(component.layout) ?? {};
    layout.span = Math.min(12, Math.max(1, Math.round(edit.span)));
    component.layout = layout;
  }
  return projectCanvasDraft(next);
}

/** 由组件 id 反查其完整定位(检查器清单点击联动画布选中用)。 */
export function locatorOfComponent(
  document: Record<string, unknown>,
  componentId: string
): ComponentLocator | null {
  const sections = Array.isArray(document.sections) ? document.sections : [];
  for (const section of sections) {
    const record = recordOf(section);
    if (!record || typeof record.id !== 'string') continue;
    if (componentIndex(record, componentId) >= 0) {
      return { sectionId: record.id, componentId };
    }
  }
  return null;
}

function projectCanvasDraft(
  canvasDocument: Record<string, unknown>
): DocumentEditResult {
  const authoringSections = authoringSectionsOf(canvasDocument);
  if (authoringSections === null) {
    return { ok: false, message: '创作草稿的内容分区结构无效' };
  }

  const pageDocument = jsonClone(canvasDocument);
  if (Array.isArray(pageDocument.sections)) {
    pageDocument.sections = pageDocument.sections.filter((value) => {
      const section = recordOf(value);
      return !section || !Array.isArray(section.components) || section.components.length > 0;
    });
  }
  const errors = validate(pageDocument);
  if (errors.length > 0) {
    return invalidResult(errors);
  }
  return {
    ok: true,
    draft: { canvasDocument, pageDocument, authoringSections }
  };
}

function authoringSectionsOf(
  document: Record<string, unknown>
): AuthoringDraftSection[] | null {
  if (!Array.isArray(document.sections)) return null;
  const result: AuthoringDraftSection[] = [];
  for (const value of document.sections) {
    const section = recordOf(value);
    if (!section || typeof section.id !== 'string' || !Array.isArray(section.components)) {
      return null;
    }
    if (section.title !== undefined && typeof section.title !== 'string') return null;
    if (
      section.container !== undefined &&
      section.container !== 'plain' &&
      section.container !== 'panel' &&
      section.container !== 'card'
    ) {
      return null;
    }
    const componentIds: string[] = [];
    for (const componentValue of section.components) {
      const component = recordOf(componentValue);
      if (!component || typeof component.id !== 'string') return null;
      componentIds.push(component.id);
    }
    result.push({
      id: section.id,
      ...(section.title === undefined ? {} : { title: section.title }),
      ...(section.container === undefined ? {} : { container: section.container }),
      componentIds
    });
  }
  return result;
}

function invalidResult(
  errors: ReturnType<typeof validate>
): Extract<DocumentEditResult, { ok: false }> {
  return { ok: false, message: errors.map((error) => error.message).join('、') };
}

interface MutableComponent extends Record<string, unknown> {
  id: string;
  type: string;
}

function findSection(
  document: Record<string, unknown>,
  sectionId: string
): Record<string, unknown> | null {
  const sections = Array.isArray(document.sections) ? document.sections : [];
  for (const section of sections) {
    const record = recordOf(section);
    if (record && record.id === sectionId && Array.isArray(record.components)) {
      return record;
    }
  }
  return null;
}

function componentIndex(section: Record<string, unknown>, componentId: string): number {
  const components = Array.isArray(section.components) ? section.components : [];
  return components.findIndex(
    (component) => recordOf(component)?.id === componentId
  );
}

function findComponent(
  document: Record<string, unknown>,
  locator: ComponentLocator
): MutableComponent | null {
  const section = findSection(document, locator.sectionId);
  if (!section) return null;
  const index = componentIndex(section, locator.componentId);
  if (index < 0) return null;
  return (section.components as unknown[])[index] as MutableComponent;
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * 页面文档的深克隆:文档本就是 JSON 数据,用 JSON 往返而不是
 * structuredClone——后者无法克隆 Svelte 5 `$state` 的深层 Proxy
 * (DataCloneError),而工作台传入的文档正是响应式状态。
 */
function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
