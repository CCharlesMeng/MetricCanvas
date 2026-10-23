import { walkComponents } from './component-walk';
import { tabChildren } from './tab-state';
import type { Component, Page } from './page';
import type { TypedError } from './errors';

/** A region is an existing direct-owner content sequence, never a new layout node. */
export interface AiSummaryRegion {
  kind: 'section' | 'compositeCard' | 'tab';
  id: string;
  sectionId: string;
  components: readonly Component[];
  columns: number;
  path: string;
}

export function aiSummaryRegions(page: Page): AiSummaryRegion[] {
  const regions: AiSummaryRegion[] = [];
  page.sections.forEach((section, index) => {
    const path = `/sections/${index}/components`;
    regions.push({ kind: 'section', id: section.id, sectionId: section.id,
      components: section.components, columns: section.columnTracks?.length ?? 12, path });
    walkComponents(section.components, path, (component, location) => {
      if (component.type === 'compositeCard') regions.push({ kind: 'compositeCard', id: component.id,
        sectionId: section.id, components: component.props.components, columns: 12, path: `${location}/props/components` });
      if (component.type !== 'tabContainer') return;
      component.props.tabs.forEach((tab, tabIndex) => {
        const base = `${location}/props/tabs/${tabIndex}`;
        regions.push({ kind: 'tab', id: `${component.id}/${tab.id}`, sectionId: section.id,
          components: tabChildren(tab), columns: 12, path: 'components' in tab ? `${base}/components` : `${base}/component` });
      });
    });
  });
  return regions;
}

export function aiSummaryRegion(page: Page, componentId: string): AiSummaryRegion | undefined {
  return aiSummaryRegions(page).find(region => region.components.some(component => component.id === componentId));
}

/** 6.58 writes a top-first structure; older documents retain their declared order. */
export function aiSummaryPositionErrors(page: Page): TypedError[] {
  if (Number(page.schemaVersion.split('.')[1]) < 58 || !page.schemaVersion.startsWith('6.')) return [];
  return [...aiSummaryRegions(page).flatMap(regionPositionErrors), ...pageSummaryPositionErrors(page)];
}

function pageSummaryPositionErrors(page: Page): TypedError[] {
  const errors: TypedError[] = [];
  let hasContent = false;
  page.sections.forEach((section, sectionIndex) => {
    const content = section.components.filter(component => component.type !== 'reportHeader');
    if (!content.length) return;
    const summaryOnly = content.every(component => component.type === 'aiSummary');
    if (summaryOnly && hasContent) section.components.forEach((component, index) => {
      if (component.type === 'aiSummary') errors.push({ type: 'SCHEMA_ERROR',
        path: `/sections/${sectionIndex}/components/${index}`, message: '独立 AI 总结必须位于页面正文顶部（Report 页头之后）' });
    });
    if (!summaryOnly) hasContent = true;
  });
  return errors;
}

function regionPositionErrors(region: AiSummaryRegion): TypedError[] {
  const errors: TypedError[] = [];
  let hasContent = false;
  region.components.forEach((component, index) => {
    if (component.type === 'reportHeader') return;
    if (component.type !== 'aiSummary') { hasContent = true; return; }
    const path = region.path.endsWith('/component') ? region.path : `${region.path}/${index}`;
    if (hasContent) errors.push({ type: 'SCHEMA_ERROR', path, message: 'AI 总结必须位于所属区域内容顶部（页头和区域标题之后）' });
    if (component.layout.span !== region.columns || component.layout.layer) errors.push({
      type: 'SCHEMA_ERROR', path: `${path}/layout`, message: `顶部 AI 总结必须占满所属区域 ${region.columns} 列，且不能声明铺底层`
    });
  });
  return errors;
}
