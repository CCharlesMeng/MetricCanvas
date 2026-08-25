import type { FieldDefinition, Row } from '@metriccanvas/page';
import type { FilterValues } from '@metriccanvas/runtime';

/**
 * inline 数据源上的 search 筛选器走客户端:对所有字符串字段做不区分大小写包含。
 * GraphQL 谓词到位后这条路径不再承担查询语义,只服务骨架页。
 */
export function applySearchFilters(
  rows: readonly Row[],
  values: FilterValues,
  fields: Record<string, FieldDefinition>
): Row[] {
  const queries = [...values.values()]
    .filter((value) => value.type === 'search')
    .map((value) => value.query.trim().toLowerCase())
    .filter((query) => query.length > 0);
  if (queries.length === 0) return [...rows];
  const stringFields = Object.entries(fields)
    .filter(([, field]) => field.type === 'string')
    .map(([id]) => id);
  return rows.filter((row) =>
    queries.every((query) =>
      stringFields.some((fieldId) => String(row[fieldId] ?? '').toLowerCase().includes(query))
    )
  );
}
