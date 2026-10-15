import {
  hasQueryFieldMapping, normalizeQueryRows,
  type QueryDataSourceFieldDefinition, type Row
} from '@metriccanvas/page/internal';

/** Reverse the explicit mapping for serialization; compute outputs stay out of initial. */
export function queryRowsFromPageRows(
  rows: readonly Row[], fields: Record<string, QueryDataSourceFieldDefinition>
): Row[] {
  const raw = rows.map((row, rowIndex) => {
    const output: Row = {};
    for (const [id, field] of Object.entries(fields)) {
      if (!hasQueryFieldMapping(field)) continue;
      if (!Object.hasOwn(row, id)) throw Object.assign(new Error(`查询结果第 ${rowIndex + 1} 行缺少声明字段: ${id}（映射 ${field.queryField}）`), { code: 'DQE_FIELD_MAPPING_ERROR' });
      const value = row[id];
      output[field.queryField] = field.type === 'recordList' && Array.isArray(value)
        ? value.map(item => Object.fromEntries(Object.entries(field.items.fields).map(
          ([itemId, itemField]) => [itemField.queryField, item[itemId]]
        ))) : value;
    }
    return output;
  });
  const normalized = normalizeQueryRows(raw, fields);
  if (!normalized.ok) throw Object.assign(new Error(`查询结果不符合字段契约: ${JSON.stringify(normalized.issues[0])}`), { code: 'DQE_ROW_CONTRACT_ERROR' });
  return raw;
}
