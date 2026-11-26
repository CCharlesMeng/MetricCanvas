import type { CellObject, SheetData } from 'write-excel-file/universal';
import { basicNumberFormat, type ValueFormat } from '@metriccanvas/page/internal';

const MAX_CUSTOM_NUMBER_FORMATS = 200;
const MAX_NUMBER_FORMAT_LENGTH = 254;

interface PrecisionStyle { digits: number; factor: number; integer: string; zero: string }
const precisions = new WeakMap<CellObject, PrecisionStyle>();
const fallbacks = new WeakMap<CellObject, string>();

export function basicWorkbookNumberFormat(format: ValueFormat | undefined, value?: number): string | undefined {
  const options = basicNumberFormat(format);
  if (!options) return undefined;
  if (options.digits === undefined && !options.grouped) return options.signed ? '+General;General;0' : 'General';
  const scientific = options.digits === undefined && value !== undefined && value !== 0 && Math.abs(value) < 1e-6;
  const digits = options.digits ?? 30;
  const base = scientific ? '0.################E+00' : `${options.grouped ? '#,##' : ''}0${digits ? `.${'#'.repeat(digits)}` : ''}`;
  if (!digits && !options.signed) return base;
  return `${options.signed ? '+' : ''}${base};-${base};0`;
}

function* formattedCells(sheets: readonly { data: SheetData }[], signal: AbortSignal) {
  for (const sheet of sheets) for (const row of sheet.data) {
    signal.throwIfAborted();
    for (const cell of row) {
      if (cell && typeof cell === 'object' && 'value' in cell && cell.format) yield cell;
    }
  }
}

/** Reserve dates and standard ratio formats before spending the workbook-wide format budget. */
export function limitWorkbookFormats(sheets: readonly { data: SheetData }[], signal: AbortSignal): number {
  const formats = new Set<string>();
  for (const cell of formattedCells(sheets, signal)) {
    if (cell.value instanceof Date) formats.add(cell.format!);
    const fallback = fallbacks.get(cell);
    if (fallback) formats.add(fallback);
  }
  for (const cell of formattedCells(sheets, signal)) {
    const code = cell.format!;
    if (formats.has(code)) continue;
    if (code.length <= MAX_NUMBER_FORMAT_LENGTH && formats.size < MAX_CUSTOM_NUMBER_FORMATS) {
      formats.add(code);
      continue;
    }
    cell.format = fallbacks.get(cell);
    precisions.delete(cell);
  }
  return MAX_CUSTOM_NUMBER_FORMATS - formats.size;
}

export function registerWorkbookFallback(cell: CellObject, code: string | undefined): CellObject {
  if (code) fallbacks.set(cell, code);
  return cell;
}

