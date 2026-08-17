import type { TypedError } from '@metriccanvas/page';
import type { RuntimeDataGateway } from '@metriccanvas/runtime';
import type { DataErrorEvent } from './data-error-events';
export type { AiSummaryConfig } from './ai-summary/pangu-sse';
export type { DataErrorEvent } from './data-error-events';

export interface AuthoringComponentLocator {
  sectionId: string;
  componentId: string;
}

/** 内容分区 12 列自动流中的目标插槽；index 范围为 0..components.length。 */
export interface AuthoringDropTarget {
  sectionId: string;
  index: number;
}

export interface AuthoringComponentPosition {
  sectionId: string;
  index: number;
}

/**
 * 创作态内容分区排布。这里只携带稳定身份和组件顺序；组件实体仍取自
 * 已通过正式 Page Schema 的 Runtime document，避免草稿绕过数据编排校验。
 */
export interface AuthoringDraftSection {
  id: string;
  title?: string;
  container?: 'plain' | 'panel' | 'card';
  componentIds: readonly string[];
}

export type NormalizedAuthoringDropTarget =
  | { kind: 'invalid' }
  | { kind: 'unchanged' }
  | { kind: 'move'; destination: AuthoringDropTarget };

/** 把拖拽前的插槽换算为移除 source 后唯一的插入位置。 */
export function normalizeAuthoringDropTarget(
  source: AuthoringComponentPosition,
  destination: AuthoringDropTarget,
  destinationComponentCount: number
): NormalizedAuthoringDropTarget {
  if (
    !Number.isInteger(destination.index) ||
    destination.index < 0 ||
    destination.index > destinationComponentCount
  ) {
    return { kind: 'invalid' };
  }
  if (
    source.sectionId === destination.sectionId &&
    (destination.index === source.index || destination.index === source.index + 1)
  ) {
    return { kind: 'unchanged' };
  }
  return {
    kind: 'move',
    destination: {
      sectionId: destination.sectionId,
      index:
        source.sectionId === destination.sectionId &&
        destination.index > source.index
          ? destination.index - 1
          : destination.index
    }
  };
}

export type AuthoringIntent =
  | { type: 'select_component'; locator: AuthoringComponentLocator }
  | {
      type: 'move_component';
      locator: AuthoringComponentLocator;
      destination: AuthoringDropTarget;
    }
  | {
      type: 'edit_component';
      locator: AuthoringComponentLocator;
      edit: { title?: string; detail?: string; span?: number };
    };

export interface AuthoringOptions {
  selected?: AuthoringComponentLocator;
  /** 允许空内容分区的画布草稿排布；不进入正式页面解析、查询或发布。 */
  draftSections?: readonly AuthoringDraftSection[];
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
