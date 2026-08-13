import type { TypedError } from '@metriccanvas/page';
import type { RuntimeDataGateway } from '@metriccanvas/runtime';
import type { DataErrorEvent } from './data-error-events';
export type { AiSummaryConfig } from './ai-summary/pangu-sse';
export type { DataErrorEvent } from './data-error-events';

export interface AuthoringComponentLocator {
  sectionId: string;
  componentId: string;
}

export type AuthoringIntent =
  | { type: 'select_component'; locator: AuthoringComponentLocator }
  | {
      type: 'move_component';
      locator: AuthoringComponentLocator;
      before: AuthoringComponentLocator;
    }
  | {
      type: 'edit_component';
      locator: AuthoringComponentLocator;
      edit: { title?: string; detail?: string; span?: number };
    };

export interface AuthoringOptions {
  selected?: AuthoringComponentLocator;
  /**
   * 是否在画布内展示选中组件的行内控件条(标题/宽度)。缺省 true 保持
   * canvas 编辑器既有行为;工作台等把编辑收进外部配置面板的宿主传 false,
   * 选中与拖拽交互不受影响。
   */
  inlineControls?: boolean;
  onintent(intent: AuthoringIntent): void;
}

export interface RuntimeNavigationTarget {
  pageId: string;
  /** URLSearchParams 形式，不带前导问号。 */
  search: string;
  href: string;
}

/** Canvas 等宿主在统一运行时导航接缝上的适配器。 */
export interface RuntimeNavigation {
  href(pageId: string, search: string): string;
  replaceSearch(search: string): void;
  navigate(target: RuntimeNavigationTarget): void;
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
  | { type: 'navigate'; pageId: string; search: string };

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
