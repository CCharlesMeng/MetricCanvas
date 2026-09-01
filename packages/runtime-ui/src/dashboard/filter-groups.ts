import type { FilterDeclaration } from '@metriccanvas/page';
import { visibleFilterDeclarations } from '../filters/filter-bar';

export interface DashboardFilterGroups {
  primary: FilterDeclaration[];
  overflow: FilterDeclaration[];
  content: FilterDeclaration[];
}

const STANDARD_INLINE_LIMIT = 5;
const STANDARD_PRIMARY_COUNT = 4;

/**
 * 标准 dashboard 工具栏的信息架构策略。
 *
 * 少量筛选全部常驻；密集筛选把 search 还给内容区，其余条件保留前四项，
 * 剩余条件交给工具栏披露层。compact 是只读单行呈现，保持全部可见声明，
 * 不复用标准工具栏策略。
 */
export function dashboardFilterGroups(
  declarations: readonly FilterDeclaration[],
  variant?: 'compact'
): DashboardFilterGroups {
  const visible = visibleFilterDeclarations(declarations);
  if (variant === 'compact' || visible.length <= STANDARD_INLINE_LIMIT) {
    return { primary: visible, overflow: [], content: [] };
  }
  const content = visible.filter((declaration) => declaration.type === 'search');
  const toolbar = visible.filter((declaration) => declaration.type !== 'search');
  if (toolbar.length <= STANDARD_INLINE_LIMIT) {
    return { primary: toolbar, overflow: [], content };
  }
  return {
    primary: toolbar.slice(0, STANDARD_PRIMARY_COUNT),
    overflow: toolbar.slice(STANDARD_PRIMARY_COUNT),
    content
  };
}
