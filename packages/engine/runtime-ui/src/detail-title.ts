import { fieldName, type OpenDetailAction, type Row } from '@metriccanvas/page/internal';
import { formatValue } from '../../widgets/src/shared/value-format';

/** Resolve only declared row references; the result is rendered as plain text. */
export function detailTitle(detail: OpenDetailAction['openDetail'], row: Row, fallback = '详情'): string {
  if (typeof detail.title === 'string') return detail.title;
  if (detail.title) return detail.title.parts.map(part => typeof part === 'string'
    ? part : formatValue(row[fieldName(part.field)], part.format)).join('');
  return detail.titleField ? formatValue(row[fieldName(detail.titleField)]) : fallback;
}
