import type { FilterDeclaration } from '@metriccanvas/page';

/**
 * 筛选栏可见性判定:`visible: false` 的隐藏筛选器仍在筛选状态里生效,
 * 只是不出现控件;一个可见控件都没有时整条筛选栏不渲染。
 * 抽成纯函数使这条判定可测,筛选控件本身保持薄。
 */
export function visibleFilterDeclarations(
  declarations: readonly FilterDeclaration[]
): FilterDeclaration[] {
  return declarations.filter((declaration) => declaration.visible !== false);
}

export function hasVisibleFilters(declarations: readonly FilterDeclaration[]): boolean {
  return visibleFilterDeclarations(declarations).length > 0;
}
