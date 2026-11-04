import {
  staticFieldBinding,
  resolveField, type ResolvedField,
  type DataSnapshot,
  type FieldBinding,
  type ResolvedFieldDefinition,
  type Row,
  type ValueFormatPreset,
  type FieldValue
} from '@metriccanvas/page/internal';

export type ReadyDataSnapshot = Extract<DataSnapshot, { status: 'ready' }>;

/** 统一运行时已解析的数据槽：数据快照与其数据源字段契约保持同槽交付。 */
export interface ComponentDataSlot {
  /** Original source state, preserved before the rendering projection erases empty/error. */
  sourceStatus?: DataSnapshot['status'];
  diagnostics?: { componentId?: string; sourceId?: string; snapshot: DataSnapshot };
  snapshot: ReadyDataSnapshot;
  fields: Record<string, ResolvedFieldDefinition>;
}

export type MainDataSlots = { main: ComponentDataSlot };
export type MetricDataSlots = MainDataSlots & {
  compare?: ComponentDataSlot;
  target?: ComponentDataSlot;
};
export type NamedDataSlots = Record<string, ComponentDataSlot | undefined>;


export interface SemanticHtmlFieldPresentation {
  source: string;
  format: ValueFormatPreset | undefined;
  visual: 'signed' | undefined;
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
  return resolvedRow(binding, data, rowIndex)?.[resolved.field] as
    | FieldValue
    | undefined;
}

function resolvedRow(
  binding: FieldBinding,
  data: NamedDataSlots,
  rowIndex: number
): Row | undefined {
  binding=staticFieldBinding(binding);
  const resolved = resolveField(binding, data);
  const rows = data[resolved.data]?.snapshot.rows;
  const selectedIndex =
    typeof binding !== 'string' && binding.match !== undefined
      ? (rows?.findIndex((row) => row[binding.match!.field] === binding.match!.equals) ?? -1)
      : rowIndex;
  return selectedIndex < 0 ? undefined : rows?.[selectedIndex];
}

/** 返回字段绑定实际命中的数据行，供值级交互携带行上下文。 */
export function fieldRow(
  binding: FieldBinding,
  data: NamedDataSlots,
  rowIndex = 0
): Row | undefined {
  binding=staticFieldBinding(binding);
  return resolvedRow(binding, data, rowIndex);
}

export function fieldLabel(binding: FieldBinding, data: NamedDataSlots): string {
  const resolved = resolveField(binding, data);
  return resolved.definition?.label ?? resolved.field;
}

export { resolveField, type ResolvedField } from '@metriccanvas/page/internal';
