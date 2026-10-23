import { conditionSourceIds, walkPageComponents, type Page } from '@metriccanvas/page/internal';

const pointer = (value: string) => value.replace(/~/g, '~0').replace(/\//g, '~1');

interface ExportSourceConsumer {
  componentId: string;
  componentType: string;
  componentTitle?: string;
  componentPath: string;
  sectionId?: string;
  sectionTitle?: string;
  bindingPath: string;
  boundSourceId: string;
  relation: 'direct' | 'dependency';
}
export interface ExportSourceDetails {
  dataSourceId: string;
  dataSourcePath: string;
  components: ExportSourceConsumer[];
}

/** Resolve declaration locations only; never include query bodies or result rows. */
export function describeExportSource(page: Page, sourceId: string): ExportSourceDetails {
  const components: ExportSourceConsumer[] = [];
  walkPageComponents(page, (component, path) => {
    const parts = path.split('/');
    if (parts[1] === 'detailViews' && page.detailViews?.[Number(parts[2])]?.mode !== 'snapshot') return;
    const section = parts[1] === 'sections' ? page.sections[Number(parts[2])] : undefined;
    const bindings = Object.entries(component.data ?? {}).map(([slot, id]) => ({ id, path: `${path}/data/${pointer(slot)}` }));
    if (component.type === 'aiSummary') for (const [slot, value] of Object.entries(component.props.relatedData ?? {})) {
      bindings.push({ id: value.source, path: `${path}/props/relatedData/${pointer(slot)}/source` });
    }
    for (const binding of bindings) {
      if (!conditionSourceIds(page, binding.id).has(sourceId)) continue;
      components.push({
        componentId: component.id,
        componentType: component.type,
        ...('title' in component.props && typeof component.props.title === 'string' ? { componentTitle: component.props.title } : {}),
        componentPath: path,
        ...(section ? { sectionId: section.id, ...(typeof section.title === 'string' ? { sectionTitle: section.title } : {}) } : {}),
        bindingPath: binding.path,
        boundSourceId: binding.id,
        relation: binding.id === sourceId ? 'direct' : 'dependency'
      });
    }
  });
  return { dataSourceId: sourceId, dataSourcePath: `/dataSources/${pointer(sourceId)}`, components };
}
