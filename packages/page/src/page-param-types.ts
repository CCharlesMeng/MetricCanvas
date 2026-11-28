import type { ValueFormatPreset } from './field';
import type { TimeParamGranularity } from './time-param';

/**
 * Pure leaf type definitions for page parameters and text values.
 * Re-exported by `page-param.ts`.
 */

export type PageParamType = 'string' | 'number' | 'boolean' | 'dimension' | 'time' | 'timeRange';
export type PageParamValue = string | number | boolean | string[] | TimeRangeParamValue;

export interface TimeRangeParamValue {
  start: string;
  end: string;
  granularity?: TimeParamGranularity;
}

/**
 * 参数按用途分层:`query` 下的输入落进 DQE 请求体,`display` 下的只被文本
 * 取值和导航消费。分的是消费位置,不是数据类型——同一个 ID 空间由两层共享,
 * 引用处只写 id,不写所在层。
 */
export interface GroupedPageParams {
  query?: {
    dimensions?: Array<{
      id: string;
      dim_name: string;
      dim_value_list?: string[];
      required?: boolean;
      label?: string;
    }>;
    times?: Array<{
      id: string;
      granularity: TimeParamGranularity;
      start?: string;
      end?: string;
      required?: boolean;
      label?: string;
    }>;
  };
  display?: Array<{
    id: string;
    type: 'string' | 'number' | 'boolean';
    value?: string | number | boolean;
    required?: boolean;
    label?: string;
  }>;
}

export interface PageParamDeclaration {
  id: string;
  type: PageParamType;
  required: boolean;
  /** 仅维度参数支持多值；缺省单值。 */
  multiple?: boolean;
  granularity?: TimeParamGranularity;
  label?: string;
  default?: PageParamValue;
  value?: PageParamValue;
  /** 运行态携带原声明位置和业务维度，不回写文档。 */
  path?: string;
  dimName?: string;
}

/**
 * 文本取值引用:对一个页面参数的整值替换,可携带展示格式。
 * 它不是模板插值——引用处放的就是参数值本身,不参与任何字符串拼接。
 */
export interface TextValueReference {
  param: string;
  format?: ValueFormatPreset;
}

/** 页内可变筛选值的整值引用；与不可变参数引用互斥。 */
export interface FilterTextValueReference {
  filter: string;
  format?: ValueFormatPreset;
}

/** 有序的一层文本片段；不接受表达式、嵌套组合或隐式分隔符。 */
export interface TextValueComposition {
  parts: Array<string | TextValueReference | FilterTextValueReference>;
}

/** 文本取值在物化后统一成为字符串。 */
export type TextValue =
  | string
  | TextValueReference
  | FilterTextValueReference
  | TextValueComposition;

export interface TextValueReferenceUsage {
  path: string;
  reference: TextValueReference;
}

/** 声明位置:查询输入带此前缀,展示输入不带。 */
const QUERY_PARAM_PATH_PREFIX = '/params/query/';

/** 只归一化运行态声明；保存文档维持原来的分层结构。 */
export function pageParamDeclarations(
  params: readonly PageParamDeclaration[] | GroupedPageParams | undefined,
): PageParamDeclaration[] {
  if (!params) return [];
  if (Array.isArray(params)) return [...params];
  const groups = params as GroupedPageParams;
  return [
    ...(groups.query?.dimensions ?? []).map(
      (p, i): PageParamDeclaration => ({
        id: p.id,
        type: 'dimension',
        required: p.required ?? true,
        multiple: true,
        label: p.label,
        dimName: p.dim_name,
        value: p.dim_value_list,
        path: `/params/query/dimensions/${i}`,
      }),
    ),
    ...(groups.query?.times ?? []).map(
      (p, i): PageParamDeclaration => ({
        id: p.id,
        type: 'timeRange',
        required: p.required ?? true,
        granularity: p.granularity,
        label: p.label,
        value:
          p.start === undefined && p.end === undefined
            ? undefined
            : { start: p.start!, end: p.end! },
        path: `/params/query/times/${i}`,
      }),
    ),
    ...(groups.display ?? []).map(
      (p, i): PageParamDeclaration => ({
        id: p.id,
        type: p.type,
        required: p.required ?? true,
        label: p.label,
        value: p.value,
        path: `/params/display/${i}`,
      }),
    ),
  ];
}

/** 声明能否被查询消费:按声明位置判,不按数据类型判。 */
export function isQueryInputDeclaration(declaration: PageParamDeclaration): boolean {
  return declaration.path?.startsWith(QUERY_PARAM_PATH_PREFIX) ?? false;
}
