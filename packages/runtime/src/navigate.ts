import { placeholderDimension, type NavigateTarget, type Row } from '@metriccanvas/page';
import { createFilterState, type FilterValues } from './filter-state';

/**
 * 跨页下钻(生命周期⑨的 navigate 分支):筛选值 + 点击上下文 → 目标页 URL 查询串(不含 '?')。
 * carryFilters 取当前筛选状态值,setFilters 从点击行取占位维度的值;
 * 序列化复用筛选状态 store 的 toURL 编码——目标页生命周期④用同一套 fromURL 恢复,
 * 跨页传参的物理载体是 URL,编解码只有一处实现。
 * 路由拼接(/pages/<id>)属应用壳知识,不在此层。
 */
export function drillThroughSearch(
  navigate: NavigateTarget,
  current: FilterValues,
  row: Row
): string {
  const outgoing = createFilterState();

  for (const filterId of navigate.carryFilters ?? []) {
    const value = current.get(filterId);
    // 当前无值的筛选器不占位:缺席即不筛选,目标页回落到自身 default
    if (value) outgoing.write(filterId, value);
  }

  for (const [filterId, placeholder] of Object.entries(navigate.setFilters ?? {})) {
    const code = placeholderDimension(placeholder);
    const clicked = row[code];
    if (clicked == null) continue;
    outgoing.write(filterId, { type: 'dimension', dimension: code, values: [String(clicked)] });
  }

  return outgoing.toURL();
}
