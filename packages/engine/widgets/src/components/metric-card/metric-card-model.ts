import type {
  FieldBinding,
  FieldValue,
  MetricCardChange,
  MetricCardProps,
  MetricCardRow,
  Row,
  ValueFormat
} from '@metriccanvas/page/internal';
import { fieldSlot } from '@metriccanvas/page/internal';
import type { MetricDataSlots } from '../../shared/component-data';
import { fieldRow, fieldValue, resolveField } from '../../shared/component-data';
import { fieldUnitText, formatChangeValue, formatFieldValue, isPercentFormat } from '../../shared/field-presentation';
import { changeValueColor, valueColor, valueColorStyle } from '../../shared/value-color';
import { finiteNumber, hasDisplayValue, isSignedNumberFormat, valuePolarity } from '../../shared/value-format';

export interface MetricValueDisplay {
  raw: FieldValue | undefined;
  pending: boolean;
  colorStyle: string | undefined;
  text: string;
  unit: string | undefined;
}

export interface MetricChangeDisplay {
  label: string;
  pending: boolean;
  text: string;
  unit: string | undefined;
  color: ReturnType<typeof changeValueColor>;
  colorStyle: string | undefined;
  direction: 'positive' | 'negative' | 'neutral';
  showTrendArrow: boolean;
}

export interface MetricProgressDisplay {
  loading: boolean;
  value: number | undefined;
  missingText: string | undefined;
  format: ValueFormat | undefined;
  ringPercent: number | undefined;
  label: string;
}

export function isFieldLoading(binding: FieldBinding, data: MetricDataSlots, loading: boolean): boolean {
  if (!loading) return false;
  const slot = fieldSlot(binding) as keyof MetricDataSlots;
  return (data[slot]?.sourceStatus ?? 'loading') === 'loading';
}

export function resolveRowDefinitionCode(
  row: MetricCardRow,
  data: MetricDataSlots,
  hasRowDefinitionTip: boolean
): string | undefined {
  if (!hasRowDefinitionTip || row.showDefinition !== true || !row.label.trim()) return undefined;
  const field = resolveField(row.valueField, data).definition;
  return field?.role === 'measure' ? field.metricCode : undefined;
}

export function formatMetricFieldText(field: FieldBinding, data: MetricDataSlots, unit?: string): string {
  const resolved = resolveField(field, data);
  return formatFieldValue(fieldValue(field, data), resolved, unit);
}

export function resolveMetricRowRecord(field: FieldBinding, data: MetricDataSlots): Row | undefined {
  return fieldRow(field, data);
}

export function resolveMetricValueDisplay(
  row: MetricCardRow,
  data: MetricDataSlots,
  loading: boolean
): MetricValueDisplay {
  const raw = fieldValue(row.valueField, data);
  const field = resolveField(row.valueField, data);
  const pending = isFieldLoading(row.valueField, data, loading);
  const color = !pending && row.colorRule ? valueColor(raw, row.colorRule, field.format) : undefined;
  const text = formatFieldValue(raw, field, row.unit);
  const unit = hasDisplayValue(raw) ? fieldUnitText(row.unit, field.format, text) : undefined;
  return { raw, pending, colorStyle: valueColorStyle(color), text, unit };
}

function resolveChangeDirection(
  value: FieldValue | undefined,
  change: MetricCardChange,
  format: ValueFormat | undefined,
  color: ReturnType<typeof changeValueColor>
): 'positive' | 'negative' | 'neutral' {
  if (change.colorRule || isSignedNumberFormat(format)) {
    return valuePolarity(value, format);
  }
  if (color === 'green') return 'positive';
  if (color === 'red') return 'negative';
  return 'neutral';
}

export function resolveMetricChangeDisplay(
  change: MetricCardChange,
  data: MetricDataSlots,
  loading: boolean,
  showTrendArrows: boolean | undefined
): MetricChangeDisplay {
  const pending = isFieldLoading(change.field, data, loading);
  const value = pending ? undefined : fieldValue(change.field, data);
  const field = resolveField(change.field, data);
  const text = formatChangeValue(value, field, change.tone === 'positive', change.unit);
  const color = changeValueColor(value, change, field.format);
  const direction = resolveChangeDirection(value, change, field.format, color);
  const showTrendArrow =
    !pending && Boolean(showTrendArrows) && direction !== 'neutral' && !isPercentFormat(field.format);
  const unit = hasDisplayValue(value) && fieldUnitText(change.unit, field.format, text) ? change.unit : undefined;
  return {
    label: change.label,
    pending,
    text,
    unit,
    color,
    colorStyle: change.colorRule ? valueColorStyle(color) : undefined,
    direction,
    showTrendArrow
  };
}

export function resolveMetricProgress(
  progress: MetricCardProps['progress'],
  data: MetricDataSlots,
  loading: boolean
): MetricProgressDisplay | undefined {
  if (!progress) return undefined;
  const resolved = resolveField(progress.valueField, data);
  return {
    loading: isFieldLoading(progress.valueField, data, loading),
    value: finiteNumber(fieldValue(progress.valueField, data)),
    missingText: resolved.missingText,
    format: resolved.format,
    ringPercent: progress.ringPercent,
    label: progress.label ?? '完成率'
  };
}
