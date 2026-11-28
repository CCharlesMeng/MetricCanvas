import type { ObjectTimeTarget } from './dqe-object';
import type { PeriodComparison } from './period-comparison';
import type { PeriodQueryPolicy } from './period-query';
import type { Condition } from './schema/condition';
import type { TimeWindow } from './time-param';

/**
 * 维度筛选绑定的两支(ADR-0084):
 * - `queryField` 服务扁平维度筛选器,谓词字段恒定;
 * - `levelQueryFields` 服务层级维度筛选器,按当前层级 id 取谓词字段。
 *
 * 层级筛选器的取值在不同层级属于不同维度(全球用地理编码、代表处用代表处
 * 编码),恒定字段会把下层取值下推到上层字段上,产出静默错数据。因此两支
 * 互斥,层级筛选器必须逐级声明,缺级在校验期就拒绝。
 */
export type DqeDimensionFilterBinding = (
  | { target: 'dimension'; queryField: string }
  | { target: 'dimension'; levelQueryFields: Record<string, string> }
) & {
  /** Inclusion by default; != excludes every selected value. */
  operator?: '=' | '!=';
  /** Filter-only condition; suspends this predicate without clearing its stored choice. */
  when?: Condition;
};

/**
 * 非维度筛选器的绑定目标(ADR-0085)。三类各自的谓词形状不同,因此各是一支,
 * 不共用 `queryField` 一个字段名就算完:
 * - `timePoint` 是时间点等值,落在维度谓词上;取值格式必须显式声明,
 *   因为筛选状态写的是 `YYYY-MM`,而数据列常是 `YYYYMM`。
 * - `boolean` 勾选与否不对称:勾上加条件,不勾默认无条件;要筛"为假"必须
 *   显式声明 `whenFalse`,不由运行时取反。
 * - `numberRange` 落在 `filter.metrics` 上,两端各自可缺席。
 */
export type DqeTimePointFilterBinding = {
  target: 'timePoint';
  queryField: string;
  /** iso 原样送 YYYY-MM / YYYY-MM-DD(默认);compact 去掉分隔符。 */
  valueFormat?: 'iso' | 'compact';
};

export type DqeBooleanFilterBinding = {
  target: 'boolean';
  queryField: string;
  whenTrue: string[];
  whenFalse?: string[];
};

export type DqeNumberRangeFilterBinding = {
  target: 'numberRange';
  metric?: string;
  metricByFilter?: { filterId: string; cases: Record<string, string> };
};

export type DqeFilterBinding =
  | DqeDimensionFilterBinding
  | ({
      target: 'time';
      window?: TimeWindow;
      periodPolicy?: PeriodQueryPolicy;
      periodComparison?: PeriodComparison;
    } & ObjectTimeTarget)
  | DqeTimePointFilterBinding
  | DqeBooleanFilterBinding
  | DqeNumberRangeFilterBinding;

/** 时间点取值按绑定声明的格式落到谓词上;不猜数据列用的是哪种写法。 */
export function timePointPredicateValue(
  value: string,
  format: DqeTimePointFilterBinding['valueFormat'],
): string {
  return format === 'compact' ? value.replaceAll('-', '') : value;
}

export function isLevelDimensionBinding(
  binding: DqeFilterBinding,
): binding is { target: 'dimension'; levelQueryFields: Record<string, string> } {
  return binding.target === 'dimension' && 'levelQueryFields' in binding;
}

/**
 * 绑定在给定层级上生效的谓词字段。层级绑定缺少当前层级时返回 undefined,
 * 调用方据此整条跳过下推——宁可不筛,也不换个字段冒充。
 */
export function bindingQueryField(binding: DqeFilterBinding, levelId?: string): string | undefined {
  if (binding.target !== 'dimension') return undefined;
  if (!isLevelDimensionBinding(binding)) return binding.queryField;
  return levelId === undefined ? undefined : binding.levelQueryFields[levelId];
}

/** 绑定可能下推的全部谓词字段(层级绑定即各级字段),用于与其它绑定查重。 */
export function bindingQueryFields(binding: DqeFilterBinding): string[] {
  if (binding.target !== 'dimension') return [];
  return isLevelDimensionBinding(binding)
    ? Object.values(binding.levelQueryFields)
    : [binding.queryField];
}
