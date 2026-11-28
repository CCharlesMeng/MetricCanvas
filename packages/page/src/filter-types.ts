import type { TextValue } from './page-param-types';
import type { Condition } from './schema/condition';

/**
 * Pure leaf type definitions for filter declarations, period selections, time modes,
 * finalization defaults, and period comparisons.
 * Re-exported by `filter.ts`, `period-filter.ts`, `time-mode.ts`, `finalization-default.ts`,
 * and `period-comparison.ts`.
 */

export type TimeMode = 'day' | 'month' | 'isoWeek';

export interface FinalizationDefault {
  finalizationName: string;
}
export type FinalizationName = string | string[];

export type PeriodMode = 'year' | 'quarter' | 'month' | 'last12Months';
export type PeriodSelection =
  | { mode: 'year' | 'quarter' | 'month'; value?: string; finalizationName?: FinalizationName }
  | { mode: 'last12Months'; finalizationName?: FinalizationName; anchor?: string };
export type AppliedPeriodSelection =
  | { mode: 'year' | 'quarter' | 'month'; value: string }
  | { mode: 'last12Months'; anchor?: string };

export interface PeriodComparison {
  kind: 'current' | 'previousPeriod' | 'previousYear';
  /** Optional trusted cutoff. Omit to compare the full applied selection without host inputs. */
  fact?: string;
}

/** Shared declaration metadata; no expression or permission inputs. */
export interface TimeAvailability {
  fact: string;
  initial?: 'latest' | 'latestComplete';
  max: 'latest' | 'latestComplete';
  blockMissing?: true;
}

export interface FilterInteractionExtension {
  hint?: TextValue;
  clearOnChangeOf?: string[];
}

export interface DimensionDefaultCondition {
  filter: string;
  part: 'values';
  op: 'containsAny';
  values: string[];
}

export interface DimensionSelectionExtension {
  selection?: {
    mode: 'single' | 'multiple';
    required?: boolean;
    allBehavior?: 'values' | 'unrestricted';
  };
  candidates?: {
    dataSource: string;
    valueField: string;
    labelField?: string;
    parentField?: string;
    levelField?: string;
  };
  options?: Array<{ value: string; label: string; disabled?: boolean }>;
  treeSelection?: 'level' | 'descendants' | 'independent' | 'leaf';
  /** Local candidate search, enabled by default. Introduced in 6.43. */
  searchable?: boolean;
  candidateContext?: { filterIds: string[]; reconcile: 'clear' | 'intersection' };
  candidateWindow?: { unit: 'month'; n: 12; includeCurrent: boolean; anchorFact?: string };
}

/**
 * 筛选器声明:页面级筛选状态 (Filter State) 的 DSL 形态。
 * 闭集六类(ADR-0050):dimension / timeRange / timePoint / boolean / numberRange / search。
 */
export type FilterDeclaration =
  | DimensionFilterDeclaration
  | TimeRangeFilterDeclaration
  | TimePointFilterDeclaration
  | BooleanFilterDeclaration
  | NumberRangeFilterDeclaration
  | SearchFilterDeclaration;

export interface FilterHierarchyLevel {
  id: string;
  /** 该级对应的数据服务维度 code;谓词按当前层级取字段。 */
  dimension: string;
  label?: string;
}

