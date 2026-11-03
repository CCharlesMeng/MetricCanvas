import type { Page } from './page';

export interface PageListEntry {
  id: string;
  title: string;
  description?: string;
}

/** 从已校验的页面统一派生目录展示信息。 */
export function pageListEntry(
  page: Pick<Page, 'id' | 'meta' | 'sections'>
): PageListEntry {
  const first=page.sections[0]?.components[0];
  let title = page.meta?.title ?? (first?.type==='iocHeader'?first.props.identity?.title:undefined);
  if (!title) {
    for (const section of page.sections) {
      const header = section.components.find(
        (component) => component.type === 'reportHeader'
      );
      if (header?.type !== 'reportHeader') continue;
      title = header.props.title;
      break;
    }
  }
  return {
    id: page.id,
    title: title ?? page.id,
    ...(page.meta?.description ? { description: page.meta.description } : {})
  };
}
