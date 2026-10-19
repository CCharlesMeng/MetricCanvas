import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parsePage } from '../../packages/page/src/validate';
import type { Component } from '../../packages/page/src/page';

/** Selection is editorial; structure and provenance always come from the actual page. */
export const pagePatternSources = [
  {id: 'dashboard-map', pageId: 'ioc-project-overview', layout: 'dashboard'},
  {id: 'dashboard-analysis', pageId: 'ioc-opportunity-analysis', layout: 'dashboard'},
  {id: 'dashboard-list', pageId: 'ioc-opportunity-list', layout: 'dashboard'},
  {id: 'dashboard-detail', pageId: 'ioc-project-detail', layout: 'dashboard'},
  {id: 'report-monthly', pageId: 'business-sdt-report-monthly', layout: 'report'},
  {id: 'report-briefing', pageId: 'flow-analysis-report', layout: 'report'}
] as const;

type PatternSource = typeof pagePatternSources[number];
interface ComponentPattern {
  type: string;
  variant?: string;
  layout?: Component['layout'];
  components?: ComponentPattern[];
  tabs?: Array<{components: ComponentPattern[]}>;
}

// An allowlist keeps query bodies, business rows, field bindings, URLs and free text out.
function componentPattern(component: Component): ComponentPattern {
  const result: ComponentPattern = {type: component.type, layout: component.layout};
  if ('variant' in component.props) result.variant = component.props.variant;
  if (component.type === 'compositeCard') result.components = component.props.components.map(componentPattern);
  if (component.type === 'tabContainer') result.tabs = component.props.tabs.map(tab => ({
    components: ('component' in tab ? [tab.component] : tab.components).map(componentPattern)
  }));
  return result;
}

export function pagePattern(source: PatternSource, content: string) {
  const parsed = parsePage(JSON.parse(content));
  if (!parsed.ok) throw new Error(`Invalid pattern source ${source.pageId}: ${JSON.stringify(parsed.errors)}`);
  const page = parsed.page;
  const layout = page.layout ?? 'report';
  if (page.id !== source.pageId || layout !== source.layout) {
    throw new Error(`Pattern source identity/layout changed: ${source.pageId}`);
  }
  return {
    id: source.id,
    kind: 'structural-pattern',
    source: {pageId: page.id, sha256: createHash('sha256').update(content).digest('hex')},
    layout,
    dashboardToolbar: layout === 'dashboard'
      ? typeof page.dashboardToolbar === 'object' ? page.dashboardToolbar.variant : page.dashboardToolbar ?? 'visible'
      : undefined,
    filters: (page.filters ?? []).map(filter => ({type: filter.type})),
    sections: page.sections.map(section => ({
      container: section.container,
      columnTracks: section.columnTracks,
      components: section.components.map(componentPattern)
    }))
  };
}

export async function localPagePatternOutputs(root: string): Promise<Map<string, string>> {
  const outputs = new Map<string, string>();
  for (const source of pagePatternSources) {
    const content = await readFile(path.join(root, 'pages', `${source.pageId}.json`), 'utf8');
    outputs.set(`references/page-patterns/${source.id}.json`, JSON.stringify(pagePattern(source, content), null, 2) + '\n');
  }
  return outputs;
}
