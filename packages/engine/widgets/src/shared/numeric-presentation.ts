import type { ValueFormat } from '@metriccanvas/page/internal';

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
  const magnitude = Math.abs(value);
  if (magnitude < 1e4) return `${decimalText(value)}元`;
  if (magnitude < 1e5) return `${decimalText(value / 1e4, mobile ? 1 : 2)}万`;
  if (magnitude < 1e8) return `${decimalText(value / 1e4)}万`;
  if (magnitude < 1e9) return `${decimalText(value / 1e8, 2)}亿`;
  return `${decimalText(value / 1e8, 1)}亿`;
}

export function usdPresentation(value: number): string {
  const magnitude = Math.abs(value);
  if (magnitude < 1e4) return `${decimalText(value)}美元`;
  if (magnitude < 1e6) return `${decimalText(value / 1e3, 1)}K`;
  if (magnitude < 1e8) return `${decimalText(value / 1e3)}K`;
  return `${decimalText(value / 1e6)}M`;
}

function countPresentation(value: number, unit: string): string {
  const magnitude = Math.abs(value);
  if (magnitude < 1e4) return `${decimalText(value)}${unit}`;
  return `${decimalText(value / 1e4, magnitude < 1e5 ? 1 : 0)}万${unit}`;
}

function resourcePresentation(value: number, unit: string): string {
  const magnitude = Math.abs(value);
  if (magnitude < 1e4) return `${decimalText(value)}${unit}`;
  if (magnitude < 1e8) return `${decimalText(value / 1e4, 2)}万${unit}`;
  return `${decimalText(value / 1e8, 2)}亿${unit}`;
}

/** Normalize the declared input prefix, retaining bit/byte and per-second dimensions. */
export function bytePresentation(value: number, unit = 'Bytes'): string {
  const match = /^([KMGTPEZY]?)(Bytes|bytes|B|bits|bit|b)(\/s|ps)?$/.exec(unit);
  if (!match) return `${decimalText(value, 2)} ${unit}`;
  const prefixes = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
  const input = prefixes.indexOf(match[1]!);
  const magnitude = Math.abs(value);
  const exponent = magnitude === 0 ? 0 : Math.floor(Math.log2(magnitude) / 10 + input);
  const output = Math.max(0, Math.min(8, exponent));
  const bit = match[2] === 'bit' || match[2] === 'bits' || match[2] === 'b';
  const base = bit ? 'bits' : 'Bytes';
  const suffix = `${output === 0 ? base : `${prefixes[output]}${bit ? 'b' : 'B'}`}${match[3] ? '/s' : ''}`;
  return `${decimalText(value * 1024 ** (input - output), output === 0 ? 0 : 2)} ${suffix}`;
}

function minutesPresentation(value: number): string {
  if (Math.abs(value) < 1000) return `${decimalText(value)}分钟`;
  if (Math.abs(value) < 10000) return `${decimalText(value / 1000, 2)}千分钟`;
  return `${decimalText(value / 10000, 2)}万分钟`;
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
    case 'messages-adaptive': return Math.abs(value) < 10000 ? `${decimalText(value)}条` : `${decimalText(value / 10000, 2)}万条`;
    case 'billing-hours': return `${decimalText(value / 3600, 2)}小时`;
    default: return undefined;
  }
}

export function formatIncludesUnit(format: ValueFormat | undefined): boolean {
  return /^(?:(?:cny|usd)-adaptive(?:-trimmed(?:-no-yuan)?|-km)?|(?:count|resource|bytes|minutes|messages)-adaptive)$/.test(typeof format === 'string' ? format : '') || format === 'billing-hours';
}
