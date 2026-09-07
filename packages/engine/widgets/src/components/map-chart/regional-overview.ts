import type { MapSafeArea } from './options';

/**
 * 地域概览注释帧由运行时安全区派生，页面只选择呈现档，不声明坐标。
 * 横向保留设计档的最大宽度；纵向则占满安全区余高，使地图与相邻 Tab
 * 共用同一条底边，短表由 Tab 的固定高度自然留下底部空间。
 */
export function regionalOverviewFrameStyle(safeArea?: MapSafeArea): string {
  if (!safeArea) return 'right:33px;bottom:0;width:980px;height:502px;';
  return (
    `left:${safeArea.x + 40}px;` +
    `top:${safeArea.y + 22}px;` +
    `width:${Math.min(980, Math.max(0, safeArea.width - 72))}px;` +
    `height:${Math.max(0, safeArea.height - 22)}px;`
  );
}
