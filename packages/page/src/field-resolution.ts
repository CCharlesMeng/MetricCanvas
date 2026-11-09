/** Shared scalar binding resolution and trusted presentation defaults; no I/O. */
import { fieldName, staticFieldBinding, type FieldBinding, type ResolvedFieldDefinition, type ValueFormat } from './field';
import { semanticValueFormat } from './semantic-format';

export type FieldResolutionSlots = Record<string, { fields: Record<string, ResolvedFieldDefinition> } | undefined>;

export interface ResolvedField {
  data: string;
  field: string;
  definition?: ResolvedFieldDefinition;
  /** 当前组件绑定最终生效的展示格式。 */
  format?: ValueFormat;
  missingText?: string;
}


/**
 * 字符串字段绑定固定落到 main；显式绑定按命名槽解析。
 * 组件显式 format 优先，其次可信字段语义，最后回退来源 defaultFormat。
 */
export function resolveField(
  binding: FieldBinding,
  data: FieldResolutionSlots
): ResolvedField {
  binding=staticFieldBinding(binding);
  const dataName = typeof binding === 'string' ? 'main' : binding.data;
  const field = fieldName(binding);
  const definition = data[dataName]?.fields[field];
  return {
    data: dataName,
    field,
    definition,
    missingText: typeof binding === 'string' ? undefined : binding.missingText,
    format:
      (typeof binding === 'string' ? undefined : binding.format) ??
      semanticValueFormat(definition) ??
      (definition?.role === 'detail' ? undefined : definition?.defaultFormat)
  };
}
