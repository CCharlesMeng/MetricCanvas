import type { FieldValue, RankingDetailCardProps } from '@metriccanvas/page';
import type { MainDataSlots, ResolvedField } from '../../shared/component-data';
import { resolveField } from '../../shared/component-data';
import { formatValue, valuePolarity, type ValuePolarity } from '../../shared/value-format';

export interface RankingDetailChange {
  text: string;
  polarity: ValuePolarity;
}

export interface RankingDetailRow {
  rank: number;
  name: string;
  value: string;
  badges: string[];
  change?: RankingDetailChange;
  description?: string;
}

/** 主数据槽顺序即排行顺序；本函数只映射展示字段，不排序也不截断。 */
export function buildRankingDetailRows(
  data: MainDataSlots,
  props: RankingDetailCardProps
): RankingDetailRow[] {
  const name = resolveField(props.nameField, data);
  const value = resolveField(props.valueField, data);
  const change = props.changeField ? resolveField(props.changeField, data) : undefined;
  const badges = (props.badgeFields ?? [])
    .slice(0, 2)
    .map((binding) => resolveField(binding, data));
  const description = props.descriptionField
    ? resolveField(props.descriptionField, data)
    : undefined;

  return data.main.snapshot.rows.map((row, index) => ({
    rank: index + 1,
    name: formatValue(row[name.field], name.format),
    value: formatValue(row[value.field], value.format),
    badges: badges.flatMap((field) => badgeText(row[field.field], field)),
    ...(change
      ? {
          change: {
            text: formatValue(row[change.field], change.format),
            polarity: valuePolarity(row[change.field])
          }
        }
      : {}),
    ...(description && hasDisplayValue(row[description.field])
      ? { description: formatValue(row[description.field], description.format) }
      : {})
  }));
}

function badgeText(value: FieldValue | undefined, field: ResolvedField): string[] {
  return hasDisplayValue(value) ? [formatValue(value, field.format)] : [];
}

function hasDisplayValue(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim().length > 0;
}
