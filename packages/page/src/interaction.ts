/**
 * widget 交互声明:组件事件如何作用于筛选状态。
 * 页面只声明"点击写哪个筛选器、取什么值",事件捕获与回写动作全部由运行时执行,
 * 组件保持纯渲染(ADR-0003)。navigate 跨页下钻在切片7(#8)加入联合类型。
 */
export type WidgetInteraction = WriteFilterInteraction;

/** 页内下钻:点击回写筛选状态,联动其它订阅 widget */
export interface WriteFilterInteraction {
  on: 'click';
  /** 回写目标筛选器 id,须为页面声明的 dimension 型筛选器 */
  writeFilter: string;
  /** 取值占位:$dimension.<code>,运行时从点击上下文取该维度的值 */
  value: string;
}
