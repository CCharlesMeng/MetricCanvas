import type { LifecycleErrorCode } from '@metriccanvas/page-lifecycle';

/**
 * 生命周期错误码到 HTTP 状态的单点映射。各路由原有的"找不到 404、其余 409/400"语义
 * 由 `fallback` 保留;这里只新增 `NOT_SUPPORTED → 501`(ADR-0062:Java 页面资产首批未开放
 * 发布 / 回滚 / 历史 / 差异),让界面能把"未开放"与"失败"区分开。
 */
export function lifecycleErrorStatus(code: LifecycleErrorCode, fallback: number): number {
  if (code === 'NOT_SUPPORTED') return 501;
  return fallback;
}
