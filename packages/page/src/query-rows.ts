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
  code: 'INVALID_NUMERIC_VALUE' | 'NUMERIC_NULL_NOT_ALLOWED';
  fieldId: string;
  queryField: string;
  itemFieldId?: string;
  itemQueryField?: string;
  count: number;
}

export type QueryRowsNormalizationResult =
  | { ok: true; rows: Row[]; issues: []; warnings?: QueryRowNormalizationWarning[] }
  | { ok: false; issues: QueryRowNormalizationIssue[] };

/**
 * 使用查询字段映射把 DQE 原始结果归一化为稳定页面字段。
 * PageDocument 的内嵌初始行与数据网关的动态响应共用此纯计算接缝;
 * 数值度量先转为有限数字或 null，再按查询结果契约校验。
 * 维度、字段集合、明细结构与日期时间规则仍委托结果字段契约校验 Module。
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
    context: Omit<QueryRowNormalizationWarning, 'code' | 'count'>): unknown => {
    if (field.role !== 'measure' || (field.type !== 'number' && field.type !== 'money')) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    // 不接受 Number('')、布尔、十六进制、千分位与百分号的隐式转换。
    if (typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    if (value !== null || field.nullable === false) {
      const code = value === null ? 'NUMERIC_NULL_NOT_ALLOWED' : 'INVALID_NUMERIC_VALUE';
      const key = JSON.stringify([context.fieldId, context.itemFieldId, code]);
      const warning = warnings.get(key);
      if (warning) warning.count++;
      else warnings.set(key, { ...context, code, count: 1 });
    }
    return null;
  };
  value.forEach((rawRow, rowIndex) => {
    if (!isRecord(rawRow)) {
      issues.push({ code: 'ROW_NOT_OBJECT', rowIndex });
      return;
    }

    const row: Row = {};
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
          : { value: numericValue(rawRow[mapping.queryField], mapping, { fieldId, queryField: mapping.queryField }), issues: [], misses: NO_MISSES };
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
    rows.push(row);
  });

  return issues.length === 0
    ? { ok: true, rows, issues: [], ...(warnings.size ? { warnings: [...warnings.values()] } : {}) }
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
