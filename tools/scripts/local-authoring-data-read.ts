import { readPageData, type DataReadOptions } from '../../metriccanvas-authoring/core/page/data-read';
import { queryPage } from './local-authoring-query-budget';
type Json = Record<string, any>;
const readingFlags = ['--at', '--select', '--field', '--source', '--cursor'];

function single(options: Record<string, string[]>, key: string): string | undefined {
  const values = options[key];
  if (values === undefined) return undefined;
  if (values.length !== 1 || !values[0]) throw new TypeError(`Exactly one nonempty ${key} is required`);
  return values[0];
}
export function validateDataReadCommand(command: string, options: Record<string, string[]>): void {
  if (readingFlags.some(flag => options[flag] !== undefined) && command !== 'scan') throw new TypeError('Local reading options are scan-only; report operations retain full-page coverage');
  if (command === 'scan' && !options['--select'] && readingFlags.some(flag => flag !== '--select' && options[flag])) throw new TypeError('Local reading options require --select');
}
export function dataReadOptions(options: Record<string, string[]>): DataReadOptions {
  const limitText = single(options, '--limit'), limit = limitText === undefined ? undefined : Number(limitText);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 30)) throw new TypeError('limit must be 1..30');
  const fields = options['--field'] === undefined ? undefined : [...new Set(options['--field'])];
  if (fields?.some(field => !field)) throw new TypeError('--field must be nonempty');
  return { at: single(options, '--at'), component: single(options, '--component'), select: single(options, '--select')!,
    source: single(options, '--source'), fields, limit, cursor: single(options, '--cursor') };
}
export function readLocalPage(page: Json, schema: Json, options: Record<string, string[]>, pageSha256: string, schemaSha256: string): Json {
  const selection = dataReadOptions(options);
  const result = { ...readPageData(page, schema, selection), pageSha256, schemaSha256 };
  return queryPage(result, selection, 'show', pageSha256 + schemaSha256);
}
