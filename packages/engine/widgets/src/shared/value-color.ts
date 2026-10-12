import type { ColorRule, FieldValue, MetricCardChange, TableColumn } from '@metriccanvas/page/internal';
import { finiteNumber, valuePolarity } from './value-format';

export type ValueColor = 'red' | 'green' | undefined;

/** Both numeric consumers share theme tokens and identical fallback shades. */
export function valueColorStyle(color: ValueColor): string | undefined {
  return color === 'red' ? 'var(--mc-color-negative, #f5222d)'
    : color === 'green' ? 'var(--mc-color-positive, #52c41a)' : undefined;
}

export function valueColor(value: FieldValue | undefined, rule: ColorRule): ValueColor {
  const numeric = finiteNumber(value);
  if (numeric === undefined) return undefined;
  if (rule.mode === 'fixed') return rule.color;
  return numeric > 0 ? rule.positive : numeric < 0 ? rule.negative : undefined;
}

/** Explicit rules win only on validated inputs; old pages keep their documented color behavior. */
export function tableValueColor(value: FieldValue | undefined, column: TableColumn): ValueColor {
  if (column.colorRule) return valueColor(value, column.colorRule);
  return column.visual === 'signed' ? legacyColor(value) : undefined;
}

export function changeValueColor(value: FieldValue | undefined, change: MetricCardChange): ValueColor {
  if (change.colorRule) return valueColor(value, change.colorRule);
  if (change.tone === 'neutral') return undefined;
  if (change.tone === 'positive') return 'green';
  if (change.tone === 'danger') return 'red';
  return legacyColor(value);
}

function legacyColor(value: FieldValue | undefined): ValueColor {
  const polarity = valuePolarity(value);
  return polarity === 'positive' ? 'green' : polarity === 'negative' ? 'red' : undefined;
}
