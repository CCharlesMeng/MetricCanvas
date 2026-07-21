import type {
  DataSnapshot,
  FieldBinding,
  FieldDefinition,
  FieldValue
} from '@metriccanvas/page';

export type ReadyDataSnapshot = Extract<DataSnapshot, { status: 'ready' }>;

/** 统一运行时已解析的数据槽：数据快照与其数据源字段契约保持同槽交付。 */
export interface ComponentDataSlot {
  snapshot: ReadyDataSnapshot;
  fields: Record<string, FieldDefinition>;
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
  definition?: FieldDefinition;
}

/** 字符串字段绑定固定落到 main；显式绑定按命名槽解析。 */
export function resolveField(
  binding: FieldBinding,
  data: NamedDataSlots
): ResolvedField {
  const dataName = typeof binding === 'string' ? 'main' : binding.data;
  const field = typeof binding === 'string' ? binding : binding.field;
  return {
    data: dataName,
    field,
    definition: data[dataName]?.fields[field]
  };
}

export function fieldValue(
  binding: FieldBinding,
  data: NamedDataSlots,
  rowIndex = 0
): FieldValue | undefined {
  const resolved = resolveField(binding, data);
  return data[resolved.data]?.snapshot.rows[rowIndex]?.[resolved.field] as
    | FieldValue
    | undefined;
}

export function fieldLabel(binding: FieldBinding, data: NamedDataSlots): string {
  const resolved = resolveField(binding, data);
  return resolved.definition?.label ?? resolved.field;
}
