import type { FieldValue, ValueFormatPreset } from '@metriccanvas/page/internal';
import { finiteNumber } from './value-format';

/** Only declared presentation is joined; never infer or rescale a business unit. */
export function appendDisplayUnit(text: string, value: FieldValue | undefined, unit?: string, format?: ValueFormatPreset): string {
  if (!unit || finiteNumber(value) === undefined) return text;
  if (text.endsWith(unit)) return text;
  const suffix = presetUnit(format, text);
  const number = suffix && unit.startsWith(suffix) ? text.slice(0, -suffix.length) : text;
  return `${number} ${unit}`;
}
function presetUnit(format: ValueFormatPreset | undefined, text: string): string | undefined {
  if (!format || !/^(compact-|percent-|points-|cny-|usd-)/.test(format)) return undefined;
  return /(百万|美元|万|亿|元|%|P)$/.exec(text)?.[0];
}
export function seriesDisplayName(label: string, unit?: string): string {
  return unit ? `${label}（${unit}）` : label;
}
export function chartLegendVisible(series: readonly {unit?: string}[]): boolean {
  return series.length > 1 || series.some(source => !!source.unit);
}
