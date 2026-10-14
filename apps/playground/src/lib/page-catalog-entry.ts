import { parsePage } from '@metriccanvas/page';
import { documentLayoutForm, pageListEntry } from '@metriccanvas/page/internal';

export interface PlaygroundPageEntry {
  id: string;
  title: string;
  description?: string;
  layoutForm: 'dashboard' | 'report';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 布局形态与预览外框使用同一结构读取规则，不根据名称或目录分组推断。 */
export function catalogPageEntry(raw: unknown, fallbackId: string): PlaygroundPageEntry {
  const layoutForm = documentLayoutForm(raw);
  const parsed = parsePage(raw);
  if (parsed.ok) return { ...pageListEntry(parsed.page), layoutForm };

  const document = isRecord(raw) ? raw : {};
  const id = typeof document.id === 'string' ? document.id : fallbackId;
  const meta = isRecord(document.meta) ? document.meta : {};
  return {
    id,
    title: id,
    layoutForm,
    ...(typeof meta.description === 'string' ? { description: meta.description } : {})
  };
}
