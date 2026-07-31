/** 页面数据行允许的原始值。复杂对象不是数据源字段值。 */
export type FieldValue = string | number | boolean | null;

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'datetime';
export type FieldRole = 'dimension' | 'measure';

export const valueFormatPresets = [
  'text',
  'number',
  'number-1',
  'number-2',
  'number-grouped',
  'compact-wan-0',
  'compact-wan-1',
  'compact-yi-1',
  'percent-0',
  'percent-1',
  'percent-2',
  'percent-2-signed',
  'date',
  'date-month-day'
] as const;

export type ValueFormatPreset = (typeof valueFormatPresets)[number];

export function isValueFormatPreset(value: unknown): value is ValueFormatPreset {
  return (
    typeof value === 'string' &&
    (valueFormatPresets as readonly string[]).includes(value)
  );
}

/** 页面数据源输出的稳定结果字段契约。 */
export interface FieldDefinition {
  type: FieldType;
  role: FieldRole;
  label?: string;
  unit?: string;
  nullable?: boolean;
  defaultFormat?: ValueFormatPreset;
}

/** query 页面数据源字段到外部查询响应字段的显式映射。 */
export interface QueryFieldDefinition extends FieldDefinition {
  queryField: string;
}

/** 统一运行时向组件提供的字段契约，不包含外部查询字段名。 */
export type ResolvedFieldDefinition = FieldDefinition;

/** 字段引用。字符串简写始终引用 `main` 数据槽。 */
export type FieldReference = string | { data: string; field: string };

/** 组件字段绑定；format 只控制当前视图。 */
export type FieldBinding =
  | string
  | {
      data: string;
      field: string;
      format?: ValueFormatPreset;
      match?: { field: string; equals: FieldValue };
    };

export type DataRow = Record<string, FieldValue>;