/** Metadata stays outside the writer's public cell shape and follows the final physical worksheet. */
export function registerWorkbookPrecision(cell: CellObject, code: string, digits: number | undefined, factor: number, decorate: (code: string) => string): CellObject {
  if (digits === undefined) return cell;
  const integer = code.replace(/\.[#0]+/g, '');
  const unsigned = integer.replace(/[+\-](?=(?:#,##)?(?:0|General))/g, '');
  const zero = unsigned.includes(';') ? unsigned : `${unsigned};${unsigned};${unsigned}`;
  precisions.set(cell, { digits, factor, integer: decorate(integer), zero: decorate(zero) });
  return cell;
}

interface PrecisionGroup { column: string; rows: number[]; precision: PrecisionStyle }

function columnName(index: number): string {
  let name = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + (value - 1) % 26) + name;
  return name;
}

function precisionGroups(data: SheetData): PrecisionGroup[] {
  const groups = new Map<string, PrecisionGroup>();
  data.forEach((row, rowIndex) => row.forEach((cell, column) => {
    if (!cell || typeof cell !== 'object' || !('value' in cell) || !cell.format) return;
    const precision = precisions.get(cell);
    if (!precision) return;
    const key = JSON.stringify([column, precision]);
    const group = groups.get(key) ?? { column: columnName(column), rows: [], precision };
    group.rows.push(rowIndex + 1); groups.set(key, group);
  }));
  return [...groups.values()];
}

function references(group: PrecisionGroup): string {
  const ranges: string[] = [];
  let start = group.rows[0]!, end = start;
  const append = () => ranges.push(start === end ? `${group.column}${start}` : `${group.column}${start}:${group.column}${end}`);
  for (const row of group.rows.slice(1)) {
    if (row === end + 1) end = row;
    else { append(); start = end = row; }
  }
  append();
  return ranges.join(' ');
}

function xmlText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function appendElements(xml: string, tag: string, elements: string[], before: string): string {
  if (!elements.length) return xml;
  const pattern = new RegExp(`<${tag}\\b[^>]*(?:/>|>[\\s\\S]*?</${tag}>)`);
  const existing = pattern.exec(xml)?.[0];
  const contents = existing?.match(/^[^>]*>([\s\S]*)<\/[^>]+>$/)?.[1] ?? '';
  const count = Number(existing?.match(/count="(\d+)"/)?.[1] ?? 0) + elements.length;
  const replacement = `<${tag} count="${count}">${contents}${elements.join('')}</${tag}>`;
  return existing ? xml.replace(existing, () => replacement) : xml.replace(before, () => `${replacement}${before}`);
}

function precisionRules(group: PrecisionGroup, style: (format: string) => number, priority: () => number): string {
  const reference = `${group.column}${group.rows[0]}`;
  const { digits, factor, zero, integer } = group.precision;
  const round = `ROUND(${factor === 1 ? reference : `${reference}*${factor}`},${digits})`;
  const rule = (formula: string, format: string) => `<cfRule type="expression" dxfId="${style(format)}" priority="${priority()}" stopIfTrue="1"><formula>${xmlText(formula)}</formula></cfRule>`;
  return `<conditionalFormatting sqref="${references(group)}">${rule(`${round}=0`, zero)}${digits ? rule(`MOD(${round},1)=0`, integer) : ''}</conditionalFormatting>`;
}

function insertRules(xml: string, rules: string): string {
  const later = /<(?:dataValidations|hyperlinks|printOptions|pageMargins|pageSetup|headerFooter|rowBreaks|colBreaks|drawing|legacyDrawing|picture|tableParts|extLst)\b/.exec(xml);
  const offset = later?.index ?? xml.lastIndexOf('</worksheet>');
  if (offset < 0) throw Error('Invalid workbook worksheet');
  return xml.slice(0, offset) + rules + xml.slice(offset);
}

/** Native conditional number formats remove the decimal point and signed zero after edits too. */
export async function applyWorkbookPrecision(bytes: Uint8Array<ArrayBuffer>, sheets: readonly { data: SheetData }[], remainingFormats: number, signal: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
  if (!remainingFormats) return bytes;
  const groups = sheets.map(sheet => precisionGroups(sheet.data));
  if (!groups.some(group => group.length)) return bytes;
  signal.throwIfAborted();
  const { strFromU8, strToU8, unzipSync, zipSync } = await import('fflate');
  signal.throwIfAborted();
  const files = unzipSync(bytes);
  let styles = strFromU8(files['xl/styles.xml']!);
  const formats = new Map<string, number>();
  const dxfs: string[] = [];
  const numberFormats: string[] = [];
  const firstDxf = Number(styles.match(/<dxfs[^>]*count="(\d+)"/)?.[1] ?? 0);
  let numberId = Math.max(163, ...[...styles.matchAll(/numFmtId="(\d+)"/g)].map(match => Number(match[1]))) + 1;
  const style = (format: string) => {
    if (formats.has(format)) return formats.get(format)!;
    const id = numberId++;
    const item = `<numFmt numFmtId="${id}" formatCode="${xmlText(format)}"/>`;
    const index = firstDxf + dxfs.length;
    formats.set(format, index); numberFormats.push(item); dxfs.push(`<dxf>${item}</dxf>`);
    return index;
  };
  groups.forEach((group, index) => {
    signal.throwIfAborted();
    if (!group.length) return;
    let priority = 0;
    const key = `xl/worksheets/sheet${index + 1}.xml`;
    const rules = group.map(item => {
      const { digits, zero, integer } = item.precision;
      const codes = digits ? new Set([zero, integer]) : new Set([zero]);
      const additions = [...codes].filter(code => !formats.has(code));
      if (numberFormats.length + additions.length > remainingFormats || additions.some(code => code.length > MAX_NUMBER_FORMAT_LENGTH)) return '';
      return precisionRules(item, style, () => ++priority);
    }).join('');
    if (rules) files[key] = strToU8(insertRules(strFromU8(files[key]!), rules));
  });
  if (!numberFormats.length) return bytes;
  styles = appendElements(styles, 'numFmts', numberFormats, '<fonts');
  styles = appendElements(styles, 'dxfs', dxfs, styles.includes('<tableStyles') ? '<tableStyles' : '</styleSheet>');
  files['xl/styles.xml'] = strToU8(styles);
  const result = zipSync(files, { level: 6 });
  signal.throwIfAborted();
  return result;
}
