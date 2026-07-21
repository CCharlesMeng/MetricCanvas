/** 页面数据行允许的原始值。复杂对象不是数据源字段值。 */
export type FieldValue = string | number | boolean | null;

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'datetime';
export type FieldRole = 'dimension' | 'metric';

/**
 * 框架内置的封闭格式预设。页面只能引用预设 id，不能携带格式化表达式或任意参数。
 * 后续新增预设是向后兼容变化；改变已有预设含义是破坏性变化。
 */
export type ValueFormatPreset =
  | 'text'
  | 'number'
  | 'number-1'
  | 'number-2'
  | 'number-grouped'
  | 'compact-wan-0'
  | 'compact-wan-1'
  | 'compact-yi-1'
  | 'percent-0'
  | 'percent-1'
  | 'percent-2'
  | 'percent-2-signed'
  | 'date'
  | 'date-month-day';

/** 数据源输出字段契约。 */
export interface FieldDefinition {
  type: FieldType;
  role: FieldRole;
  label?: string;
  format?: ValueFormatPreset;
}

/**
 * 组件字段绑定。字符串简写始终引用 `main` 数据槽；多源组件使用显式数据槽。
 */
export type FieldBinding = string | { data: string; field: string };

export type DataRow = Record<string, FieldValue>;
