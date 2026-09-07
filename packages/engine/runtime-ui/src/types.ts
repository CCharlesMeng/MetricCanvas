import type { TypedError } from '@metriccanvas/page';
import type { RuntimeDataGateway } from '../../runtime/src';
import type { DataErrorEvent } from './data-error-events';
export type { AiSummaryConfig } from './ai-summary/pangu-sse';
export type { DataErrorEvent } from './data-error-events';

export interface RuntimeNavigationTarget {
  href: string;
  /** 来源页面 id;宿主用它记录回跳,运行时不维护导航栈。 */
  sourcePageId?: string;
  /** 来源页当前查询串,含筛选与页面参数。 */
  sourceSearch?: string;
}

/** Canvas 等宿主在统一运行时导航接缝上的适配器。 */
export interface RuntimeNavigation {
  replaceSearch?(search: string): void;
  /** 返回 true 表示宿主已接管；否则保留浏览器导航。 */
  navigate?(target: RuntimeNavigationTarget): boolean | void;
  /** 返回宿主记录的来源页；深链由宿主决定是否回退浏览器历史。 */
  back?(): void;
}

export type RuntimeConfigurationErrorCode =
  | 'DATA_GATEWAY_REQUIRED'
  | 'DATA_GATEWAY_INVALID';

export interface RuntimeConfigurationError {
  code: RuntimeConfigurationErrorCode;
  message: string;
}

export type RuntimeViewEvent =
  | { type: 'ready'; pageId: string }
  | { type: 'invalid'; errors: TypedError[] }
  | {
      type: 'configuration-error';
      code: RuntimeConfigurationErrorCode;
      message: string;
    }
  | DataErrorEvent
  | { type: 'filter-change'; search: string }
  | {
      type: 'navigate';
      href: string;
      sourcePageId?: string;
      sourceSearch?: string;
    };

export function configurationError(
  code: RuntimeConfigurationErrorCode,
  message: string
): RuntimeConfigurationError {
  return { code, message };
}

/**
 * 数据网关注入值的结构校验:主查询执行必备;候选值能力是独立端口,
 * 允许缺席(不支持候选值),但声明了就必须是函数(失败关闭)。
 */
export function isDataGateway(value: unknown): value is RuntimeDataGateway {
  return (
    isRecord(value) &&
    typeof value.fetchData === 'function' &&
    (value.fetchDimensionValues === undefined ||
      typeof value.fetchDimensionValues === 'function')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 正式渲染输入；创作行为不属于该 Interface。 */
export interface RuntimeViewProps {
  document: unknown;
  dataGateway?: RuntimeDataGateway;
  aiSummary?: import('./ai-summary/pangu-sse').AiSummaryConfig;
  initialSearch?: string;
  navigation?: RuntimeNavigation;
  onevent?: (event: RuntimeViewEvent) => void;
  /** 精确修订预览标识，仅用于查询诊断定位。 */
  pageRevisionId?: string;
}
