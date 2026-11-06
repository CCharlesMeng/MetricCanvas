import type { FieldValue, ResolvedField, ValueFormatPreset } from '@metriccanvas/page/internal';
import { finiteNumber, formatValue, isSignedNumberFormat } from './value-format';
import { formatIncludesUnit } from './numeric-presentation';

export function formatFieldValue(value: FieldValue | undefined, field: ResolvedField, unit?: string): string {
  return formatValue(value, field.format, field.missingText, {
    unit: resolvedUnit(field) ?? unit
  });
}

export function resolvedUnit(field: ResolvedField): string | undefined {
  return field.definition && 'unit' in field.definition ? field.definition.unit : undefined;
}

export function fieldUnitText(unit: string | undefined, format: ValueFormatPreset | undefined): string | undefined {
  return formatIncludesUnit(format) || (isPercentFormat(format) && (unit === '%' || unit === '％')) ? undefined : unit;
}

export function isPercentFormat(format: ValueFormatPreset | undefined): boolean {
  return format?.startsWith('percent-') === true;
}

export function formatChangeValue(value: FieldValue | undefined, field: ResolvedField, positiveTone = false): string {
  const text = formatFieldValue(value, field);
  const numeric = finiteNumber(value);
  if (numeric === undefined || numeric <= 0 || text.startsWith('+') || text.startsWith('上升')) return text;
  const signed = isPercentFormat(field.format) || (positiveTone && !isSignedNumberFormat(field.format));
  return signed ? `+${text}` : text;
}
