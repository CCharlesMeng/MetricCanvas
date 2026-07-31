import type { TypedError } from '@metriccanvas/page';
import type {
  AuthoringComponentLocator,
  AuthoringIntent,
  DataGateway
} from '@metriccanvas/runtime';

export interface AuthoringOptions {
  selected?: AuthoringComponentLocator;
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
  | { type: 'filter-change'; search: string }
  | { type: 'navigate'; pageId: string; search: string };

export function configurationError(
  code: RuntimeConfigurationErrorCode,
  message: string
): RuntimeConfigurationError {
  return { code, message };
}

export function isDataGateway(value: unknown): value is DataGateway {
  return (
    isRecord(value) &&
    typeof value.fetchData === 'function' &&
    typeof value.fetchDimensionValues === 'function'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
