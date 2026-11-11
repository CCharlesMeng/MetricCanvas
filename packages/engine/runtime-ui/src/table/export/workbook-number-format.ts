import type { CellObject, SheetData } from 'write-excel-file/universal';
import type { ValueFormat } from '@metriccanvas/page/internal';

const precisions = new WeakMap<CellObject, number>();

export function basicWorkbookNumberFormat(format: ValueFormat | undefined): string | undefined {
  if (typeof format !== 'string') return undefined;
  const match = /^number(?:-([0-5]|grouped))?(-signed)?$/.exec(format);
  if (!match) return undefined;
  const digits = match[1] === 'grouped' ? 3 : Number(match[1] ?? 0);
  const base = match[1] === undefined ? 'General' : `${match[1] === 'grouped' ? '#,##' : ''}0${digits ? `.${'#'.repeat(digits)}` : ''}`;
  if (base === 'General') return match[2] ? '+General;General;0' : base;
  if (!digits && !match[2]) return base;
  return `${match[2] ? '+' : ''}${base};-${base};0`;
}

/** Metadata stays outside the writer's public cell shape and follows the final physical worksheet. */
export function registerWorkbookPrecision(cell: CellObject, format: ValueFormat | undefined, displayUnit?: string): CellObject {
  if (typeof cell.value !== 'number' || displayUnit || typeof format !== 'string' || !basicWorkbookNumberFormat(format)) return cell;
  const match = /^number-(grouped|[1-5])(?:-signed)?$/.exec(format);
  if (match) precisions.set(cell, match[1] === 'grouped' ? 3 : Number(match[1]));
  return cell;
}

interface PrecisionGroup { column: string; rows: number[]; digits: number; format: string }

function columnName(index: number): string {
  let name = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + (value - 1) % 26) + name;
  return name;
}

function precisionGroups(data: SheetData): PrecisionGroup[] {
  const groups = new Map<string, PrecisionGroup>();
  data.forEach((row, rowIndex) => row.forEach((cell, column) => {
    if (!cell || typeof cell !== 'object' || !('value' in cell) || !precisions.has(cell)) return;
    const digits = precisions.get(cell)!;
    const key = JSON.stringify([column, digits, cell.format]);
    const group = groups.get(key) ?? { column: columnName(column), rows: [], digits, format: String(cell.format) };
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
  return existing ? xml.replace(existing, replacement) : xml.replace(before, `${replacement}${before}`);
}

function precisionRules(group: PrecisionGroup, style: (format: string) => number, priority: () => number): string {
  const reference = `${group.column}${group.rows[0]}`;
  const integer = group.format.replace(/\.#+/g, '');
  const zero = integer.replace(/[+\-](?=(?:#,##)?(?:0|General))/g, '');
  const rule = (formula: string, format: string) => `<cfRule type="expression" dxfId="${style(format)}" priority="${priority()}" stopIfTrue="1"><formula>${xmlText(formula)}</formula></cfRule>`;
  return `<conditionalFormatting sqref="${references(group)}">${rule(`ROUND(${reference},${group.digits})=0`, zero)}${rule(`MOD(ROUND(${reference},${group.digits}),1)=0`, integer)}</conditionalFormatting>`;
}

function insertRules(xml: string, rules: string): string {
  const later = /<(?:dataValidations|hyperlinks|printOptions|pageMargins|pageSetup|headerFooter|rowBreaks|colBreaks|drawing|legacyDrawing|picture|tableParts|extLst)\b/.exec(xml);
  const offset = later?.index ?? xml.lastIndexOf('</worksheet>');
  if (offset < 0) throw Error('Invalid workbook worksheet');
  return xml.slice(0, offset) + rules + xml.slice(offset);
}

/** Native conditional number formats remove the decimal point and signed zero after edits too. */
export async function applyWorkbookPrecision(bytes: Uint8Array<ArrayBuffer>, sheets: readonly { data: SheetData }[], signal: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
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
    files[key] = strToU8(insertRules(strFromU8(files[key]!), group.map(item => precisionRules(item, style, () => ++priority)).join('')));
  });
  styles = appendElements(styles, 'numFmts', numberFormats, '<fonts');
  styles = appendElements(styles, 'dxfs', dxfs, styles.includes('<tableStyles') ? '<tableStyles' : '</styleSheet>');
  files['xl/styles.xml'] = strToU8(styles);
  const result = zipSync(files, { level: 6 });
  signal.throwIfAborted();
  return result;
}
