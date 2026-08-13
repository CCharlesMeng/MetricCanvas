import type { EffectiveQuery, Row } from '@metriccanvas/page';

export interface DataGatewayResult {
  rows: Row[];
  totalCount?: number;
}

/**
 * 页面仓储端口(DDD Repository):按 id 取看板页面。
 * 一期实现:静态文件;二期实现:平台 API。运行时只依赖此接口。
 * load 返回 unknown:按页面生命周期,加载(②)与校验(③)是两步,
 * 拿到的是不可信页面文档,通过 @metriccanvas/page 校验后才可视为 Page(ADR-0007)。
 */
export interface PageRepository {
  load(pageId: string): Promise<unknown>;
  /** 已知页面清单(索引页/路由用),字段从原始页面文档尽力提取 */
  list(): Promise<Array<{ id: string; title: string; description?: string }>>;
}

/**
 * 查询诊断上下文:一次生效查询执行的定位标识,随查询穿过数据网关端口。
 * 只承载标识(看板页面、页面修订、页面数据源),不承载业务数据;
 * 缺失时诊断记录仍按请求标识定位(issue #47)。
 */
export interface QueryDiagnosticContext {
  pageId?: string;
  pageRevisionId?: string;
  /** 本次执行服务的页面数据源 id;生效查询去重后可能对应多个。 */
  dataSourceIds?: readonly string[];
}

/**
 * 数据网关 (Data Gateway):运行时的取数端口——生效查询进、标准化行与可选总条数出。
 * 按意图命名,不按实现方命名;适配器在 @metriccanvas/data-gateway,应用壳注入。
 * 当前 query 场景由 DQE 适配器实现；inline 静态场景不访问该端口。
 *
 * 主查询执行不假定数据源支持筛选候选值:候选值查询是独立端口
 * DimensionValuesGateway,数据网关可以选择性实现(issue #54)。
 */
export interface DataGateway {
  /**
   * 执行失败时,拒绝原因应携带稳定查询错误分类:错误对象的 `code`
   * 属性取 @metriccanvas/page 的 QueryErrorCode 封闭集(issue #51)。
   * 编排器按结构判别该属性并原样保留进数据快照错误态;未携带分类
   * 的异常兜底为 UNKNOWN。错误消息不得包含查询结果、筛选值、Secret
   * 或上游响应正文(issue #47)。
   *
   * signal 是标准取消信号(issue #53):筛选状态产生新的生效查询或
   * 运行时会话结束时,编排器中止过期执行。适配器必须把信号传递到
   * 底层网络请求,并把中止后的拒绝归类为 DQE_CANCELLED(复用查询
   * 错误分类封闭集,不新造取消分类)。
   */
  fetchData(
    query: EffectiveQuery,
    diagnosticContext?: QueryDiagnosticContext,
    signal?: AbortSignal
  ): Promise<DataGatewayResult>;
}

/**
 * 维度候选值查询的成功结果:真实去重候选值,或该维度的候选值能力不可用。
 * 不可用是显式结果而不是空数组——空数组只表示查询成功且候选为空(issue #54)。
 */
export type DimensionValuesResult =
  | { kind: 'values'; values: string[] }
  | { kind: 'unavailable' };

/**
 * 维度候选值端口 (Dimension Values Gateway):维度筛选器候选项的唯一来源。
 * 候选项是业务数据(随数据演化),不进入 Schema Metadata。
 *
 * 独立于主查询执行端口:不支持候选值的数据网关不实现本接口(能力缺席即
 * 不可用),实现方也可以按维度返回 `unavailable`。执行失败的拒绝原因与
 * fetchData 同纪律:错误对象 `code` 取 QueryErrorCode 封闭集(issue #51),
 * 错误消息与 detail 不携带候选值、筛选值、Secret 或上游响应正文(issue #47)。
 */
export interface DimensionValuesGateway {
  fetchDimensionValues(
    dimension: string,
    options?: { signal?: AbortSignal }
  ): Promise<DimensionValuesResult>;
}

/**
 * 应用壳注入统一运行时的数据网关形状:主查询执行必备,候选值能力可选。
 */
export type RuntimeDataGateway = DataGateway & Partial<DimensionValuesGateway>;
