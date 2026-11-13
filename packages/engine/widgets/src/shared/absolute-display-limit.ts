import type { FieldValue } from '@metriccanvas/page/internal';

/** Compare raw numeric magnitudes before rounding or scaling; never promote fallback text. */
export function absoluteDisplayText(value: FieldValue | undefined, limit?: number): string | undefined {
  if (limit === undefined || typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.abs(value) > limit ? `> ${limit}` : undefined;
}
