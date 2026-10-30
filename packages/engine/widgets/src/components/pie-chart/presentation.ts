import { resolveComponentValue, type ResolvedComponentValue } from '../../shared/component-value';
import type { CategoryBreakdownProps, FieldValue, PieChartProps, ResolvedFieldDefinition, Row } from '@metriccanvas/page/internal';
import { resolveField, type MainDataSlots, type ResolvedField } from '../../shared/component-data';
import { categoryDomain } from '../../shared/chart-palette';
import { finiteNumber, formatValue } from '../../shared/value-format';

/** One ordered projection for sectors, table rows and click identities. Never mutates the snapshot. */
export function pieRows(data: MainDataSlots, props: PieChartProps): Row[] {
  const value = resolveComponentValue(props, data, props.emptyBehavior);
  const rows = data.main.snapshot.rows.filter(row => finiteNumber(value.read(row)) !== undefined);
  if (props.categoryOrder) return categoryOrderedRows(rows, data, props);
  if (!props.sort) return rows;
  const direction = props.sort === 'asc' ? 1 : -1;
  return rows.sort((a, b) => direction * (Number(value.read(a)) - Number(value.read(b))));
}

function categoryOrderedRows(rows: Row[], data: MainDataSlots, props: PieChartProps): Row[] {
  const category = resolveField(props.categoryField, data);
  const order = new Map(props.categoryOrder!.map((value, index) => [JSON.stringify(value), index]));
  const rank = (row: Row) => order.get(JSON.stringify(row[category.field])) ?? order.size;
  return rows.sort((a, b) => rank(a) - rank(b));
}

/** Fixed category declarations also reserve colors for currently absent categories. */
export function pieCategoryDomain(data: MainDataSlots, props: PieChartProps): string[] {
  const category = resolveField(props.categoryField, data);
  const values = [...(props.categoryOrder ?? []), ...data.main.snapshot.rows.map(row => row[category.field])];
  return categoryDomain(values.map(value => formatValue(value, category.format, category.missingText)));
}

/** 占比标签和图例使用同一份有效数值合计，不依赖图表库预舍入的 percent。 */
export function pieValueTotal(rows: readonly Row[], value: ResolvedComponentValue): number {
  return rows.reduce((sum, row) => sum + (finiteNumber(value.read(row)) ?? 0), 0);
}

/** 百分数使用 0–100 刻度；零合计或非有限合计不产生有效占比。 */
export function piePercentage(value: FieldValue | undefined, total: number): number | null {
  const numeric = finiteNumber(value);
  if (numeric === undefined || !Number.isFinite(total) || total <= 0) return null;
  return numeric / total * 100;
}

type LegendColumn = NonNullable<PieChartProps['legend']>['columns'][number];
interface ProjectedColumn {
  label: string;
  definition: ResolvedFieldDefinition;
  missingText?: string;
  read(row: Row): FieldValue | undefined;
}

function projectedDefinition(resolved: ResolvedField, role: 'dimension' | 'measure'): ResolvedFieldDefinition {
  if (resolved.definition?.role === 'detail') throw new Error('饼图图例只能展示标量字段');
  return {
    ...(resolved.definition ?? { type: role === 'dimension' ? 'string' : 'number', role }),
    defaultFormat: resolved.format
  };
}

function projectColumn(column: LegendColumn, data: MainDataSlots, value: ResolvedComponentValue, total: number): ProjectedColumn {
  if ('field' in column) {
    const resolved = resolveField(column.field, data);
    return {
      label: column.label, missingText: resolved.missingText,
      definition: projectedDefinition(resolved, 'measure'),
      read: row => row[resolved.field]
    };
  }
  return {
    label: column.label,
    definition: { type: 'number', role: 'measure', defaultFormat: column.format ?? 'percent-1' },
    read: row => piePercentage(value.read(row), total)
  };
}

/** Reuse the existing borderless table, with private projection fields closed inside this view. */
export function pieLegendData(data: MainDataSlots, props: PieChartProps) {
  const category = resolveField(props.categoryField, data);
  const value = resolveComponentValue(props, data, props.emptyBehavior);
  const rows = pieRows(data, props);
  const total = pieValueTotal(rows, value);
  const columns = (props.legend?.columns ?? []).map(column => projectColumn(column, data, value, total));
  const fields: Record<string, ResolvedFieldDefinition> = {
    __category: projectedDefinition(category, 'dimension')
  };
  columns.forEach((column, index) => { fields[`__value_${index}`] = column.definition; });
  const legendData: MainDataSlots = { main: {
    fields,
    snapshot: { ...data.main.snapshot, rows: rows.map(row => ({
      __category: row[category.field] ?? null,
      ...Object.fromEntries(columns.map((column, index) => [`__value_${index}`, column.read(row) ?? null]))
    })) }
  } };
  const legendProps: CategoryBreakdownProps = {
    categoryField: { data: 'main', field: '__category', missingText: category.missingText },
    categoryLabel: props.legend?.categoryLabel ?? false,
    swatches: true,
    columns: columns.map((column, index) => ({
      label: column.label,
      field: { data: 'main', field: `__value_${index}`, missingText: column.missingText }
    }))
  };
  const columnPresentation = props.legend?.columns.map(({ unit, align }) => ({ unit, align }));
  return { data: legendData, props: legendProps, columnPresentation };
}
