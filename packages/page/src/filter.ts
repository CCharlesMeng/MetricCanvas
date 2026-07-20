/**
 * 筛选器声明:页面级筛选状态 (Filter State) 的 DSL 形态。
 * 页面声明若干筛选器构成共享筛选状态;widget 通过 query.filters.subscribe 订阅,
 * 交互经 interactions.writeFilter 回写。联动只通过筛选状态传递,组件间不直接连线。
 */
export type FilterDeclaration = DimensionFilterDeclaration | TimeRangeFilterDeclaration;

/** 维度筛选器:约束某个维度的取值集合 */
export interface DimensionFilterDeclaration {
  id: string;
  type: 'dimension';
  /** 约束的维度 code,引用数据服务定义的维度;候选值由运行时经数据网关查询 */
  dimension: string;
  /** 筛选器标签,显示于筛选器区 */
  label?: string;
  /** 展示形态:下拉多选(默认)| tab 单选;树选/搜索形态在切片8(#9)以同一契约补齐 */
  display?: 'select' | 'tabs';
  /** 初始选中的维度值;缺省为不筛选 */
  default?: string[];
}

/** 时间范围筛选器:约束查询的时间范围 */
export interface TimeRangeFilterDeclaration {
  id: string;
  type: 'timeRange';
  /** 筛选器标签,显示于筛选器区 */
  label?: string;
  /** 时间精度:date=日期(默认)| datetime=日期时间 */
  precision?: 'date' | 'datetime';
  /** 初始范围:相对预设(按打开时刻解析)或绝对范围;缺省为不筛选 */
  default?: TimeRangePreset | TimeRangeValue;
}

/** 相对时间预设,由运行时在筛选状态初始化时解析为绝对范围 */
export type TimeRangePreset = 'today' | 'last7d' | 'last30d' | 'last90d';

/** 时间范围值:闭区间;date 精度为 YYYY-MM-DD,datetime 精度为 YYYY-MM-DDTHH:mm */
export interface TimeRangeValue {
  from: string;
  to: string;
}
