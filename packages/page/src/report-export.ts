import { walkDocumentComponents } from './component-walk';

type Format = 'pdf' | 'png';
export function reportExportScale(format: 'png', value: unknown): 3 | 4;
export function reportExportScale(format: Format, value: unknown): 2 | 3 | 4;
export function reportExportScale(format: Format, value: unknown): 2 | 3 | 4 {
  if (value === 3 || value === 4) return value;
  return format === 'pdf' ? 2 : 3;
}

/** Invalid scale is absence, before text references, validation and canonical writing. */
export function normalizeReportExportScales(document: unknown): unknown {
  let needsCopy = false;
  visit(document, (config, format) => {
    if (config.scale !== undefined && config.scale !== reportExportScale(format, config.scale)) needsCopy = true;
  });
  if (!needsCopy) return document;
  // Also accepts host proxies; the caller's original revision is never mutated.
  const normalized: unknown = JSON.parse(JSON.stringify(document));
  visit(normalized, (config, format) => {
    if (config.scale !== reportExportScale(format, config.scale)) delete config.scale;
  });
  return normalized;
}

function visit(document: unknown, consume: (config: Record<string, unknown>, format: Format) => void): void {
  walkDocumentComponents(document, component => {
    if (component.type !== 'reportHeader') return;
    const props = record(component.props);
    if (!props) return;
    const legacy = record(props.pngExport);
    if (legacy) consume(legacy, 'png');
    if (!Array.isArray(props.exportButtons)) return;
    for (const value of props.exportButtons) {
      const config = record(value);
      if (config?.format === 'pdf' || config?.format === 'png') consume(config, config.format);
    }
  });
}
function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
