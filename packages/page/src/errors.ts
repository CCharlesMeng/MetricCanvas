/**
 * 页面与运行时统一错误闭集；同时作为跨语言契约（`contracts/metriccanvas/page/error-types.json`）的运行时真源。
 *
 * 各成员归属层：
 * - `SCHEMA_ERROR`: `@metriccanvas/page` 静态文档结构、能力版本下限及布局/组件/参数/筛选语义校验。
 * - `CHART_OPTION_ERROR`: `@metriccanvas/page` 图表 `echartsOption` 结构、安全与版本规则校验。
 * - `FIELD_CONTRACT_ERROR`: `@metriccanvas/page` 数据行（`inline.rows` / `query.initial.rows`）与 `fields` 结果字段契约校验（缺字段、未声明字段、非空冲突、类型与嵌套明细越界、算子产出混入输入行）。
 * - `QUERY_MAPPING_ERROR`: `@metriccanvas/page` DQE 输出字段与页面 `queryField` 映射契约校验。
 * - `FILTER_BINDING_ERROR`: `@metriccanvas/page` 页面筛选声明与查询 `filterBindings` / `levelQueryFields` 绑定校验。
 * - `DQE_PROTOCOL_ERROR`: DQE 请求/响应协议层错误（创作期校验与跨语言协议诊断边界；查询级运行态同步通过 `QueryErrorCode` 上报）。
 * - `DQE_EXECUTION_ERROR`: `@metriccanvas/engine` 运行期初始化/异步定稿/上下文准备中的 DQE 网关执行失败。
 * - `DATA_CONTEXT_ERROR`: `@metriccanvas/engine` 运行期数据上下文、执行快照、URL/筛选初始化与异步定稿失败，以及创作期数据上下文不足。
 */
export const ERROR_TYPES = [
  'SCHEMA_ERROR',
  'CHART_OPTION_ERROR',
  'FIELD_CONTRACT_ERROR',
  'QUERY_MAPPING_ERROR',
  'FILTER_BINDING_ERROR',
  'DQE_PROTOCOL_ERROR',
  'DQE_EXECUTION_ERROR',
  'DATA_CONTEXT_ERROR',
] as const;

export type ErrorType = (typeof ERROR_TYPES)[number];

export interface TypedError {
  type: ErrorType;
  /** JSON Pointer 定位,如 "/sections/0/components/0/layout/span" */
  path: string;
  message: string;
}
