import {
  isValueFormatPreset,
  type CatalogSnapshot,
  type FieldType,
  type TypedError
} from '@metriccanvas/page';
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
  | 'CATALOG_REQUIRED'
  | 'CATALOG_INVALID'
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

export function isCatalogSnapshot(value: unknown): value is CatalogSnapshot {
  if (
    !isRecord(value) ||
    (value.formatVersion !== '1.0' && value.formatVersion !== '2.0') ||
    typeof value.syncedAt !== 'string' ||
    typeof value.source !== 'string' ||
    !Array.isArray(value.metrics) ||
    !Array.isArray(value.dimensions)
  ) {
    return false;
  }

  return (
    value.metrics.every(
      (metric) =>
        isRecord(metric) &&
        typeof metric.code === 'string' &&
        typeof metric.name === 'string' &&
        (metric.valueType === 'integer' ||
          metric.valueType === 'decimal' ||
          metric.valueType === 'percent') &&
        isOptionalFormat(metric.defaultFormat) &&
        isOptionalFormat(metric.format) &&
        isStringArray(metric.availableDimensions) &&
        isStringArray(metric.availableAggregations)
    ) &&
    value.dimensions.every(
      (dimension) =>
        isRecord(dimension) &&
        typeof dimension.code === 'string' &&
        typeof dimension.name === 'string' &&
        isOptionalFieldType(dimension.valueType) &&
        isOptionalFormat(dimension.defaultFormat) &&
        isOptionalFormat(dimension.format) &&
        typeof dimension.cardinality === 'number' &&
        Number.isInteger(dimension.cardinality) &&
        dimension.cardinality >= 0 &&
        (dimension.sampleValues === undefined ||
          isStringArray(dimension.sampleValues))
    )
  );
}

function isOptionalFieldType(value: unknown): value is FieldType | undefined {
  return (
    value === undefined ||
    value === 'string' ||
    value === 'number' ||
    value === 'boolean' ||
    value === 'date' ||
    value === 'datetime'
  );
}

function isOptionalFormat(
  value: unknown
): value is CatalogSnapshot['metrics'][number]['defaultFormat'] | undefined {
  return value === undefined || isValueFormatPreset(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
