import type { FieldValue, ResolvedField, ValueFormat } from '@metriccanvas/page/internal';
import { hasRatioSuffix } from './display-unit';
import { finiteNumber, formatValue, isSignedNumberFormat } from './value-format';
import { formatIncludesUnit } from './numeric-presentation';

export function formatFieldValue(value: FieldValue | undefined, field: ResolvedField, unit?: string, displayUnit = unit): string {
  return formatValue(value, field.format, field.missingText, {
    unit: resolvedUnit(field) ?? unit, displayUnit
  });
}

export function resolvedUnit(field: ResolvedField): string | undefined {
  return field.definition && 'unit' in field.definition ? field.definition.unit : undefined;
}

export function fieldUnitText(unit: string | undefined, format: ValueFormat | undefined, text?: string): string | undefined {
  if (hasRatioSuffix(text, unit)) return undefined;
  return formatIncludesUnit(format) || (isPercentFormat(format) && (unit === '%' || unit === '％')) ? undefined : unit;
}

export function isPercentFormat(format: ValueFormat | undefined): boolean {
  return typeof format === 'string' && format.startsWith('percent-');
}

export function formatChangeValue(value: FieldValue | undefined, field: ResolvedField, positiveTone = false, unit?: string): string {
  const text = formatFieldValue(value, field, undefined, unit);
  const numeric = finiteNumber(value);
  if (numeric === undefined || numeric <= 0 || text.startsWith('+') || text.startsWith('>')) return text;
  const signed = isPercentFormat(field.format) || (positiveTone && !isSignedNumberFormat(field.format));
  return signed ? `+${text}` : text;
}