/** 维度筛选器:约束某个维度的取值集合 */
export interface DimensionFilterDeclaration
  extends FilterInteractionExtension,
    DimensionSelectionExtension {
  id: string;
  /** false 关闭本页 URL 读写；省略时按筛选器 id 派生参数名。 */
  urlParams?: false | { value?: string; from?: string; to?: string; level?: string };
  type: 'dimension';
  /** 约束的维度 code,引用数据服务定义的维度;候选值由运行时经数据网关查询 */
  dimension: string;
  /** 筛选器标签,显示于筛选器区 */
  label?: string;
  /** 空选时的控件内文案；缺省为“全部”。 */
  emptyLabel?: string;
  /** 单选层级下拉省略时在树内切层，其他形态缺省 tabs；hidden 由地图等交互切层。 */
  hierarchyPicker?: 'tabs' | 'hidden';
  /**
   * 展示形态,四种共用同一纯渲染契约(候选项/当前值进、变更事件出):
   * select=下拉多选(默认)| tabs=tab 单选 | tree=树形多选(层级按候选值的 '/' 分隔符约定)
   * | search=输入过滤 + 多选
   */
  display?: 'select' | 'tabs' | 'tree' | 'search';
  /** false 时仅作为组件联动使用，不在页面筛选器区呈现控件。 */
  visible?: boolean;
  visibleWhen?: Condition;
  /** 初始选中的维度值;缺省为不筛选 */
  default?: string[];
  /** Apply the declared default on initialization and on a controlling selection change. */
  defaultWhen?: DimensionDefaultCondition;
  /** 只在实例化时读取参数；与default互斥。 */
  initialParam?: string;
  /**
   * 有序层级。取值同时携带选中值与所在层级;层级是查询谓词选字段
   * 与地图当前视角的唯一来源。至少两级。
   */
  hierarchy?: FilterHierarchyLevel[];
  /** 缺省选中的层级 id;省略则取 hierarchy 第一级。 */
  defaultLevel?: string;
  /**
   * 级联:依赖另一个筛选器,候选值按上游当前值收窄。
   * 不改变下游绑定字段,也不让下游出现或消失。只允许依赖一个上游。
   */
  dependsOn?: string;
}

/** 时间范围筛选器:约束查询的时间范围 */
export interface TimeRangeFilterDeclaration extends FilterInteractionExtension {
  id: string;
  /** 显式 URL 参数名；缺省按筛选器 id 派生。 */
  urlParams?: { value?: string; from?: string; to?: string; level?: string };
  type: 'timeRange';
  /** Period picker; omitted preserves the ordinary range editor. */
  display?: 'period' | 'modes';
  /** 自然期间可选模式；单模式隐藏切换栏。 */
  periodModes?: PeriodMode[];
  modes?: Array<{ id: TimeMode; default: TimeRangeValue | RelativeTimeExpression }>;
  defaultMode?: TimeMode;
  presets?: Array<{ id: string; label: string; range: RelativeTimeExpression }>;
  min?: string;
  max?: string;
  blockedRanges?: TimeRangeValue[];
  disableFuture?: boolean;
  availability?: TimeAvailability;
  /** Explicit mode when a page parameter seeds a complete natural period. */
  initialMode?: 'year' | 'quarter' | 'month';
  /** 筛选器标签,显示于筛选器区 */
  label?: string;
  /** 时间精度:date=日期(默认)| datetime=日期时间 */
  precision?: TimeRangePrecision;
  /** 只在实例化时读取 times 参数，与 default 互斥。 */
  initialParam?: string;
  required?: boolean;
  /** false 时仅作为组件联动使用，不在页面筛选器区呈现控件。 */
  visible?: boolean;
  visibleWhen?: Condition;
  /** 初始范围:相对预设、结构化相对时间或绝对范围;缺省为不筛选 */
  default?:
    | TimeRangePreset
    | TimeRangeValue
    | RelativeTimeExpression
    | PeriodSelection
    | FinalizationDefault;
}

export type TimeRangePrecision = 'month' | 'date' | 'datetime';

/** 相对时间预设,由运行时在筛选状态初始化时解析为绝对范围 */
export type TimeRangePreset = 'today' | 'last7d' | 'last30d' | 'last90d';

/** 时间范围值:闭区间;date 精度为 YYYY-MM-DD,datetime 精度为 YYYY-MM-DDTHH:mm */
export interface TimeRangeValue {
  /** Runtime-only for display:modes; ordinary defaults remain plain ranges. */
  mode?: TimeMode;
  from: string;
  to: string;
}

export interface ModeRange extends TimeRangeValue {
  mode?: TimeMode;
}

