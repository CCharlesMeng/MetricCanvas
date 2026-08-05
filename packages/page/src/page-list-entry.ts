import type { Page } from './page';

export interface PageListEntry {
  id: string;
  title: string;
  description?: string;
}

/** 从已校验的看板页面统一派生目录展示信息。 */
export function pageListEntry(
  page: Pick<Page, 'id' | 'meta' | 'sections'>
): PageListEntry {
  let title = page.id;
  for (const section of page.sections) {
    const header = section.components.find(
      (component) => component.type === 'reportHeader'
    );
    if (header?.type !== 'reportHeader') continue;
    title = header.props.title;
    break;
  }
  return {
    id: page.id,
    title,
    ...(page.meta?.description ? { description: page.meta.description } : {})
  };
}
