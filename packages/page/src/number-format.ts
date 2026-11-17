import type { ValueFormat } from './field';

/** Basic number presets share precision, grouping and signs across screen and XLSX. */
export function basicNumberFormat(format: ValueFormat | undefined) {
  if (typeof format !== 'string') return undefined;
  const match = /^number(?:-([0-5]|grouped))?(-ungrouped)?(-signed)?$/.exec(format);
  if (!match) return undefined;
  return {
    digits: match[1] === 'grouped' ? 3 : match[1] === undefined ? undefined : Number(match[1]),
    grouped: !match[2],
    signed: !!match[3]
  };
}
