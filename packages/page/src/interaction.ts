/**
 * widget 交互声明:组件事件如何作用于筛选状态。
 * 页面只声明"点击写哪个筛选器、取什么值",事件捕获与回写/跳转动作全部由运行时执行,
 * 组件保持纯渲染(ADR-0003)。
 * 执行顺序语义:同一 widget 的多个交互按声明顺序执行;navigate 命中即终止
 * (跳转离页后,本页的后续回写不再有意义),writeFilter 可多条依次执行。
 */
export type WidgetInteraction = WriteFilterInteraction | NavigateInteraction;

/** 页内下钻:点击回写筛选状态,联动其它订阅 widget */
export interface WriteFilterInteraction {
  on: 'click';
  /** 回写目标筛选器 id,须为页面声明的 dimension 型筛选器 */
  writeFilter: string;
  /** 取值占位:$dimension.<code>,运行时从点击上下文取该维度的值 */
  value: string;
}

/** 跨页下钻:点击跳转目标页并经 URL 携带筛选条件,目标页按生命周期④从 URL 恢复 */
export interface NavigateInteraction {
  on: 'click';
  navigate: NavigateTarget;
}

export interface NavigateTarget {
  /** 目标看板页面 id;存在性属仓库知识,由 validate CLI 跨文档校验 */
  page: string;
  /** 携带的本页筛选器 id 列表,取其当前值写入目标页同名筛选器 */
  carryFilters?: string[];
  /** 用点击上下文写入目标页筛选器:{ 目标筛选器 id: "$dimension.<code>" } */
  setFilters?: Record<string, string>;
}

/** 取值占位解析的唯一实现:校验器与运行时共用,防止两处各自切字符串产生分歧 */
export function placeholderDimension(value: string): string {
  return value.slice('$dimension.'.length);
}
