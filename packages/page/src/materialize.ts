import type { QueryFieldDefinition } from './field';
import type { GroupedQueryFields } from './page-document';
import type { TypedError } from './errors';

export interface MaterializedPageDocument {
  document: unknown;
  errors: TypedError[];
}

/**
 * 把 query 页面数据源中按角色分组的局部显式字段解析为完整 Page。
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
    if (!isGroupedQueryFields(candidate.fields)) continue;

    const grouped = candidate.fields;
    const expanded: Record<string, QueryFieldDefinition> = {};
    expandGroup('dimensions', 'dimension');
    expandGroup('measures', 'measure');
    candidate.fields = expanded;

    function expandGroup(
      groupName: 'dimensions' | 'measures',
      role: QueryFieldDefinition['role']
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

  return { document, errors };
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
