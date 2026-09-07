import type { CategoryBreakdownProps } from '@metriccanvas/page';
import type { MainDataSlots } from '../../shared/component-data';
import { fieldLabel, resolveField } from '../../shared/component-data';
import { formatValue } from '../../shared/value-format';
import {
  categoricalColor,
  categoryDomain,
  type ColorList
} from '../../shared/chart-palette';

export interface CategoryBreakdownRow {
  /** 类别列的展示文本;同时是取色的定位量。 */
  category: string;
  /** 类别色点;未开启色点、色板缺席或类别不在域内均缺席。 */
  swatch?: string;
  /** 逐列的展示文本,顺序与 `columns` 一致。 */
  values: string[];
}

export interface CategoryBreakdownView {
  /**
   * 类别列列头。缺席即这一列不要列头(`categoryLabel: false`);
   * 声明了文本就用文本,没声明则取字段自己的 label。
   */
  categoryLabel?: string;
  /** 度量列列头。 */
  columns: string[];
  rows: CategoryBreakdownRow[];
}

/**
 * 主数据槽 → 分类明细的行列投影。行序即数据槽行序,本函数不排序也不截断。
 *
 * **色点按类别取值取色,不按行序取色**(ADR-0053):类别域按类别在数据里
 * 首次出现的顺序定,与并排饼图算的是同一个域(`pieOption` 用同一对
 * `categoryDomain` / `categoricalColor`),所以同一个类别在两处取到同一个颜色。
 * 换成「第 n 行取第 n 个色」两边也能各自自洽,但数据顺序一变就静默错位。
 */
export function categoryBreakdownView(
  data: MainDataSlots,
  props: CategoryBreakdownProps,
  palette?: ColorList
): CategoryBreakdownView {
  const category = resolveField(props.categoryField, data);
  const columns = props.columns.map((column) => ({
    label: column.label,
    resolved: resolveField(column.field, data)
  }));
  const rows = data.main.snapshot.rows;
  const categories = rows.map((row) =>
    formatValue(row[category.field], category.format)
  );
  const domain = categoryDomain(categories);
  const categoryLabel =
    props.categoryLabel === false
      ? undefined
      : (props.categoryLabel ?? fieldLabel(props.categoryField, data));

  return {
    ...(categoryLabel === undefined ? {} : { categoryLabel }),
    columns: columns.map((column) => column.label),
    rows: rows.map((row, index) => {
      const name = categories[index] ?? '';
      const swatch =
        props.swatches === true
          ? categoricalColor(palette, name, domain)
          : undefined;
      return {
        category: name,
        ...(swatch ? { swatch } : {}),
        values: columns.map((column) =>
          formatValue(row[column.resolved.field], column.resolved.format)
        )
      };
    })
  };
}
