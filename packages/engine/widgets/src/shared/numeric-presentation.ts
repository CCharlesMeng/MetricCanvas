import type { ValueFormat } from '@metriccanvas/page/internal';
import { numericScale } from './numeric-scale';

export function decimalText(value: number, digits = 0, grouped = true): string {
  const text = new Intl.NumberFormat('en-US', {
    useGrouping: grouped, minimumFractionDigits: 0, maximumFractionDigits: digits
  }).format(value);
  return text === '-0' ? '0' : text;
}

export function adaptivePercent(value: number, signed = false): string {
  const magnitude = Math.abs(value);
  if (magnitude >= 500) return `${value < 0 ? '下降' : '上升'}>500%`;
  const digits = percentDigits(magnitude);
  const text = magnitude > 0 && magnitude < 1e-20 ? String(magnitude) : decimalText(magnitude, digits, false);
  const sign = text === '0' ? '' : value < 0 ? '-' : signed ? '+' : '';
  return `${sign}${text}%`;
}

function percentDigits(magnitude: number): number {
  if (magnitude >= 100) return 0;
  if (magnitude >= 10) return 1;
  if (magnitude === 0) return 2;
  return Math.min(20, Math.max(2, Math.ceil(-Math.log10(magnitude))));
}

export function cnyPresentation(value: number, mobile: boolean): string {
  return scaledText(value, 'cny-adaptive', '', mobile);
}

export function usdPresentation(value: number): string {
  return scaledText(value, 'usd-adaptive');
}

function countPresentation(value: number, unit: string): string {
  return scaledText(value, 'count-adaptive', unit);
}

function resourcePresentation(value: number, unit: string): string {
  return scaledText(value, 'resource-adaptive', unit);
}

/** Normalize the declared input prefix, retaining bit/byte and per-second dimensions. */
export function bytePresentation(value: number, unit = 'Bytes'): string {
  return scaledText(value, 'bytes-adaptive', unit);
}

function minutesPresentation(value: number): string {
  return scaledText(value, 'minutes-adaptive');
}

function scaledText(value: number, format: ValueFormat, unit = '', mobile = false): string {
  const scale = numericScale(format, Math.abs(value), unit, mobile)!;
  return `${decimalText(value / scale.divisor, scale.digits, scale.grouped)}${scale.space ? ' ' : ''}${scale.unit}`;
}

export function adaptiveNumericText(value: number, format: ValueFormat, unit = '', mobile = false): string | undefined {
  switch (format) {
    case 'cny-adaptive': return cnyPresentation(value, mobile);
    case 'usd-adaptive': return usdPresentation(value);
    case 'percent-adaptive': return adaptivePercent(value);
    case 'percent-adaptive-signed': return adaptivePercent(value, true);
    case 'count-adaptive': return countPresentation(value, unit);
    case 'resource-adaptive': return resourcePresentation(value, unit);
    case 'bytes-adaptive': return bytePresentation(value, unit || 'Bytes');
    case 'minutes-adaptive': return minutesPresentation(value);
    case 'messages-adaptive': return scaledText(value, format);
    case 'billing-hours': return scaledText(value, format);
    default: return undefined;
  }
}

export function formatIncludesUnit(format: ValueFormat | undefined): boolean {
  return /^(?:(?:cny|usd)-adaptive(?:-trimmed(?:-no-yuan)?|-km)?|(?:count|resource|bytes|minutes|messages)-adaptive)$/.test(typeof format === 'string' ? format : '') || format === 'billing-hours';
}
