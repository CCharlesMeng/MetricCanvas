import type { RuntimeDataGateway } from '@metriccanvas/runtime';
import type { AiSummaryConfig, RuntimeViewEvent } from '@metriccanvas/runtime-ui';

export interface RuntimeInput {
  document: unknown;
  /** 主查询执行必备;维度候选值端口可选,缺席即筛选候选值不可用。 */
  dataGateway?: RuntimeDataGateway;
  aiSummary?: AiSummaryConfig;
  /** URLSearchParams 形式，不带前导问号。 */
  initialSearch?: string;
}

/**
 * 嵌入 API 的事件面就是统一运行时视图的事件面。
 * 真源在 `@metriccanvas/runtime-ui` 的 `RuntimeViewEvent`(ADR-0025),
 * 这里只保留 embed 的历史公开名,不再逐字段复制。
 */
export type RuntimeEvent = RuntimeViewEvent;

export interface MountOptions extends RuntimeInput {
  onEvent?: (event: RuntimeEvent) => void;
}

export interface RuntimeHandle {
  update(input: RuntimeInput): void;
  destroy(): void;
}
