import type { JsonValue } from '@metriccanvas/page/internal';

/**
 * 开发期查询明细通道的接口。
 *
 * 只有接口留在这里,因为数据网关配置要用它给 `devDetail` 字段命名;实现不随
 * 引擎发布,在平台侧(ADR-0071)。这条通道能取出生效 DQE 项,随包发出等于把该
 * 能力交给任何装了包的集成应用,而正式渲染通道不得注入或消费(issue #47)。
 */
export interface DqeDevDetail {
  record(executionId: string, effectiveItem: JsonValue): void;
}
