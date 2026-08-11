import type { QueryFieldDefinition, QueryScalarFieldDefinition } from './field';
import type { GroupedQueryFields } from './page-document';
import type { TypedError } from './errors';
import {
  normalizeQueryRows,
  type QueryRowNormalizationIssue
} from './query-rows';

export interface MaterializedPageDocument {
  document: unknown;
  errors: TypedError[];
}

/**
 * 把 query 页面数据源中按角色分组的局部显式字段展开，并按 queryField
 * 将 DQE 原始内嵌初始行归一化为稳定页面字段，最终解析为完整 Page。
 * 这是纯计算接缝：不读取局部或跨页定义，不做默认值继承，不修改输入。
 */
export function materializePageDocument(input: unknown): MaterializedPageDocument {
  if (!isRecord(input)) return { document: input, errors: [] };

  // Svelte 等宿主可能把不可信页面文档包成 Proxy；structuredClone 不能复制 Proxy。
  // 页面已经通过结构校验，此处按 JSON 树逐层复制，仍保持不修改输入的纯计算边界。
  const document = cloneJsonTree(input) as Record<string, unknown>;
  const errors: TypedError[] = [];

  if (!isRecord(document.dataSources)) return { document, errors };

  for (const [sourceId, candidate] of Object.entries(document.dataSources)) {
    if (!isRecord(candidate) || !isQuerySource(candidate.source)) continue;
    let fields = candidate.fields as Record<string, QueryFieldDefinition>;

    if (isGroupedQueryFields(candidate.fields)) {
      const grouped = candidate.fields;
      const expanded: Record<string, QueryFieldDefinition> = {};
      expandGroup('dimensions', 'dimension');
      expandGroup('measures', 'measure');
      candidate.fields = expanded;
      fields = expanded;

      function expandGroup(
        groupName: 'dimensions' | 'measures',
        role: QueryScalarFieldDefinition['role']
      ): void {
        const group = grouped[groupName];
        if (!group) return;
        for (const [fieldId, definition] of Object.entries(group)) {
          const path =
            `/dataSources/${escapePointer(sourceId)}/fields/` +
            `${groupName}/${escapePointer(fieldId)}`;
          if (Object.hasOwn(expanded, fieldId)) {
            errors.push(schemaError(path, `页面字段重复声明:${fieldId}`));
            continue;
          }
          if (definition.label === fieldId) {
            errors.push(schemaError(`${path}/label`, `label 与字段 id 相同，应省略:${fieldId}`));
          }
          expanded[fieldId] = { ...definition, role };
        }
      }
    }

    const initial = candidate.source.initial;
    if (!isRecord(initial)) continue;
    const normalized = normalizeQueryRows(initial.rows, fields);
    if (normalized.ok) {
      initial.rows = normalized.rows;
    } else {
      errors.push(
        ...normalized.issues.map((issue) => queryRowIssueError(sourceId, issue))
      );
    }
  }

  return { document, errors };
}

function queryRowIssueError(
  sourceId: string,
  issue: QueryRowNormalizationIssue
): TypedError {
  const rowsPath =
    `/dataSources/${escapePointer(sourceId)}/source/initial/rows`;
  switch (issue.code) {
    case 'ROWS_NOT_ARRAY':
      return schemaError(rowsPath, 'DQE 内嵌初始行必须是数组');
    case 'ROW_NOT_OBJECT':
      return schemaError(`${rowsPath}/${issue.rowIndex}`, 'DQE 内嵌初始行必须是对象');
    case 'MISSING_QUERY_FIELD':
      return schemaError(
        `${rowsPath}/${issue.rowIndex}/${escapePointer(issue.queryField)}`,
        `DQE 内嵌初始行缺少映射字段:${issue.queryField}`
      );
    case 'FIELD_TYPE_MISMATCH':
      return schemaError(
        `${rowsPath}/${issue.rowIndex}/${escapePointer(issue.queryField)}`,
        `DQE 字段 ${issue.queryField} 不符合页面字段 ${issue.fieldId} 的类型 ${issue.expectedType}`
      );
    case 'DETAIL_LIST_TOO_LARGE':
      return schemaError(
        `${rowsPath}/${issue.rowIndex}/${escapePointer(issue.queryField)}`,
        `DQE 嵌套明细字段 ${issue.queryField} 最多允许 ${issue.maximum} 项，实际 ${issue.actualLength} 项`
      );
    case 'SEMANTIC_HTML_TOO_LARGE':
      return schemaError(
        `${rowsPath}/${issue.rowIndex}/${escapePointer(issue.queryField)}`,
        `DQE 语义 HTML 字段 ${issue.queryField} 最多允许 ${issue.maximum} 字符，实际 ${issue.actualLength} 字符`
      );
    case 'DETAIL_ITEM_NOT_OBJECT':
      return schemaError(
        `${rowsPath}/${issue.rowIndex}/${escapePointer(issue.queryField)}/${issue.itemIndex}`,
        `DQE 嵌套明细字段 ${issue.queryField} 的第 ${issue.itemIndex + 1} 项必须是对象`
      );
    case 'MISSING_DETAIL_QUERY_FIELD':
      return schemaError(
        `${rowsPath}/${issue.rowIndex}/${escapePointer(issue.queryField)}/${issue.itemIndex}/${escapePointer(issue.itemQueryField)}`,
        `DQE 嵌套明细项缺少映射字段:${issue.itemQueryField}`
      );
    case 'DETAIL_FIELD_TYPE_MISMATCH':
      return schemaError(
        `${rowsPath}/${issue.rowIndex}/${escapePointer(issue.queryField)}/${issue.itemIndex}/${escapePointer(issue.itemQueryField)}`,
        `DQE 嵌套明细字段 ${issue.itemQueryField} 不符合页面字段 ${issue.itemFieldId} 的类型 ${issue.expectedType}`
      );
  }
}

function isGroupedQueryFields(value: unknown): value is GroupedQueryFields {
  return (
    isRecord(value) &&
    (Object.hasOwn(value, 'dimensions') || Object.hasOwn(value, 'measures'))
  );
}

function isQuerySource(value: unknown): boolean {
  return isRecord(value) && value.type === 'query';
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneJsonTree(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneJsonTree);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, cloneJsonTree(child)])
  );
}

function schemaError(path: string, message: string): TypedError {
  return { type: 'SCHEMA_ERROR', path, message };
}

function escapePointer(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}
