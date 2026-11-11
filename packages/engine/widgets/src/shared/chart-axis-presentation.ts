import type { Row, ValueFormat } from '@metriccanvas/page/internal';
import type { ResolvedComponentValue } from './component-value';
import { decimalText } from './numeric-presentation';
import { numericScale, type NumericScale } from './numeric-scale';
import { mobilePresentation } from './presentation-environment';
import { finiteNumber, formatValue } from './value-format';

export interface AxisField { format?: ValueFormat; unit?: string; displayUnit?: string; magnitude?: number }

export function chartAxisField(field: ResolvedComponentValue, rows: readonly Row[], displayUnit?: string): AxisField {
  const magnitude = rows.reduce((max, row) => Math.max(max, Math.abs(finiteNumber(field.read(row)) ?? 0)), 0);
  return { format: field.format, unit: field.unit, displayUnit, magnitude };
}

function inferredUnit(format: ValueFormat | undefined): string | undefined {
  if (typeof format !== 'string') return undefined;
  if (format.startsWith('percent-')) return '%';
  if (format.startsWith('cny-')) return '元';
  if (format.startsWith('usd-')) return '美元';
  if (format === 'points-1-signed' || format === 'yoy-p-signed') return 'P';
  return undefined;
}

function sharedFormat(fields: AxisField[]): ValueFormat | undefined {
  const first = fields[0]?.format;
  if (fields.length && fields.every(field => typeof field.format === 'string' && field.format.startsWith('percent-'))) {
    return fields.every(field => field.format === first) ? first : 'percent-adaptive';
  }
  return fields.every(field => field.format === first) ? first : undefined;
}

function joinScaleUnit(prefix: string, unit = ''): string {
  return unit.startsWith(prefix) ? unit : `${prefix}${unit}`;
}

function axisUnit(field: AxisField, scale: NumericScale | undefined): string | undefined {
  if (field.displayUnit === '') return undefined;
  const unit = field.displayUnit ?? field.unit ?? inferredUnit(field.format);
  if (!scale) return unit;
  if (typeof field.format === 'string' && field.format.startsWith('compact-')) return joinScaleUnit(scale.unit, unit);
  if (typeof field.format === 'string' && /^(cny|usd)-/.test(field.format)) {
    const prefix = ['元', '美元', '$'].includes(scale.unit) ? '' : scale.unit;
    return joinScaleUnit(prefix, unit);
  }
  if (field.displayUnit !== undefined && /^(count|resource)-adaptive$/.test(String(field.format))) {
    const input = field.unit ?? field.displayUnit;
    const prefix = input ? scale.unit.slice(0, -input.length) : scale.unit;
    return joinScaleUnit(prefix, field.displayUnit);
  }
  return scale.unit || unit;
}

function percentAxisText(value: number, format: string): string {
  if (format === 'percent-raw') return String(value);
  if (!format.startsWith('percent-adaptive')) return formatValue(value, format.replace('percent-', 'number-') as ValueFormat);
  const magnitude = Math.abs(value);
  if (magnitude > 0 && magnitude < 1e-20) return String(value);
  const digits = magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : Math.min(20, Math.max(2, Math.ceil(-Math.log10(magnitude || 1))));
  const text = decimalText(value, digits, false);
  return format.endsWith('-signed') && value > 0 && text !== '0' ? `+${text}` : text;
}

function axisNumber(value: number, format: ValueFormat | undefined, scale: NumericScale | undefined): string {
  if (scale) {
    const digits = typeof format === 'string' && format.endsWith('-adaptive') ? Math.max(2, scale.digits) : scale.digits;
    return decimalText(value / scale.divisor, digits, scale.grouped);
  }
  if (typeof format === 'string' && format.startsWith('percent-')) return percentAxisText(value, format);
  if (format === 'points-1-signed') return formatValue(value, 'number-1-signed');
  if (format === 'yoy-p-signed') return yoyAxisText(value);
  return formatValue(value, format ?? 'number-2');
}

function yoyAxisText(value: number): string {
  const rounded = Number(formatValue(value, 'number-2-signed')) * 100;
  const text = formatValue(rounded, 'number-0');
  return rounded > 0 && text !== '0' ? `+${text}` : text;
}

/** Axis layout owns the unit; scalar formatters still own tooltip and label text. */
export function numericAxisPresentation(fields: AxisField[]) {
  const format = sharedFormat(fields);
  const magnitude = fields.reduce((max, field) => Math.max(max, field.magnitude ?? 0), 0);
  const sourceUnit = fields[0]?.unit ?? fields[0]?.displayUnit;
  const scale = numericScale(format, magnitude, sourceUnit, mobilePresentation());
  const units = fields.map(field => axisUnit({ ...field, format }, numericScale(format, magnitude, field.unit ?? field.displayUnit, mobilePresentation())));
  const sameUnit = units.every(unit => unit === units[0]);
  const compatible = sameUnit && fields.every(field => (field.unit ?? field.displayUnit ?? inferredUnit(field.format)) === (sourceUnit ?? inferredUnit(fields[0]?.format)));
  const name = compatible ? units[0] : undefined;
  return {
    name, nameLocation: 'end' as const, nameRotate: 0, nameGap: 12,
    axisLabel: { formatter: (value: number) => axisNumber(value, compatible ? format : undefined, compatible ? scale : undefined) }
  };
}
