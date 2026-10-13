import type { ColorRule, FieldValue, MetricCardChange, TableColumn, ValueFormatPreset } from '@metriccanvas/page/internal';
import { finiteNumber, isSignedNumberFormat, valuePolarity } from './value-format';

export type ValueColor = 'red' | 'green' | undefined;

/** Both numeric consumers share theme tokens and identical fallback shades. */
export function valueColorStyle(color: ValueColor): string | undefined {
  return color === 'red' ? 'var(--mc-color-negative, #f5222d)'
    : color === 'green' ? 'var(--mc-color-positive, #52c41a)' : undefined;
}

export function valueColor(value: FieldValue | undefined, rule: ColorRule, format?: ValueFormatPreset): ValueColor {
  const numeric = finiteNumber(value);
  if (numeric === undefined) return undefined;
  if (rule.mode === 'fixed') return rule.color;
  const polarity = valuePolarity(numeric, format);
  return polarity === 'positive' ? rule.positive : polarity === 'negative' ? rule.negative : undefined;
}

/** Explicit rules win only on validated inputs; old pages keep their documented color behavior. */
export function tableValueColor(value: FieldValue | undefined, column: TableColumn, format?: ValueFormatPreset): ValueColor {
  if (column.colorRule) return valueColor(value, column.colorRule, format);
  return column.visual === 'signed' ? legacyColor(value, format) : undefined;
}

export function changeValueColor(value: FieldValue | undefined, change: MetricCardChange, format?: ValueFormatPreset): ValueColor {
  if (change.colorRule) return valueColor(value, change.colorRule, format);
  if (isSignedNumberFormat(format) && valuePolarity(value, format) === 'neutral') return undefined;
  if (change.tone === 'neutral') return undefined;
  if (change.tone === 'positive') return 'green';
  if (change.tone === 'danger') return 'red';
  return legacyColor(value, format);
}

function legacyColor(value: FieldValue | undefined, format?: ValueFormatPreset): ValueColor {
  const polarity = valuePolarity(value, format);
  return polarity === 'positive' ? 'green' : polarity === 'negative' ? 'red' : undefined;
}
