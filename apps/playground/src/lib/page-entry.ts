import { parsePage } from '@metriccanvas/page';
import { documentLayoutForm, flattenPageComponents, pageListEntry } from '@metriccanvas/page/internal';
import { playgroundComponents } from '../../scenarios/components';

export const pageComponentTypes = playgroundComponents.map(entry => ({ id: entry.type, title: entry.label }));

export interface PlaygroundPageEntry {
  id: string;
  title: string;
  description?: string;
  layoutForm: 'dashboard' | 'report';
  filePath?: string;
  componentTypes: string[];
  dataKind: 'inline' | 'query' | 'unknown';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 布局形态与预览外框使用同一结构读取规则，不根据名称或目录分组推断。 */
export function pageEntry(raw: unknown, fallbackId: string): PlaygroundPageEntry {
  const layoutForm = documentLayoutForm(raw);
  const parsed = parsePage(raw);
  if (parsed.ok) return {
    ...pageListEntry(parsed.page), layoutForm,
    componentTypes: [...new Set(flattenPageComponents(parsed.page).map(component => component.type)),
      ...(parsed.page.iocHeader ? ['iocHeader'] : [])],
    dataKind: Object.values(parsed.page.dataSources).some(source => source.source.type !== 'inline') ? 'query' : 'inline'
  };

  const document = isRecord(raw) ? raw : {};
  const id = typeof document.id === 'string' ? document.id : fallbackId;
  const meta = isRecord(document.meta) ? document.meta : {};
  return {
    id,
    title: id,
    layoutForm,
    componentTypes: [],
    dataKind: 'unknown',
    ...(typeof meta.description === 'string' ? { description: meta.description } : {})
  };
}
