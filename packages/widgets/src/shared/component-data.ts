import {
  fieldName,
  type DataSnapshot,
  type FieldBinding,
  type ResolvedFieldDefinition,
  type ValueFormatPreset,
  type FieldValue
} from '@metriccanvas/page';

export type ReadyDataSnapshot = Extract<DataSnapshot, { status: 'ready' }>;

/** 统一运行时已解析的数据槽：数据快照与其数据源字段契约保持同槽交付。 */
export interface ComponentDataSlot {
  snapshot: ReadyDataSnapshot;
  fields: Record<string, ResolvedFieldDefinition>;
}

export type MainDataSlots = { main: ComponentDataSlot };
export type MetricDataSlots = MainDataSlots & {
  compare?: ComponentDataSlot;
  target?: ComponentDataSlot;
};
export type NamedDataSlots = Record<string, ComponentDataSlot | undefined>;

export interface ResolvedField {
  data: string;
  field: string;
  definition?: ResolvedFieldDefinition;
  /** 当前组件绑定最终生效的展示格式。 */
  format?: ValueFormatPreset;
}

export interface SemanticHtmlFieldPresentation {
  source: string;
  format: ValueFormatPreset | undefined;
  visual: 'signed' | undefined;
}

/**
 * 字符串字段绑定固定落到 main；显式绑定按命名槽解析。
 * 组件绑定 format 优先于元数据快照或旧页面归一出的 defaultFormat。
 */
export function resolveField(
  binding: FieldBinding,
  data: NamedDataSlots
): ResolvedField {
  const dataName = typeof binding === 'string' ? 'main' : binding.data;
  const field = fieldName(binding);
  const definition = data[dataName]?.fields[field];
  return {
    data: dataName,
    field,
    definition,
    format:
      (typeof binding === 'string' ? undefined : binding.format) ??
      (definition?.role === 'detail' ? undefined : definition?.defaultFormat)
  };
}

/**
 * 把显式支持 semanticHtml/detail 的组件字段收敛成安全渲染组件入参。
 * 本函数不解析内容，也不格式化数值；两项职责仍由 SemanticHtml Module 持有。
 */
export function semanticHtmlFieldPresentation(
  resolved: ResolvedField,
  value: FieldValue | undefined,
  visual?: 'signed'
): SemanticHtmlFieldPresentation | undefined {
  if (
    resolved.definition?.type !== 'semanticHtml' ||
    resolved.definition.role !== 'detail' ||
    typeof value !== 'string'
  ) {
    return undefined;
  }
  return {
    source: value,
    format: resolved.format,
    visual
  };
}

export function fieldValue(
  binding: FieldBinding,
  data: NamedDataSlots,
  rowIndex = 0
): FieldValue | undefined {
  const resolved = resolveField(binding, data);
  const rows = data[resolved.data]?.snapshot.rows;
  const selectedIndex =
    typeof binding !== 'string' && binding.match !== undefined
      ? (rows?.findIndex((row) => row[binding.match!.field] === binding.match!.equals) ?? -1)
      : rowIndex;
  if (selectedIndex < 0) return undefined;
  return rows?.[selectedIndex]?.[resolved.field] as
    | FieldValue
    | undefined;
}

export function fieldLabel(binding: FieldBinding, data: NamedDataSlots): string {
  const resolved = resolveField(binding, data);
  return resolved.definition?.label ?? resolved.field;
}
