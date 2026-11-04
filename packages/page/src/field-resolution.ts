/** Shared scalar binding resolution for rendering and authoring; no policy or I/O. */
import { fieldName, staticFieldBinding, type FieldBinding, type ResolvedFieldDefinition, type ValueFormatPreset } from './field';

export type FieldResolutionSlots = Record<string, { fields: Record<string, ResolvedFieldDefinition> } | undefined>;

export interface ResolvedField {
  data: string;
  field: string;
  definition?: ResolvedFieldDefinition;
  /** 当前组件绑定最终生效的展示格式。 */
  format?: ValueFormatPreset;
  missingText?: string;
}


/**
 * 字符串字段绑定固定落到 main；显式绑定按命名槽解析。
 * 组件绑定 format 优先于元数据快照或旧页面归一出的 defaultFormat。
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
      (definition?.role === 'detail' ? undefined : definition?.defaultFormat)
  };
}
