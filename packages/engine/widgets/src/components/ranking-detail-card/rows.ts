import type {
  DetailRecord,
  FieldValue,
  RankingDetailCardProps,
  RecordListFieldDefinition,
  Row
} from '@metriccanvas/page';
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
  semanticDescription?: string;
  details?: {
    defaultExpanded: boolean;
    items: RankingDetailNestedItem[];
  };
}

export interface RankingDetailNestedItem {
  title: string;
  value?: string;
  description?: string;
}

type RecordListDetailsProps = NonNullable<RankingDetailCardProps['details']>;

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
  const semanticDescription = props.semanticDescriptionField
    ? resolveField(props.semanticDescriptionField, data)
    : undefined;
  const details = props.details ? resolveField(props.details.field, data) : undefined;

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
      : {}),
    ...(semanticDescription
      ? buildSemanticDescription(row, semanticDescription)
      : {}),
    ...(props.details && details
      ? buildNestedDetails(row, details, props.details)
      : {})
  }));
}

function buildSemanticDescription(
  row: Row,
  resolved: ResolvedField
): Pick<RankingDetailRow, 'semanticDescription'> {
  const value = row[resolved.field];
  if (typeof value !== 'string' || value.trim().length === 0) return {};
  return { semanticDescription: value };
}

function buildNestedDetails(
  row: Row,
  resolved: ResolvedField,
  props: RecordListDetailsProps
): Pick<RankingDetailRow, 'details'> {
  const value = row[resolved.field];
  if (!Array.isArray(value) || value.length === 0) return {};
  const definition = resolved.definition?.type === 'recordList'
    ? resolved.definition
    : undefined;
  const items = value.map((item) => nestedItem(item, definition, props));
  return {
    details: {
      defaultExpanded: props.defaultExpanded ?? false,
      items
    }
  };
}

function nestedItem(
  item: DetailRecord,
  definition: RecordListFieldDefinition | undefined,
  props: RecordListDetailsProps
): RankingDetailNestedItem {
  const titleDefinition = definition?.items.fields[props.titleField];
  const title = formatValue(item[props.titleField], titleDefinition?.defaultFormat);
  const valueField = props.valueField;
  const descriptionField = props.descriptionField;
  return {
    title,
    ...(valueField
      ? {
          value: formatValue(
            item[valueField.field],
            valueField.format ?? definition?.items.fields[valueField.field]?.defaultFormat
          )
        }
      : {}),
    ...(descriptionField && hasDisplayValue(item[descriptionField])
      ? {
          description: formatValue(
            item[descriptionField],
            definition?.items.fields[descriptionField]?.defaultFormat
          )
        }
      : {})
  };
}

function badgeText(value: FieldValue | undefined, field: ResolvedField): string[] {
  return hasDisplayValue(value) ? [formatValue(value, field.format)] : [];
}

function hasDisplayValue(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim().length > 0;
}
