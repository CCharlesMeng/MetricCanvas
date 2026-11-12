import type { ValueFormat } from '@metriccanvas/page/internal';
import { adaptiveMoneyScale } from './adaptive-money-format';

export interface NumericScale { divisor: number; unit: string; digits: number; grouped: boolean; space?: boolean }
const scale = (divisor: number, unit: string, digits: number): NumericScale => ({ divisor, unit, digits, grouped: true });
const fixed: Readonly<Record<string, NumericScale>> = {
  'compact-wan-0': scale(1e4, '万', 0), 'compact-wan-1': scale(1e4, '万', 1),
  'compact-million-0': scale(1e6, '百万', 0), 'compact-million-1': scale(1e6, '百万', 1),
  'compact-million-2': scale(1e6, '百万', 2), 'compact-yi-1': scale(1e8, '亿', 1),
  'billing-hours': scale(3600, '小时', 2)
};

function cnyScale(magnitude: number, mobile: boolean): NumericScale {
  if (magnitude < 1e4) return scale(1, '元', 0);
  if (magnitude < 1e5) return scale(1e4, '万', mobile ? 1 : 2);
  if (magnitude < 1e8) return scale(1e4, '万', 0);
  if (magnitude < 1e9) return scale(1e8, '亿', 2);
  return scale(1e8, '亿', 1);
}

function usdScale(magnitude: number): NumericScale {
  if (magnitude < 1e4) return scale(1, '美元', 0);
  if (magnitude < 1e6) return scale(1e3, 'K', 1);
  if (magnitude < 1e8) return scale(1e3, 'K', 0);
  return scale(1e6, 'M', 0);
}

function countScale(magnitude: number, unit: string): NumericScale {
  return magnitude < 1e4 ? scale(1, unit, 0) : scale(1e4, `万${unit}`, magnitude < 1e5 ? 1 : 0);
}

function resourceScale(magnitude: number, unit: string): NumericScale {
  if (magnitude < 1e4) return scale(1, unit, 0);
  return magnitude < 1e8 ? scale(1e4, `万${unit}`, 2) : scale(1e8, `亿${unit}`, 2);
}

function minuteScale(magnitude: number): NumericScale {
  if (magnitude < 1000) return scale(1, '分钟', 0);
  return magnitude < 10000 ? scale(1000, '千分钟', 2) : scale(10000, '万分钟', 2);
}

function byteScale(magnitude: number, unit: string): NumericScale {
  const match = /^([KMGTPEZY]?)(Bytes|bytes|B|bits|bit|b)(\/s|ps)?$/.exec(unit);
  if (!match) return { ...scale(1, unit, 2), space: true };
  const prefixes = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
  const input = prefixes.indexOf(match[1]!);
  const exponent = magnitude === 0 ? 0 : Math.floor(Math.log2(magnitude) / 10 + input);
  const output = Math.max(0, Math.min(8, exponent));
  const bit = ['bit', 'bits', 'b'].includes(match[2]!);
  const suffix = output === 0 ? (bit ? 'bits' : 'Bytes') : `${prefixes[output]}${bit ? 'b' : 'B'}`;
  return { ...scale(1024 ** (output - input), `${suffix}${match[3] ? '/s' : ''}`, output === 0 ? 0 : 2), space: true };
}

const adaptive: Readonly<Record<string, (magnitude: number, unit: string, mobile: boolean) => NumericScale>> = {
  'cny-adaptive': (magnitude, _unit, mobile) => cnyScale(magnitude, mobile),
  'usd-adaptive': magnitude => usdScale(magnitude),
  'count-adaptive': countScale, 'resource-adaptive': resourceScale,
  'bytes-adaptive': (magnitude, unit) => byteScale(magnitude, unit || 'Bytes'),
  'minutes-adaptive': minuteScale,
  'messages-adaptive': magnitude => magnitude < 10000 ? scale(1, '条', 0) : scale(10000, '万条', 2)
};

/** Select a scale independently from rendering text, so an axis can freeze it for every tick. */
export function numericScale(format: ValueFormat | undefined, magnitude: number, unit = '', mobile = false): NumericScale | undefined {
  if (typeof format !== 'string') return undefined;
  if (fixed[format]) return fixed[format];
  if (format === 'cny-adaptive-trimmed' || format === 'cny-adaptive-trimmed-no-yuan' || format === 'usd-adaptive-km') {
    return { ...adaptiveMoneyScale(format, magnitude), grouped: true };
  }
  return adaptive[format]?.(magnitude, unit, mobile);
}
