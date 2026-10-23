import type { TypedError } from '@metriccanvas/page';
import type { RuntimeDataGateway } from '../../runtime/src';
import type { DataErrorEvent } from './data-error-events';
export type { AiSummaryConfig, AiSummaryContextInfo, AiSummaryGenerate, AiSummaryDataSource } from './ai-summary';
export type { DataErrorEvent } from './data-error-events';

export interface RuntimeNavigationTarget {
  href: string;
  /** 来源页面 id;宿主用它记录回跳,运行时不维护导航栈。 */
  sourcePageId?: string;
  /** 来源页当前查询串,含筛选与页面参数。 */
  sourceSearch?: string;
}

/** Canvas 等宿主在统一运行时导航接缝上的适配器。 */
export type {NavigationInputContract} from '../../runtime/src/navigation-inputs';
export interface RuntimeNavigation {
  /** Integrating application may translate a logical page URL into its deployed route. */
  resolveHref?(href:string):string;
  /** Trusted target declaration projection; never loads authorization candidates. */
  resolveTargetInputs?(href:string,options:{signal:AbortSignal}):import('../../runtime/src/navigation-inputs').NavigationInputContract|undefined|Promise<import('../../runtime/src/navigation-inputs').NavigationInputContract|undefined>;
  returnContext?: { entryId: string; label?: string };
  replaceSearch?(search: string): void;
  /** 返回 true 表示宿主已接管；否则保留浏览器导航。 */
  navigate?(target: RuntimeNavigationTarget): boolean | void;
  /** 返回宿主记录的来源页；深链由宿主决定是否回退浏览器历史。 */
  back?(): void;
}

export type RuntimeConfigurationErrorCode =
  | 'DATA_GATEWAY_REQUIRED'
  | 'DATA_GATEWAY_INVALID'
  | 'DISPLAY_INPUTS_CONTEXT_CHANGED'
  | 'DISPLAY_INPUTS_INVALID'
  | 'DISPLAY_PERMISSION_CHANGED';

export interface RuntimeConfigurationError {
  code: RuntimeConfigurationErrorCode;
  message: string;
}

export type RuntimeViewEvent =
  | {type:'navigation-error';href:string;code:'NAVIGATION_INPUT_INVALID'|'NAVIGATION_INPUT_UNAVAILABLE';message:string}
  | { type: 'ready'; pageId: string }
  | { type: 'invalid'; errors: TypedError[] }
  | {
      /** 引擎能力失败，与页面文档校验错误分开；版本均指页面协议版本。 */
      type: 'version-error';
      requiredSchemaVersion: string;
      currentSchemaVersion: string;
      supportedSchemaVersions: string[];
      message: string;
    }
  | {
      type: 'configuration-error';
      code: RuntimeConfigurationErrorCode;
      message: string;
    }
  | DataErrorEvent
  | { type: 'filter-change'; search: string;filterRevision?:number }
  | { type: 'tab-change'; search: string }
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
      typeof value.fetchDimensionValues === 'function') &&
    (value.fetchFilterCandidates === undefined || typeof value.fetchFilterCandidates === 'function') &&
    (value.fetchColumnCandidates === undefined || typeof value.fetchColumnCandidates === 'function')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 正式渲染输入；创作行为不属于该 Interface。 */
export interface RuntimeViewProps {
  displayInputs?: import('../../runtime/src/display-inputs').DisplayInputs;
  document: unknown;

  execution?: import('../../runtime/src').ExecutionBootstrap;
  dataGateway?: RuntimeDataGateway;
  aiSummary?: import('./ai-summary').AiSummaryConfig;
  filterEditing?: { readOnly: boolean; reason?: string };
  initialSearch?: string;
  navigation?: RuntimeNavigation;
  onevent?: (event: RuntimeViewEvent) => void;
  /** 精确修订预览标识，仅用于查询诊断定位。 */
  pageRevisionId?: string;
}
