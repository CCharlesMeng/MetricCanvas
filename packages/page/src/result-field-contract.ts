import { validateCalendarTimeRange } from './filter';
import type {
  FieldDefinition,
  FieldType,
  RecordListFieldDefinition,
  ScalarFieldDefinition,
  SemanticHtmlFieldDefinition
} from './field';
import { MAX_DETAIL_RECORDS, MAX_SEMANTIC_HTML_LENGTH } from './field';

/**
 * 结果字段契约校验 Module:字段类型、nullable 语义、日期时间规则与
 * 明细约束的唯一实现。看板页面的 inline 数据校验(validate.ts)与
 * 查询结果归一化(query-rows.ts,服务内嵌初始行与数据网关)都引用
 * 这里,两条路径不得各自维护字段类型判断。
 *
 * 校验错误只携带行号、字段名、错误分类与预期类型,不回显业务字段值。
 */

/** 单个字段值违反结果字段契约的结构化描述(不含原始字段值)。 */
export type FieldContractViolation =
  | { code: 'NULL_NOT_ALLOWED'; expectedType: FieldDefinition['type'] }
  | { code: 'TYPE_MISMATCH'; expectedType: FieldDefinition['type'] }
  | { code: 'DETAIL_LIST_TOO_LARGE'; maximum: number; actualLength: number }
  | { code: 'SEMANTIC_HTML_TOO_LARGE'; maximum: number; actualLength: number }
  | { code: 'DETAIL_ITEM_NOT_OBJECT'; itemIndex: number }
  | { code: 'DETAIL_UNDECLARED_FIELD'; itemIndex: number; itemFieldId: string }
  | { code: 'DETAIL_MISSING_FIELD'; itemIndex: number; itemFieldId: string }
  | {
      code: 'DETAIL_NULL_NOT_ALLOWED';
      itemIndex: number;
      itemFieldId: string;
      expectedType: FieldType;
    }
  | {
      code: 'DETAIL_TYPE_MISMATCH';
      itemIndex: number;
      itemFieldId: string;
      expectedType: FieldType;
    };

/** 定位到行与页面字段的契约违规。 */
export type FieldContractIssue = FieldContractViolation & {
  rowIndex: number;
  fieldId: string;
};

/** 行集校验问题:行形状、字段集合与字段值契约。 */
export type RowContractIssue =
  | { code: 'ROWS_NOT_ARRAY' }
  | { code: 'ROW_NOT_OBJECT'; rowIndex: number }
  | { code: 'UNDECLARED_FIELD'; rowIndex: number; fieldId: string }
  | { code: 'MISSING_FIELD'; rowIndex: number; fieldId: string }
  | FieldContractIssue;

export type RowContractValidationResult =
  | { ok: true; issues: [] }
  | { ok: false; issues: RowContractIssue[] };

/**
 * 共享校验公开接口:接收结果字段契约与未知数据行,返回一致的成功
 * 或结构化失败结果。数据行必须已处于稳定页面字段空间(inline 行
 * 天然如此;查询结果先经查询字段映射归一化再进入本判定)。
 */
export function validateContractRows(
  rows: unknown,
  fields: Record<string, FieldDefinition>
): RowContractValidationResult {
  if (!Array.isArray(rows)) {
    return { ok: false, issues: [{ code: 'ROWS_NOT_ARRAY' }] };
  }
  const issues: RowContractIssue[] = [];
  rows.forEach((row, rowIndex) => {
    if (!isRecord(row)) {
      issues.push({ code: 'ROW_NOT_OBJECT', rowIndex });
      return;
    }
    for (const key of Object.keys(row)) {
      if (!Object.hasOwn(fields, key)) {
        issues.push({ code: 'UNDECLARED_FIELD', rowIndex, fieldId: key });
      }
    }
    for (const [fieldId, field] of Object.entries(fields)) {
      if (!Object.hasOwn(row, fieldId)) {
        issues.push({ code: 'MISSING_FIELD', rowIndex, fieldId });
        continue;
      }
      issues.push(
        ...fieldContractViolations(row[fieldId], field).map((violation) => ({
          ...violation,
          rowIndex,
          fieldId
        }))
      );
    }
  });
  return issues.length === 0 ? { ok: true, issues: [] } : { ok: false, issues };
}

