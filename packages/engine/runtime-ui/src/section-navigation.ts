import type { Page } from '@metriccanvas/page';
import type { PageParamValues } from '../../runtime/src/page-params';

export function initialSectionGroup(page: Page, params: PageParamValues): string | undefined {
  const value = page.sectionGroupParam ? params.get(page.sectionGroupParam) : undefined;
  if (value === undefined) return selectedSectionGroup(page);
  if (typeof value !== 'string' || !page.sectionGroups?.some(group => group.id === value)) throw new Error('页面参数引用了不存在的内容分区组');
  return value;
}

/** Selection belongs to the page instance; it never changes the query graph. */
export function selectedSectionGroup(page: Page, selected?: string): string | undefined {
  const groups = page.sectionGroups ?? [];
  return groups.find(group => group.id === selected)?.id
    ?? page.defaultSectionGroup ?? groups[0]?.id;
}

export function sectionGroupFor(page: Page, sectionId: string): string | undefined {
  return page.sectionGroups?.find(group => group.sectionIds.includes(sectionId))?.id;
}

export function visibleSections(page: Page, selected?: string): Page['sections'] {
  const active = selectedSectionGroup(page, selected);
  return page.sections.filter(section => {
    const group = sectionGroupFor(page, section.id);
    return group === undefined || group === active;
  });
}
