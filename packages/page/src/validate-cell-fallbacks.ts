import type { CellFallbacks, ScalarDisplayFallback } from './cell-fallback';
import type { FieldDefinition } from './field';
import type { Row } from './snapshot';
import { normalizeQueryRows } from './query-rows';
import type { TypedError } from './errors';

function validFallback(field: FieldDefinition, value: ScalarDisplayFallback): boolean {
  if (field.type === 'recordList' || field.type === 'semanticHtml') return false;
  const normalized = normalizeQueryRows([{ raw: value.raw }], { cell: { ...field, queryField: 'raw' } });
  if (!normalized.ok || normalized.rows[0].cell !== null) return false;
  return normalized.cellFallbacks?.[0]?.cell?.reason === value.reason;
}
/** Authored evidence must describe an actual missing typed cell, never override a valid cell. */
export function cellFallbackErrors(rows: readonly Row[], fields: Record<string, FieldDefinition>, evidence: CellFallbacks | undefined, path: string): TypedError[] {
  const errors: TypedError[] = [];
  for (const [index, cells] of Object.entries(evidence ?? {})) {
    const row = rows[Number(index)];
    for (const [id, fallback] of Object.entries(cells)) {
      if (row && row[id] === null && fields[id] && validFallback(fields[id], fallback)) continue;
      errors.push({ type: 'SCHEMA_ERROR', path: path + '/' + index + '/' + id, message: '原文证据必须对应有效行中真实失配的空标量单元格' });
    }
  }
  return errors;
}
