import type { FieldValue, ValueFormat } from '@metriccanvas/page/internal';

/** Compare raw numeric magnitudes before rounding or scaling; never promote fallback text. */
export function absoluteDisplayText(value: FieldValue | undefined, limit?: number): string | undefined {
  if (limit === undefined || typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.abs(value) > limit ? `> ${limit}` : undefined;
}

/** The two point formats have different input scales. Plain numbers qualify only with a displayed ratio unit. */
export function ratioLimitText(value: number, format?: ValueFormat, displayUnit?: string): string | undefined {
  const limit = format === 'yoy-p-signed' ? 5 : 500;
  if (Math.abs(value) <= limit) return undefined;
  const unit = ratioUnit(format, displayUnit);
  if (!unit) return undefined;
  return value < 0 ? `<-500${unit}` : `>500${unit}`;
}

function ratioUnit(format?: ValueFormat, displayUnit?: string): string | undefined {
  if (format === 'points-1-signed' || format === 'yoy-p-signed') return 'P';
  if (typeof format === 'string' && format.startsWith('percent-')) return '%';
  if (format !== undefined && !(typeof format === 'string' && format.startsWith('number'))) return undefined;
  if (displayUnit === '%' || displayUnit === '％') return '%';
  return displayUnit === 'P' ? 'P' : undefined;
}
