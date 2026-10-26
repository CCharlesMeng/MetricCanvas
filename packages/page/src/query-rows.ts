import {
  hasQueryFieldMapping,
  type FieldValue,
  type QueryDataSourceFieldDefinition,
  type QueryFieldDefinition,
  type QueryRecordListFieldDefinition
} from './field';
import {
  fieldContractViolations,
  queryResultFieldContract,
  type FieldContractIssue
} from './result-field-contract';
import type { Row } from './snapshot';
import { setRowCellFallbacks, snapshotCellFallbacks, type CellFallbacks, type RowCellFallbacks } from './cell-fallback';

/**
 * 查询结果归一化的问题契约:查询字段映射问题以 DQE 输出字段名定位,
 * 契约违规复用结果字段契约校验 Module 的分类并附映射上下文。
 * 与共享校验一致,不回显业务字段值。
 */
export type QueryRowNormalizationIssue =
  | { code: 'ROWS_NOT_ARRAY' }
  | { code: 'ROW_NOT_OBJECT'; rowIndex: number }
  | {
      code: 'MISSING_QUERY_FIELD';
      rowIndex: number;
      fieldId: string;
      queryField: string;
      actualFields: string[];
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
  | (FieldContractIssue & { queryField: string; itemQueryField?: string });

/** 按字段和原因计数，不保留原始值、数据行或每行告警。 */
export interface QueryRowNormalizationWarning {
  code: 'INVALID_NUMERIC_VALUE' | 'NUMERIC_NULL_NOT_ALLOWED' | 'SCALAR_TYPE_MISMATCH' | 'SCALAR_NULL_NOT_ALLOWED';
  expectedType?: QueryFieldDefinition['type'];
  fieldId: string;
  queryField: string;
  itemFieldId?: string;
  itemQueryField?: string;
  count: number;
}

export type QueryRowsNormalizationResult =
  | { ok: true; rows: Row[]; issues: []; warnings?: QueryRowNormalizationWarning[]; cellFallbacks?: CellFallbacks }
  | { ok: false; issues: QueryRowNormalizationIssue[] };

/**
 * 使用查询字段映射把 DQE 原始结果归一化为稳定页面字段。
 * PageDocument 的内嵌初始行与数据网关的动态响应共用此纯计算接缝;
 * 标量先按结果字段契约归一化；可降级的失配值以 null 加独立展示证据传递。
 * 字段集合、明细结构与安全规则仍委托结果字段契约校验 Module。
 */
export function normalizeQueryRows(
  value: unknown,
  fieldMappings: Record<string, QueryDataSourceFieldDefinition>
): QueryRowsNormalizationResult {
  if (!Array.isArray(value)) {
    return { ok: false, issues: [{ code: 'ROWS_NOT_ARRAY' }] };
  }

  const issues: QueryRowNormalizationIssue[] = [];
  const rows: Row[] = [];
  const contracts = Object.fromEntries(Object.entries(fieldMappings).map(([id, field]) => [id, queryResultFieldContract(field)]));
  const warnings = new Map<string, QueryRowNormalizationWarning>();
  const numericValue = (value: unknown, field: QueryFieldDefinition,
    context: WarningContext): unknown => normalizeNumeric(value, field, context, warnings);
  value.forEach((rawRow, rowIndex) => {
    if (!isRecord(rawRow)) {
      issues.push({ code: 'ROW_NOT_OBJECT', rowIndex });
      return;
    }

    const row: Row = {};
    const fallbacks: RowCellFallbacks = {};
    for (const [fieldId, mapping] of Object.entries(fieldMappings)) {
      // 计算阶段产出字段不来自外部响应,归一化阶段跳过;它们由算子写入。
      if (!hasQueryFieldMapping(mapping)) continue;
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

      const mapped =
        mapping.type === 'recordList'
          ? mapDetailItems(rawRow[mapping.queryField], mapping, rowIndex, fieldId, numericValue)
          : { value: normalizeScalar(rawRow[mapping.queryField], mapping, { fieldId, queryField: mapping.queryField }, warnings, fallbacks), issues: [], misses: NO_MISSES };
      issues.push(...mapped.issues);

      const violations = fieldContractViolations(mapped.value, contracts[fieldId]).filter(
        (violation) =>
          violation.code !== 'DETAIL_MISSING_FIELD' ||
          !mapped.misses.has(`${violation.itemIndex}:${violation.itemFieldId}`)
      );
      if (violations.length === 0 && mapped.issues.length === 0) {
        row[fieldId] = mapped.value as FieldValue;
      }
      issues.push(
        ...violations.map((violation) =>
          withQueryFields({ ...violation, rowIndex, fieldId }, mapping)
        )
      );
    }
    setRowCellFallbacks(row, fallbacks);
    rows.push(row);
  });

  return issues.length === 0
    ? { ok: true, rows, issues: [], ...snapshotCellFallbacks(rows), ...(warnings.size ? { warnings: [...warnings.values()] } : {}) }
    : { ok: false, issues };
}

const NO_MISSES: ReadonlySet<string> = new Set();

interface MappedDetailValue {
  value: unknown;
  issues: QueryRowNormalizationIssue[];
  /** 已作为映射缺失上报的 `${itemIndex}:${itemFieldId}`,契约判定不再重复上报。 */
  misses: ReadonlySet<string>;
}

/**
 * 把嵌套明细的项按项级查询字段映射改写为稳定项字段;未映射的 DQE
 * 追加字段就地丢弃,非对象项原样透传交契约判定裁决。
 */
function mapDetailItems(
  value: unknown,
  mapping: QueryRecordListFieldDefinition,
  rowIndex: number,
  fieldId: string,
  numericValue: (value: unknown, field: QueryFieldDefinition,
    context: Omit<QueryRowNormalizationWarning, 'code' | 'count'>) => unknown
): MappedDetailValue {
  if (!Array.isArray(value)) return { value, issues: [], misses: NO_MISSES };
  const issues: QueryRowNormalizationIssue[] = [];
  const misses = new Set<string>();
  const items = value.map((rawItem, itemIndex) => {
    if (!isRecord(rawItem)) return rawItem;
    const record: Record<string, unknown> = {};
    for (const [itemFieldId, itemMapping] of Object.entries(mapping.items.fields)) {
      if (!Object.hasOwn(rawItem, itemMapping.queryField)) {
        misses.add(`${itemIndex}:${itemFieldId}`);
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
      record[itemFieldId] = numericValue(rawItem[itemMapping.queryField], itemMapping,
        { fieldId, queryField: mapping.queryField, itemFieldId, itemQueryField: itemMapping.queryField });
    }
    return record;
  });
  return { value: items, issues, misses };
}

function withQueryFields(
  issue: FieldContractIssue,
  mapping: QueryFieldDefinition
): QueryRowNormalizationIssue {
  const itemQueryField =
    'itemFieldId' in issue && mapping.type === 'recordList'
      ? mapping.items.fields[issue.itemFieldId]?.queryField
      : undefined;
  return {
    ...issue,
    queryField: mapping.queryField,
    ...(itemQueryField === undefined ? {} : { itemQueryField })
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type WarningContext = Omit<QueryRowNormalizationWarning, 'code' | 'count'>;
type Warnings = Map<string, QueryRowNormalizationWarning>;
function addWarning(warnings: Warnings, code: QueryRowNormalizationWarning['code'], context: WarningContext): void {
  const key = JSON.stringify([context.fieldId, context.itemFieldId, code]);
  const warning = warnings.get(key);
  if (warning) warning.count++;
  else warnings.set(key, { ...context, code, count: 1 });
}
function isNumericMeasure(field: QueryFieldDefinition): boolean {
  return field.role === 'measure' && (field.type === 'number' || field.type === 'money');
}
function finiteNumeric(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
function normalizeNumeric(value: unknown, field: QueryFieldDefinition, context: WarningContext, warnings: Warnings): unknown {
  if (!isNumericMeasure(field)) return value;
  const numeric = finiteNumeric(value);
  if (numeric !== undefined) return numeric;
  if (value !== null || field.nullable === false) addWarning(warnings, value === null ? 'NUMERIC_NULL_NOT_ALLOWED' : 'INVALID_NUMERIC_VALUE', context);
  return null;
}
function displayScalar(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
}
function normalizeScalar(value: unknown, field: QueryFieldDefinition, context: WarningContext, warnings: Warnings, fallbacks: RowCellFallbacks): unknown {
  if (field.type === 'recordList' || field.type === 'semanticHtml') return value;
  const normalized = normalizeNumeric(value, field, context, warnings);
  if (isNumericMeasure(field)) {
    if (normalized === null && displayScalar(value)) fallbacks[context.fieldId] = { raw: value, reason: 'INVALID_NUMERIC_VALUE' };
    return normalized;
  }
  const violations = fieldContractViolations(value, field);
  if (!violations.length) return value;
  if (value == null || (typeof value === 'number' && !Number.isFinite(value))) {
    addWarning(warnings, 'SCALAR_NULL_NOT_ALLOWED', { ...context, expectedType: field.type });
    return null;
  }
  if (!displayScalar(value)) return value;
  fallbacks[context.fieldId] = { raw: value, reason: 'TYPE_MISMATCH' };
  addWarning(warnings, 'SCALAR_TYPE_MISMATCH', { ...context, expectedType: field.type });
  return null;
}