/** 单个字段值对契约的全部违规;空数组表示符合契约。 */
export function fieldContractViolations(
  value: unknown,
  field: FieldDefinition
): FieldContractViolation[] {
  switch (field.type) {
    case 'recordList':
      return recordListViolations(value, field);
    case 'semanticHtml':
      return semanticHtmlViolations(value, field);
    default:
      return scalarFieldViolations(value, field);
  }
}

/** 字段值是否符合契约的布尔简写,供组件字段绑定字面量等点位使用。 */
export function matchesFieldValue(
  value: unknown,
  field: FieldDefinition
): boolean {
  return fieldContractViolations(value, field).length === 0;
}

function scalarFieldViolations(
  value: unknown,
  field: ScalarFieldDefinition
): FieldContractViolation[] {
  const verdict = scalarVerdict(value, field);
  if (verdict === null) return [];
  return verdict === 'null'
    ? [{ code: 'NULL_NOT_ALLOWED', expectedType: field.type }]
    : [{ code: 'TYPE_MISMATCH', expectedType: field.type }];
}

function recordListViolations(
  value: unknown,
  field: RecordListFieldDefinition
): FieldContractViolation[] {
  if (value === null) {
    return field.nullable !== false
      ? []
      : [{ code: 'NULL_NOT_ALLOWED', expectedType: 'recordList' }];
  }
  if (!Array.isArray(value)) {
    return [{ code: 'TYPE_MISMATCH', expectedType: 'recordList' }];
  }
  if (value.length > MAX_DETAIL_RECORDS) {
    return [
      {
        code: 'DETAIL_LIST_TOO_LARGE',
        maximum: MAX_DETAIL_RECORDS,
        actualLength: value.length
      }
    ];
  }
  const violations: FieldContractViolation[] = [];
  value.forEach((item, itemIndex) => {
    if (!isRecord(item)) {
      violations.push({ code: 'DETAIL_ITEM_NOT_OBJECT', itemIndex });
      return;
    }
    for (const key of Object.keys(item)) {
      if (!Object.hasOwn(field.items.fields, key)) {
        violations.push({
          code: 'DETAIL_UNDECLARED_FIELD',
          itemIndex,
          itemFieldId: key
        });
      }
    }
    for (const [itemFieldId, itemField] of Object.entries(field.items.fields)) {
      if (!Object.hasOwn(item, itemFieldId)) {
        violations.push({ code: 'DETAIL_MISSING_FIELD', itemIndex, itemFieldId });
        continue;
      }
      const verdict = scalarVerdict(item[itemFieldId], itemField);
      if (verdict === 'null') {
        violations.push({
          code: 'DETAIL_NULL_NOT_ALLOWED',
          itemIndex,
          itemFieldId,
          expectedType: itemField.type
        });
      } else if (verdict === 'type') {
        violations.push({
          code: 'DETAIL_TYPE_MISMATCH',
          itemIndex,
          itemFieldId,
          expectedType: itemField.type
        });
      }
    }
  });
  return violations;
}

function semanticHtmlViolations(
  value: unknown,
  field: SemanticHtmlFieldDefinition
): FieldContractViolation[] {
  if (value === null) {
    return field.nullable !== false
      ? []
      : [{ code: 'NULL_NOT_ALLOWED', expectedType: 'semanticHtml' }];
  }
  if (typeof value !== 'string') {
    return [{ code: 'TYPE_MISMATCH', expectedType: 'semanticHtml' }];
  }
  if (value.length > MAX_SEMANTIC_HTML_LENGTH) {
    return [
      {
        code: 'SEMANTIC_HTML_TOO_LARGE',
        maximum: MAX_SEMANTIC_HTML_LENGTH,
        actualLength: value.length
      }
    ];
  }
  return [];
}

const DATETIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/;

function scalarVerdict(
  value: unknown,
  field: ScalarFieldDefinition
): 'null' | 'type' | null {
  if (value === null) return field.nullable !== false ? null : 'null';
  if (field.type === 'date') {
    return typeof value === 'string' && isCalendarDate(value) ? null : 'type';
  }
  if (field.type === 'datetime') {
    return typeof value === 'string' && DATETIME_PATTERN.test(value)
      ? null
      : 'type';
  }
  if (field.type === 'money') {
    return typeof value === 'number' && Number.isFinite(value)
      ? null
      : 'type';
  }
  return typeof value === field.type ? null : 'type';
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return validateCalendarTimeRange({ from: value, to: value }, 'date').length === 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
