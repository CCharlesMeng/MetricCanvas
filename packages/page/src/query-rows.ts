import { validateCalendarTimeRange } from './filter';
import type {
  FieldDefinition,
  FieldValue,
  QueryFieldDefinition
} from './field';
import type { Row } from './snapshot';

export type QueryRowNormalizationIssue =
  | { code: 'ROWS_NOT_ARRAY'; actual: unknown }
  | { code: 'ROW_NOT_OBJECT'; rowIndex: number; actual: unknown }
  | {
      code: 'MISSING_QUERY_FIELD';
      rowIndex: number;
      fieldId: string;
      queryField: string;
      actualFields: string[];
    }
  | {
      code: 'FIELD_TYPE_MISMATCH';
      rowIndex: number;
      fieldId: string;
      queryField: string;
      expectedType: FieldDefinition['type'];
      value: unknown;
    };

export type QueryRowsNormalizationResult =
  | { ok: true; rows: Row[]; issues: [] }
  | { ok: false; issues: QueryRowNormalizationIssue[] };

/**
 * 使用查询字段映射把 DQE 原始结果归一化为稳定页面字段。
 * PageDocument 的内嵌初始行与数据网关的动态响应共用此纯计算接缝。
 */
export function normalizeQueryRows(
  value: unknown,
  fieldMappings: Record<string, QueryFieldDefinition>
): QueryRowsNormalizationResult {
  if (!Array.isArray(value)) {
    return { ok: false, issues: [{ code: 'ROWS_NOT_ARRAY', actual: value }] };
  }

  const issues: QueryRowNormalizationIssue[] = [];
  const rows: Row[] = [];
  value.forEach((rawRow, rowIndex) => {
    if (!isRecord(rawRow)) {
      issues.push({ code: 'ROW_NOT_OBJECT', rowIndex, actual: rawRow });
      return;
    }

    const row: Row = {};
    for (const [fieldId, mapping] of Object.entries(fieldMappings)) {
      if (!Object.hasOwn(rawRow, mapping.queryField)) {
        issues.push({
          code: 'MISSING_QUERY_FIELD',
          rowIndex,
          fieldId,
          queryField: mapping.queryField,
          actualFields: Object.keys(rawRow)
        });
        continue;
      }

      const value = rawRow[mapping.queryField];
      if (!isFieldValue(value) || !matchesFieldValue(value, mapping)) {
        issues.push({
          code: 'FIELD_TYPE_MISMATCH',
          rowIndex,
          fieldId,
          queryField: mapping.queryField,
          expectedType: mapping.type,
          value
        });
        continue;
      }
      row[fieldId] = value;
    }
    rows.push(row);
  });

  return issues.length === 0
    ? { ok: true, rows, issues: [] }
    : { ok: false, issues };
}

export function matchesFieldValue(
  value: FieldValue,
  field: FieldDefinition
): boolean {
  if (value === null) return field.nullable !== false;
  if (field.type === 'date') {
    return typeof value === 'string' && isCalendarDate(value);
  }
  if (field.type === 'datetime') {
    return (
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(value)
    );
  }
  return typeof value === field.type;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return validateCalendarTimeRange({ from: value, to: value }, 'date').length === 0;
}

function isFieldValue(value: unknown): value is FieldValue {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
