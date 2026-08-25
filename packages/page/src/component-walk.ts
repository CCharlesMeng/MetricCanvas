/**
 * 页面组件树遍历:内容分区顶层组件,以及 Tab 容器内的子组件。
 * 校验、能力探测、编排与导航都走这一处,避免各层各写一遍漏掉嵌套表。
 *
 * 只依赖 `type` 与可选 `props.tabs`,不依赖 `./page` 的领域类型,以免成环。
 */

type Json = Record<string, unknown>;

export function walkComponents<T extends { type: string }>(
  components: readonly T[],
  basePath: string,
  visit: (component: T, path: string) => void
): void {
  components.forEach((component, index) => {
    visitTree(component, `${basePath}/${index}`, visit);
  });
}

export function walkPageComponents<T extends { type: string }>(
  page: { sections: ReadonlyArray<{ components: readonly T[] }> },
  visit: (component: T, path: string) => void
): void {
  page.sections.forEach((section, sectionIndex) => {
    walkComponents(section.components, `/sections/${sectionIndex}/components`, visit);
  });
}

export function flattenPageComponents<T extends { type: string }>(
  page: { sections: ReadonlyArray<{ components: readonly T[] }> }
): T[] {
  const components: T[] = [];
  walkPageComponents(page, (component) => {
    components.push(component);
  });
  return components;
}

function visitTree<T extends { type: string }>(
  component: T,
  path: string,
  visit: (component: T, path: string) => void
): void {
  visit(component, path);
  if (component.type !== 'tabContainer') return;
  const tabs = (component as { props?: { tabs?: Array<{ component?: T }> } }).props?.tabs ?? [];
  tabs.forEach((tab, tabIndex) => {
    if (!tab.component) return;
    visitTree(tab.component, `${path}/props/tabs/${tabIndex}/component`, visit);
  });
}

function record(value: unknown): Json | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : undefined;
}

/**
 * 原始文档上的组件树遍历,供能力下限探测使用。
 * 必须读原始文档:解析接缝会把文本取值引用整值替换掉。
 */
export function walkDocumentComponents(
  document: unknown,
  visit: (component: Json, path: string) => void
): void {
  const sections = record(document)?.sections;
  if (!Array.isArray(sections)) return;
  sections.forEach((sectionCandidate, sectionIndex) => {
    const components = record(sectionCandidate)?.components;
    if (!Array.isArray(components)) return;
    components.forEach((child, componentIndex) => {
      visitDocumentTree(
        child,
        `/sections/${sectionIndex}/components/${componentIndex}`,
        visit
      );
    });
  });
}

function visitDocumentTree(
  candidate: unknown,
  path: string,
  visit: (component: Json, path: string) => void
): void {
  const component = record(candidate);
  if (!component) return;
  visit(component, path);
  if (component.type !== 'tabContainer') return;
  const tabs = record(component.props)?.tabs;
  if (!Array.isArray(tabs)) return;
  tabs.forEach((tabCandidate, tabIndex) => {
    visitDocumentTree(
      record(tabCandidate)?.component,
      `${path}/props/tabs/${tabIndex}/component`,
      visit
    );
  });
}
