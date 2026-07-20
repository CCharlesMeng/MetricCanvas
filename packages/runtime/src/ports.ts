import type { EffectiveQuery, Row } from '@metriccanvas/spec-schema';

/**
 * 规格加载端口。一期实现:静态文件;二期实现:平台 API。运行时只依赖此接口。
 * load 返回 unknown:按页面生命周期,加载(②)与校验(③)是两步,
 * 只有通过 spec-schema 校验后才可视为 PageSpec。
 */
export interface SpecProvider {
  load(pageId: string): Promise<unknown>;
  /** 已知页面清单(索引页/路由用),字段从原始规格尽力提取 */
  list(): Promise<Array<{ id: string; title: string; description?: string }>>;
}

/** 表服务端口。由 @metriccanvas/table-service-client 实现(真实/mock),应用壳注入 */
export interface TableServicePort {
  fetchData(query: EffectiveQuery): Promise<Row[]>;
}
