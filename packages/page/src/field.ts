/** 页面数据行允许的原始值。复杂对象不是数据源字段值。 */
export type FieldValue = string | number | boolean | null;

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'datetime';
export type FieldRole = 'dimension' | 'metric';

/**
 * 框架内置的封闭格式预设。页面只能引用预设 id，不能携带格式化表达式或任意参数。
 * 后续新增预设是向后兼容变化；改变已有预设含义是破坏性变化。
 */
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

/** 数据源输出字段契约。 */
export interface FieldDefinition {
  type: FieldType;
  role: FieldRole;
  label?: string;
  /**
   * @deprecated schemaVersion 2.0 早期页面把展示格式写在页面数据源字段中。
   * 新页面应写在组件 FieldBinding；统一运行时仅将此字段作为兼容回退。
   */
  format?: ValueFormatPreset;
}

/** 统一运行时归一后的字段契约；defaultFormat 是展示建议，不是数据规则。 */
export interface ResolvedFieldDefinition extends Omit<FieldDefinition, 'format'> {
  defaultFormat?: ValueFormatPreset;
}

/** query 页面数据源对元数据快照字段名称的页面局部覆盖。 */
export interface FieldOverride {
  label?: string;
  /**
   * @deprecated schemaVersion 2.0 早期页面使用；新页面在组件 FieldBinding 写 format。
   */
  format?: ValueFormatPreset;
}

/**
 * 字段引用。字符串简写始终引用 `main` 数据槽；多源场景使用显式数据槽。
 */
export type FieldReference = string | { data: string; field: string };

/**
 * 纯渲染组件的展示字段绑定。format 只控制当前绑定的呈现，
 * 不改变页面数据源字段契约或元数据快照。
 */
export type FieldBinding =
  | string
  | { data: string; field: string; format?: ValueFormatPreset };

export type DataRow = Record<string, FieldValue>;
