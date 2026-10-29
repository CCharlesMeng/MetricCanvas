import { hasQueryFieldMapping, type QueryDataSourceFieldDefinition } from './field';
import { copyFieldFallback, rowCellFallback, snapshotCellFallbacks } from './cell-fallback';
import { normalizeQueryRows } from './query-rows';
import type { Row } from './snapshot';

/** Recovery keeps raw row slots so offset always advances by the upstream window. */
export function normalizeDisplayQueryRows(value: unknown, fields: Record<string, QueryDataSourceFieldDefinition>, pageFields = false) {
  const input = Array.isArray(value) ? value : [];
  const mappings = pageFields ? pageMappings(fields) : fields;
  const rows = input.map(raw => displayRow(raw, mappings));
  return { rows, ...snapshotCellFallbacks(rows) };
}

function displayRow(raw: unknown, fields: Record<string, QueryDataSourceFieldDefinition>): Row {
  const input = isRecord(raw) ? raw : {};
  const row: Row = {};
  for (const [id, field] of Object.entries(fields)) {
    if (!hasQueryFieldMapping(field)) continue;
    const result = normalizeQueryRows([{ [field.queryField]: input[field.queryField] ?? null }], { [id]: field });
    if (!result.ok) { row[id] = null; continue; }
    row[id] = result.rows[0][id];
    copyFieldFallback(result.rows[0], id, row, id);
    if (rowCellFallback(input as Row, id)) copyFieldFallback(input as Row, id, row, id);
  }
  return row;
}

function pageMappings(fields: Record<string, QueryDataSourceFieldDefinition>): Record<string, QueryDataSourceFieldDefinition> {
  return Object.fromEntries(Object.entries(fields).map(([id, field]) => [id, !hasQueryFieldMapping(field) ? field : field.type === 'recordList'
    ? { ...field, queryField: id, items: {fields:Object.fromEntries(Object.entries(field.items.fields).map(([itemId,item])=>[itemId,{...item,queryField:itemId}]))} }
    : { ...field, queryField: id }]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
