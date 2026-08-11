import { validateCalendarTimeRange } from './filter';
import type {
  DetailRecord,
  FieldDefinition,
  FieldValue,
  QueryFieldDefinition,
  QueryRecordListFieldDefinition,
  ScalarFieldDefinition,
  ScalarFieldValue
} from './field';
import { MAX_DETAIL_RECORDS, MAX_SEMANTIC_HTML_LENGTH } from './field';
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
    }
  | {
      code: 'DETAIL_LIST_TOO_LARGE';
      rowIndex: number;
      fieldId: string;
      queryField: string;
      maximum: number;
      actualLength: number;
    }
  | {
      code: 'SEMANTIC_HTML_TOO_LARGE';
      rowIndex: number;
      fieldId: string;
      queryField: string;
      maximum: number;
      actualLength: number;
    }
  | {
      code: 'DETAIL_ITEM_NOT_OBJECT';
      rowIndex: number;
      fieldId: string;
      queryField: string;
      itemIndex: number;
      value: unknown;
    }
  | {
      code: 'MISSING_DETAIL_QUERY_FIELD';
      rowIndex: number;
      fieldId: string;
      queryField: string;
      itemIndex: number;
      itemFieldId: string;
      itemQueryField: string;
      actualFields: string[];
    }
  | {
      code: 'DETAIL_FIELD_TYPE_MISMATCH';
      rowIndex: number;
      fieldId: string;
      queryField: string;
      itemIndex: number;
      itemFieldId: string;
      itemQueryField: string;
      expectedType: ScalarFieldDefinition['type'];
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
      if (mapping.type === 'recordList') {
        const detail = normalizeDetailList(value, mapping, fieldId, rowIndex);
        if (detail.ok) row[fieldId] = detail.value;
        else issues.push(...detail.issues);
        continue;
      }
      if (
        mapping.type === 'semanticHtml' &&
        typeof value === 'string' &&
        value.length > MAX_SEMANTIC_HTML_LENGTH
      ) {
        issues.push({
          code: 'SEMANTIC_HTML_TOO_LARGE',
          rowIndex,
          fieldId,
          queryField: mapping.queryField,
          maximum: MAX_SEMANTIC_HTML_LENGTH,
          actualLength: value.length
        });
        continue;
      }
      if (!isScalarFieldValue(value) || !matchesFieldValue(value, mapping)) {
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
  if (field.type === 'recordList') {
    return (
      Array.isArray(value) &&
      value.length <= MAX_DETAIL_RECORDS &&
      value.every(
        (item) =>
          isRecord(item) &&
          Object.keys(item).every((key) => Object.hasOwn(field.items.fields, key)) &&
          Object.entries(field.items.fields).every(
            ([itemFieldId, itemField]) =>
              Object.hasOwn(item, itemFieldId) &&
              isScalarFieldValue(item[itemFieldId]) &&
              matchesScalarFieldValue(item[itemFieldId], itemField)
          )
      )
    );
  }
  if (field.type === 'semanticHtml') {
    return typeof value === 'string' && value.length <= MAX_SEMANTIC_HTML_LENGTH;
  }
  if (Array.isArray(value)) return false;
  return matchesScalarFieldValue(value, field);
}

function matchesScalarFieldValue(
  value: ScalarFieldValue,
  field: ScalarFieldDefinition
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

type DetailNormalizationResult =
  | { ok: true; value: DetailRecord[] | null }
  | { ok: false; issues: QueryRowNormalizationIssue[] };

function normalizeDetailList(
  value: unknown,
  mapping: QueryRecordListFieldDefinition,
  fieldId: string,
  rowIndex: number
): DetailNormalizationResult {
  if (value === null && mapping.nullable !== false) return { ok: true, value: null };
  if (!Array.isArray(value)) {
    return {
      ok: false,
      issues: [{
        code: 'FIELD_TYPE_MISMATCH',
        rowIndex,
        fieldId,
        queryField: mapping.queryField,
        expectedType: 'recordList',
        value
      }]
    };
  }
  if (value.length > MAX_DETAIL_RECORDS) {
    return {
      ok: false,
      issues: [{
        code: 'DETAIL_LIST_TOO_LARGE',
        rowIndex,
        fieldId,
        queryField: mapping.queryField,
        maximum: MAX_DETAIL_RECORDS,
        actualLength: value.length
      }]
    };
  }

  const issues: QueryRowNormalizationIssue[] = [];
  const records: DetailRecord[] = [];
  value.forEach((rawItem, itemIndex) => {
    if (!isRecord(rawItem)) {
      issues.push({
        code: 'DETAIL_ITEM_NOT_OBJECT',
        rowIndex,
        fieldId,
        queryField: mapping.queryField,
        itemIndex,
        value: rawItem
      });
      return;
    }
    const record: DetailRecord = {};
    for (const [itemFieldId, itemMapping] of Object.entries(mapping.items.fields)) {
      if (!Object.hasOwn(rawItem, itemMapping.queryField)) {
        issues.push({
          code: 'MISSING_DETAIL_QUERY_FIELD',
          rowIndex,
          fieldId,
          queryField: mapping.queryField,
          itemIndex,
          itemFieldId,
          itemQueryField: itemMapping.queryField,
          actualFields: Object.keys(rawItem)
        });
        continue;
      }
      const itemValue = rawItem[itemMapping.queryField];
      if (
        !isScalarFieldValue(itemValue) ||
        !matchesScalarFieldValue(itemValue, itemMapping)
      ) {
        issues.push({
          code: 'DETAIL_FIELD_TYPE_MISMATCH',
          rowIndex,
          fieldId,
          queryField: mapping.queryField,
          itemIndex,
          itemFieldId,
          itemQueryField: itemMapping.queryField,
          expectedType: itemMapping.type,
          value: itemValue
        });
        continue;
      }
      record[itemFieldId] = itemValue;
    }
    records.push(record);
  });
  return issues.length === 0 ? { ok: true, value: records } : { ok: false, issues };
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return validateCalendarTimeRange({ from: value, to: value }, 'date').length === 0;
}

function isScalarFieldValue(value: unknown): value is ScalarFieldValue {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
