import type { Component } from '@metriccanvas/page/internal';

export interface SectionMember { component: Component; index: number }
export interface SectionLayoutItem { id: string; members: SectionMember[]; span: number }

export function metricBefore(component: Component): { text: string; gap?: number } | undefined {
  if (component.type !== 'metricCard') return undefined;
  const before = component.layout.before;
  return before?.text?.trim() ? before : undefined;
}

/** 显式相邻关系派生布局；可见端点判断只切断边，不寻找替代前项。 */
export function metricConnectionItems(components: readonly Component[], shown?: ReadonlySet<string>): SectionLayoutItem[] {
  const items: SectionLayoutItem[] = [];
  components.forEach((component, index) => {
    if (shown && !shown.has(component.id)) return;
    const previous = components[index - 1], item = items.at(-1);
    const connects = previous?.type === 'metricCard' && metricBefore(component) !== undefined &&
      (!shown || shown.has(previous.id)) && item?.members.at(-1)?.index === index - 1;
    if (connects && item) {
      item.members.push({ component, index });
      item.span += component.layout.span;
    } else items.push({ id: component.id, members: [{ component, index }], span: component.layout.span });
  });
  return items;
}
