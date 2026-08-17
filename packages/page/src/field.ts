/** 页面数据行允许的标量值。 */
export type ScalarFieldValue = string | number | boolean | null;

/**
 * 嵌套明细字段的单条记录。首期只允许一层对象数组，
 * 对象属性仍是标量，不允许继续嵌套。
 */
export type DetailRecord = Record<string, ScalarFieldValue>;
export type DetailRecordList = DetailRecord[];
export const MAX_DETAIL_RECORDS = 100;
export const MAX_SEMANTIC_HTML_LENGTH = 64_000;

/** 页面数据行允许的字段值。 */
export type FieldValue = ScalarFieldValue | DetailRecordList;

export type StandardFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime';
/** 历史标量类型别名；页面金额合同通过 ScalarFieldDefinition 联合表达。 */
export type FieldType = StandardFieldType;
export type ScalarFieldType = StandardFieldType | 'money';
export type FieldRole = 'dimension' | 'measure' | 'detail';

export const valueFormatPresets = [
  'text',
  'number',
  'number-1',
  'number-2',
  'number-grouped',
  'compact-wan-0',
  'compact-wan-1',
  'compact-yi-1',
  'cny-adaptive',
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

interface FieldMetadata {
  label?: string;
  unit?: string;
  nullable?: boolean;
  defaultFormat?: ValueFormatPreset;
}

export interface StandardScalarFieldDefinition extends FieldMetadata {
  type: StandardFieldType;
  role: 'dimension' | 'measure';
  currency?: never;
}

export interface MoneyFieldDefinition extends FieldMetadata {
  type: 'money';
  role: 'measure';
  currency: 'CNY';
}

export type ScalarFieldDefinition =
  | StandardScalarFieldDefinition
  | MoneyFieldDefinition;

export interface RecordListFieldDefinition
  extends Pick<FieldMetadata, 'label' | 'nullable'> {
  type: 'recordList';
  role: 'detail';
  items: {
    fields: Record<string, ScalarFieldDefinition>;
  };
}

/**
 * DQE 返回的受控语义 HTML。值只承载结构、文本和约定语义类，
 * 具体样式与安全渲染由显式支持该类型的前端 Module 负责。
 */
export interface SemanticHtmlFieldDefinition
  extends Pick<FieldMetadata, 'label' | 'nullable'> {
  type: 'semanticHtml';
  role: 'detail';
}

/** 页面数据源输出的稳定结果字段契约。 */
export type FieldDefinition =
  | ScalarFieldDefinition
  | RecordListFieldDefinition
  | SemanticHtmlFieldDefinition;

export type QueryStandardScalarFieldDefinition = StandardScalarFieldDefinition & {
  queryField: string;
};

export type QueryMoneyFieldDefinition = MoneyFieldDefinition & {
  queryField: string;
};

export type QueryScalarFieldDefinition =
  | QueryStandardScalarFieldDefinition
  | QueryMoneyFieldDefinition;

export interface QueryRecordListFieldDefinition
  extends Omit<RecordListFieldDefinition, 'items'> {
  queryField: string;
  items: {
    fields: Record<string, QueryScalarFieldDefinition>;
  };
}

export interface QuerySemanticHtmlFieldDefinition
  extends SemanticHtmlFieldDefinition {
  queryField: string;
}

/** query 页面数据源字段到外部查询响应字段的显式映射。 */
export type QueryFieldDefinition =
  | QueryScalarFieldDefinition
  | QueryRecordListFieldDefinition
  | QuerySemanticHtmlFieldDefinition;

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
      match?: { field: string; equals: ScalarFieldValue };
    };

export type DataRow = Record<string, FieldValue>;

/**
 * 字段绑定/字段引用 → 页面字段 id:字符串简写与对象形式的统一解包。
 * 这是字段绑定契约的唯一解包实现,消费方不得自写同义函数。
 */
export function fieldName(binding: FieldBinding | FieldReference): string {
  return typeof binding === 'string' ? binding : binding.field;
}
