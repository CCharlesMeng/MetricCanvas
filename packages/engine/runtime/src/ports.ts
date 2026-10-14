export type { DataGateway, DataGatewayResult, QueryDiagnosticContext, DimensionValueCandidate, DimensionValuesResult, DimensionValuesRequest, DimensionValuesGateway, RuntimeDataGateway } from '@metriccanvas/data-execution';

/**
 * 页面仓储端口(DDD Repository):按 id 取页面。
 * 一期实现:静态文件;二期实现:平台 API。运行时只依赖此接口。
 * load 返回 unknown:按页面生命周期,加载(②)与校验(③)是两步,
 * 拿到的是不可信页面文档,通过 @metriccanvas/page 校验后才可视为 Page(ADR-0007)。
 */
export interface PageRepository {
  load(pageId: string): Promise<unknown>;
  /** 已知页面清单(索引页/路由用),字段从原始页面文档尽力提取 */
  list(): Promise<Array<{ id: string; title: string; description?: string }>>;
}