export type PeriodRange = TimeRangeValue & { selection: AppliedPeriodSelection };

export type RelativeTimeUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';

export type RelativeTimeRange =
  | { kind: 'lastN'; n: number }
  | { kind: 'previousComplete' }
  | { kind: 'currentToDate' };

/**
 * 结构化相对时间表达(ADR-0035):粒度单位 + 区间描述 + 锚点 + 是否包含
 * 当前未完成周期。它是声明式数据,不是表达式字符串。
 */
export interface RelativeTimeExpression {
  unit: RelativeTimeUnit;
  range: RelativeTimeRange;
  includeCurrent: boolean;
  /** 求值锚点,YYYY-MM-DD;省略则取页面打开时刻的本地日期。 */
  anchor?: string;
}

export interface TimePointFilterDeclaration extends FilterInteractionExtension {
  id: string;
  /** 显式 URL 参数名；缺省按筛选器 id 派生。 */
  urlParams?: { value?: string; from?: string; to?: string; level?: string };
  type: 'timePoint';
  label?: string;
  visible?: boolean;
  visibleWhen?: Condition;
  /** 单个时间点的粒度。谓词是等值,不是区间。 */
  granularity: 'month' | 'date';
  max?: string;
  blockedRanges?: TimeRangeValue[];
  availability?: TimeAvailability;
  /** 可选的包含式下限，格式与 granularity 一致（6.24）。 */
  min?: string;
  /** 禁止选择晚于本地当前月份／日期的时间点（6.25）；未声明默认禁止，false 显式放开。 */
  disableFuture?: boolean;
  required?: boolean;
  /** month 为 YYYY-MM,date 为 YYYY-MM-DD */
  default?: string | FinalizationDefault;
  /** 只在实例化时读取参数；与default互斥。引用的 times 参数必须是单点。 */
  initialParam?: string;
}

export interface BooleanFilterDeclaration extends FilterInteractionExtension {
  id: string;
  /** 显式 URL 参数名；缺省按筛选器 id 派生。 */
  urlParams?: { value?: string; from?: string; to?: string; level?: string };
  type: 'boolean';
  /** Dimension overrides while true. key-office/key-national-only/key-rep-only always intersect Region. */
  overridesFilters?: string[];
  label?: string;
  visible?: boolean;
  enabledWhen?: Condition;
  visibleWhen?: Condition;
  /** true 表示打开时勾选;未勾选不占位(无条件)。 */
  default?: boolean;
}

export interface NumberRangeValue {
  from?: number;
  to?: number;
}

export interface NumberRangeFilterDeclaration extends FilterInteractionExtension {
  id: string;
  /** 显式 URL 参数名；缺省按筛选器 id 派生。 */
  urlParams?: { value?: string; from?: string; to?: string; level?: string };
  type: 'numberRange';
  label?: string;
  visible?: boolean;
  visibleWhen?: Condition;
  default?: NumberRangeValue;
  constraints?: { min?: number; max?: number; bounds?: 'strict' | 'inclusive' };
  units?: {
    filterId: string;
    cases: Record<
      string,
      {
        currency: 'CNY' | 'USD';
        label: string;
        scale: number;
        presets?: Array<{ id: string; label: string; range: NumberRangeValue }>;
      }
    >;
  };
  presets?: Array<{ id: string; label: string; range: NumberRangeValue }>;
}

export interface SearchFilterDeclaration extends FilterInteractionExtension {
  id: string;
  /** 显式 URL 参数名；缺省按筛选器 id 派生。 */
  urlParams?: { value?: string; from?: string; to?: string; level?: string };
  type: 'search';
  label?: string;
  visible?: boolean;
  visibleWhen?: Condition;
  default?: string;
}

export interface CalendarTimeRangeIssue {
  /** 单端点错误定位到具体字段;区间或精度一致性错误定位到范围整体 */
  field: 'from' | 'to' | null;
  message: string;
}
