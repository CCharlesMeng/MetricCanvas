import type { JsonValue } from '@metriccanvas/page';

/** 脱敏后的占位值:开发期明细里所有业务取值都替换成它。 */
export const DQE_DEV_DETAIL_MASK = '«已脱敏»';

/**
 * 开发期明细记录:一次生效查询执行的脱敏 DQE 项。
 * 它不是生产态查询诊断(DqeDiagnosticRecord)的一部分,只存在于
 * 页面搭建或开发通道;正式渲染通道不得注入或消费(issue #47)。
 */
export interface DqeDevDetailRecord {
  executionId: string;
  recordedAt: string;
  /** 脱敏后的生效 DQE 项:保留指标名、维度名、粒度与结构,业务取值一律替换为掩码。 */
  effectiveItem: JsonValue;
}

export interface DqeDevDetail {
  record(executionId: string, effectiveItem: JsonValue): void;
}

export interface DqeDevDetailConfig {
  /** 环境限制:必须显式声明运行环境,只有 'development' 会产生明细。 */
  environment: string;
  /** 明细去向;由开发工具自行消费,不进入正式渲染通道。 */
  sink: (record: DqeDevDetailRecord) => void;
  /** 采样率,取值 [0, 1],缺省 1(全采)。 */
  sampleRate?: number;
  /** 采样随机源,测试注入以获得确定性。 */
  random?: () => number;
}

/**
 * 创建开发期明细通道。三重闸门:
 * 1. 显式启用——只有调用本工厂并注入网关配置才存在这条通道;
 * 2. 环境限制——environment 不是 'development' 时返回 undefined(失败关闭);
 * 3. 采样——按 sampleRate 决定每次执行是否落明细。
 * 落盘前经 sanitizeDqeDevDetailItem 脱敏。
 */
export function createDqeDevDetail(
  config: DqeDevDetailConfig
): DqeDevDetail | undefined {
  if (config.environment !== 'development') return undefined;
  const sampleRate = clampSampleRate(config.sampleRate ?? 1);
  const random = config.random ?? Math.random;
  return {
    record(executionId, effectiveItem) {
      if (random() >= sampleRate) return;
      config.sink({
        executionId,
        recordedAt: new Date().toISOString(),
        effectiveItem: sanitizeDqeDevDetailItem(effectiveItem)
      });
    }
  };
}

/** 白名单键:值是 Schema 层名称或结构参数,可以保留。 */
const SCALAR_KEEP_KEYS = new Set([
  'dim_name',
  'metric_name',
  'alias',
  'formula',
  'period',
  'operator',
  'is_aggregate',
  'offset',
  'limit'
]);

/** 白名单键:字符串数组元素是指标名/维度名,可以保留。 */
const NAME_LIST_KEYS = new Set(['output_metrics', 'output_dims']);

/**
 * DQE 项脱敏(失败关闭):按白名单保留名称与结构,其余取值一律替换为掩码。
 * 筛选值(dim_value_list、time.start/end)、字段值与任何未知键的取值都会被掩码。
 */
export function sanitizeDqeDevDetailItem(value: JsonValue): JsonValue {
  return sanitizeValue(value, undefined);
}

function sanitizeValue(value: JsonValue, parentKey: string | undefined): JsonValue {
  if (Array.isArray(value)) {
    if (parentKey !== undefined && NAME_LIST_KEYS.has(parentKey)) {
      return value.map((entry) =>
        typeof entry === 'string' ? entry : sanitizeValue(entry, undefined)
      );
    }
    return value.map((entry) =>
      typeof entry === 'object' && entry !== null
        ? sanitizeValue(entry, undefined)
        : DQE_DEV_DETAIL_MASK
    );
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        sanitizeEntry(key, entry as JsonValue)
      ])
    );
  }
  return DQE_DEV_DETAIL_MASK;
}

function sanitizeEntry(key: string, value: JsonValue): JsonValue {
  if (
    SCALAR_KEEP_KEYS.has(key) &&
    (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
  ) {
    return value;
  }
  if (typeof value === 'object' && value !== null) {
    return sanitizeValue(value, key);
  }
  return DQE_DEV_DETAIL_MASK;
}

function clampSampleRate(rate: number): number {
  if (!Number.isFinite(rate)) return 0;
  return Math.min(1, Math.max(0, rate));
}
