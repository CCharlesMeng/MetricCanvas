import type {
  DqeBooleanFilterBinding,
  DqeDimensionFilterBinding,
  DqeFilterBinding,
  DqeNumberRangeFilterBinding,
  DqeTimePointFilterBinding,
} from './query-primitives';

export type {
  DqeBooleanFilterBinding,
  DqeDimensionFilterBinding,
  DqeFilterBinding,
  DqeNumberRangeFilterBinding,
  DqeTimePointFilterBinding,
};

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
