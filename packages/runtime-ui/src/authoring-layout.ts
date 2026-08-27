import type { PageSection } from '@metriccanvas/page';
import type {
  AuthoringComponentLocator,
  AuthoringDraftSection
} from './types';
export { normalizeAuthoringDropTarget } from './types';

/** 内容分区按组件顺序产生 n + 1 个插槽；空内容分区仍有首个插槽。 */
export function authoringDropSlots(componentCount: number): number[] {
  const count = Number.isInteger(componentCount) && componentCount > 0
    ? componentCount
    : 0;
  return Array.from({ length: count + 1 }, (_value, index) => index);
}

/**
 * 把组件主体分成前后两个落点区域。用户不需要精确命中边缘插槽：拖到
 * 组件左半区表示插到它前面，右半区表示插到它后面。
 */
export function authoringComponentDropIndex(
  componentIndex: number,
  pointerX: number,
  componentLeft: number,
  componentWidth: number
): number {
  return pointerX < componentLeft + componentWidth / 2
    ? componentIndex
    : componentIndex + 1;
}

/**
 * 以正式页面中的组件实体填充创作态 Section 排布。草稿只决定 Section
 * 身份与组件顺序；缺失、重复或漏组件时失败关闭，退回正式排布。
 */
export function resolveAuthoringSections(
  pageSections: readonly PageSection[],
  draftSections: readonly AuthoringDraftSection[] | undefined
): readonly PageSection[] {
  if (draftSections === undefined) return pageSections;

  const componentsById = new Map(
    pageSections.flatMap((section) =>
      section.components.map((component) => [component.id, component] as const)
    )
  );
  const seenSections = new Set<string>();
  const seenComponents = new Set<string>();
  const resolved: PageSection[] = [];

  for (const draftSection of draftSections) {
    if (seenSections.has(draftSection.id)) return pageSections;
    seenSections.add(draftSection.id);
    const components = [];
    const sourceSection = pageSections.find((section) => section.id === draftSection.id);
    for (const componentId of draftSection.componentIds) {
      const component = componentsById.get(componentId);
      if (!component || seenComponents.has(componentId)) return pageSections;
      seenComponents.add(componentId);
      components.push(component);
    }
    resolved.push({
      id: draftSection.id,
      ...(draftSection.title === undefined ? {} : { title: draftSection.title }),
      ...(draftSection.container === undefined
        ? {}
        : { container: draftSection.container }),
      ...(sourceSection?.columnTracks === undefined
        ? {}
        : { columnTracks: sourceSection.columnTracks }),
      components
    });
  }

  return seenComponents.size === componentsById.size ? resolved : pageSections;
}

/** 原生 DataTransfer 文本的失败关闭解码，不信任任意拖拽载荷。 */
export function decodeAuthoringComponentLocator(
  encoded: string
): AuthoringComponentLocator | null {
  if (encoded === '') return null;
  try {
    const candidate: unknown = JSON.parse(encoded);
    if (!isRecord(candidate)) return null;
    if (
      typeof candidate.sectionId !== 'string' ||
      typeof candidate.componentId !== 'string'
    ) {
      return null;
    }
    return {
      sectionId: candidate.sectionId,
      componentId: candidate.componentId
    };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
