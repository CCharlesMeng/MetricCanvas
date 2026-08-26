import type { Row, ValueFormatPreset } from '@metriccanvas/page';
import { formatValue } from '../../shared/value-format';

/** 已解析的 tooltip 追加项:标签 + 字段名 + 该绑定最终生效的展示格式。 */
export interface MapTooltipField {
  label: string;
  field: string;
  format?: ValueFormatPreset;
}

export interface MapTooltipRow {
  label: string;
  value: string;
}

/** 数据行 → tooltip 的「标签 + 取值」序列;缺失取值走 `formatValue` 的空值文本。 */
export function mapTooltipRows(
  row: Row | undefined,
  fields: readonly MapTooltipField[]
): MapTooltipRow[] {
  return fields.map((entry) => ({
    label: entry.label,
    value: formatValue(row?.[entry.field], entry.format)
  }));
}

/**
 * tooltip 标记文本。ECharts 的 `formatter` 返回值按 HTML 渲染,而这里的标题与
 * 取值都来自数据,所以逐个转义——数据里的 `<` 不该变成标签。
 */
export function mapTooltipMarkup(title: string, rows: readonly MapTooltipRow[]): string {
  const body = rows
    .map(
      (row) =>
        `<div>${escapeText(row.label)}：<b>${escapeText(row.value)}</b></div>`
    )
    .join('');
  return `<div><b>${escapeText(title)}</b></div>${body}`;
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
