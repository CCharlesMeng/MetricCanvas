import { basicNumberFormat, type ResolvedField, type ValueFormat } from '@metriccanvas/page/internal';
import type { CellObject } from 'write-excel-file/universal';
import { numericScale, type NumericScale } from '../../../../widgets/src/shared/numeric-scale';
import { percentDigits } from '../../../../widgets/src/shared/numeric-presentation';
import { resolvedUnit } from '../../../../widgets/src/shared/field-presentation';
import { basicWorkbookNumberFormat, registerWorkbookFallback, registerWorkbookPrecision } from './workbook-number-format';

interface NumberStyle {
  code: string;
  digits?: number;
  factor?: number;
  suffix?: string;
  percent?: boolean;
  fallback?: string;
}

const scalableDivisors = new Set([1, 1000, 1000000]);

export function literalWorkbookFormat(text: string): string {
  const clean = text.replace(/[\u0000-\u001f\u007f]/g, '');
  return clean ? `"${clean.replaceAll('"', '"\\""')}"` : '';
}

function presentationSuffix(preset: string, displayUnit?: string, space = false): string {
  if (!displayUnit || preset === displayUnit) return `${space && preset ? ' ' : ''}${preset}`;
  const unit = preset && !displayUnit.startsWith(preset) ? `${preset} ${displayUnit}` : displayUnit;
  return ` ${unit}`;
}

function basicStyle(format: ValueFormat | undefined, value: number): NumberStyle | undefined {
  const preset = format ?? 'number';
  const code = basicWorkbookNumberFormat(preset, value);
  if (code === undefined) return undefined;
  const options = basicNumberFormat(preset)!;
  const digits = code.includes('E+') ? undefined : (options.digits ?? (options.grouped ? 30 : 0)) || undefined;
  return { code, digits };
}

function rawScaleUnit(field: ResolvedField, scale: NumericScale, displayUnit?: string): string | undefined {
  if (field.definition?.type === 'money') return field.definition.currency === 'USD' ? '美元' : '元';
  const sourceUnit = resolvedUnit(field);
  if (sourceUnit) return sourceUnit;
  if (typeof field.format === 'string' && field.format.startsWith('cny-')) return '元';
  if (field.format === 'billing-hours') return '秒';
  if (field.format === 'minutes-adaptive') return '分钟';
  if (field.format === 'messages-adaptive') return '条';
  if (scale.unit && displayUnit?.startsWith(scale.unit)) return displayUnit.slice(scale.unit.length).trim() || undefined;
  return undefined;
}

export function workbookColumnUnit(field: ResolvedField, displayUnit?: string): { raw: boolean; unit?: string } {
  const unit = resolvedUnit(field);
  const low = numericScale(field.format, 0, unit);
  const high = numericScale(field.format, Number.MAX_VALUE, unit);
  const unsupported = [low, high].find(scale => scale && !scalableDivisors.has(scale.divisor));
  return unsupported ? { raw: true, unit: rawScaleUnit(field, unsupported, displayUnit) } : { raw: false, unit: displayUnit ?? unit };
}

function scaledStyle(scale: NumericScale, field: ResolvedField, value: number, displayUnit?: string): NumberStyle {
  if (!scalableDivisors.has(scale.divisor)) {
    const unit = rawScaleUnit(field, scale, displayUnit);
    return { ...basicStyle('number', value)!, suffix: unit ? ` ${unit}` : undefined };
  }
  const decimals = scale.digits ? `.${'#'.repeat(scale.digits)}` : '';
  const commas = ','.repeat(Math.log10(scale.divisor) / 3);
  const base = `${scale.grouped ? '#,##' : ''}0${decimals}${commas}`;
  return {
    code: scale.digits ? `${base};-${base};0` : base,
    digits: scale.digits, factor: 1 / scale.divisor, suffix: presentationSuffix(scale.unit, displayUnit, scale.space)
  };
}

function ratioStyle(format: ValueFormat | undefined, value: number): NumberStyle | undefined {
  if (typeof format !== 'string') return undefined;
  if (format === 'points-1-signed') return { code: '+0.#;-0.#;0', digits: 1, suffix: 'P', fallback: '0.0"P"' };
  if (format === 'yoy-p-signed') return { code: '+0;-0;0', digits: 0, factor: 100, percent: true, fallback: '0%' };
  const fixed = /^percent-([012])(-signed)?$/.exec(format);
  if (fixed) return ratioDecimals(Number(fixed[1]), !!fixed[2], '0');
  if (format === 'percent-raw') return { code: 'General', suffix: '%', fallback: '0.00"%"' };
  if (format === 'percent-adaptive' || format === 'percent-adaptive-signed') {
    if (value !== 0 && Math.abs(value) < 1e-20) return { code: '0.################E+00', suffix: '%', fallback: '0.00"%"' };
    return ratioDecimals(percentDigits(Math.abs(value)), format.endsWith('-signed'), '#');
  }
  return undefined;
}

function ratioDecimals(digits: number, signed: boolean, placeholder: string): NumberStyle {
  const base = digits ? `0.${placeholder.repeat(digits)}` : '0';
  return { code: signed ? `+${base};-${base};0` : base, digits, suffix: '%', fallback: '0.00"%"' };
}

function ratioLimit(format: ValueFormat | undefined, value: number): string | undefined {
  const magnitude = Math.abs(value);
  if ((format === 'percent-adaptive' || format === 'percent-adaptive-signed') && magnitude >= 500) return value < 0 ? '<-500%' : '>500%';
  if ((format === 'points-1-signed' && magnitude > 500) || (format === 'yoy-p-signed' && magnitude > 5)) return value < 0 ? '<-500P' : '>500P';
  return undefined;
}

function numberStyle(field: ResolvedField, value: number, displayUnit?: string): NumberStyle {
  const { format } = field;
  const ratio = ratioStyle(format, value);
  if (ratio) return { ...ratio, suffix: ratio.percent ? undefined : presentationSuffix(ratio.suffix ?? '', displayUnit) };
  const scale = numericScale(format, Math.abs(value), resolvedUnit(field));
  if (scale) return scaledStyle(scale, field, value, displayUnit);
  const style = basicStyle(format, value) ?? { code: 'General' };
  return { ...style, suffix: presentationSuffix('', displayUnit) };
}

function decorateNumber(code: string, style: NumberStyle, arrow: string, after: boolean): string {
  const prefix = literalWorkbookFormat(arrow && !after ? `${arrow} ` : '');
  const suffix = literalWorkbookFormat(`${style.suffix ?? ''}${arrow && after ? ` ${arrow}` : ''}`);
  const percent = style.percent ? '%' : '';
  return code.split(';').map(section => `${prefix}${section}${percent}${suffix}`).join(';');
}

export function numericWorkbookCell(value: number, field: ResolvedField, displayUnit: string | undefined, arrow: string, after: boolean): CellObject {
  const style = numberStyle(field, value, displayUnit);
  const limit = ratioLimit(field.format, value);
  if (limit) {
    const label = displayUnit && !limit.endsWith(displayUnit) ? `${limit} ${displayUnit}` : limit;
    const text = !arrow ? label : after ? `${label} ${arrow}` : `${arrow} ${label}`;
    return registerWorkbookFallback({ value, type: Number, format: literalWorkbookFormat(text) }, style.fallback);
  }
  const decorate = (code: string) => decorateNumber(code, style, arrow, after);
  const cell = registerWorkbookFallback({ value, type: Number, format: decorate(style.code) }, style.fallback);
  return registerWorkbookPrecision(cell, style.code, style.digits, style.factor ?? 1, decorate);
}
