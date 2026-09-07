import { rowKinds, type FieldValue, type RowKind } from '@metriccanvas/page';
import type { AlignedTableRow } from './rows';

/**
 * 表格呈现能力的纯判定(ADR-0049):行类别档位与相邻同值合并。
 * 表格只识别不计算——小计与合计由计算阶段产出,这里只把标记翻译成呈现。
 */

/** 呈现档位:明细、小计、合计。 */
export type TableRowTier = 'detail' | RowKind;

const RECOGNIZED: ReadonlySet<string> = new Set(rowKinds);

/**
 * 行类别取值 → 呈现档位。闭集之外的取值(含空值与未声明行类别字段)一律
 * 按明细处理:算子与表格两侧认同一个闭集,不认识的标记不该悄悄改变样式。
 */
export function tableRowTier(
  row: AlignedTableRow,
  rowKindField: string | undefined
): TableRowTier {
  if (rowKindField === undefined) return 'detail';
  const value = row.main[rowKindField];
  return typeof value === 'string' && RECOGNIZED.has(value)
    ? (value as RowKind)
    : 'detail';
}

/**
 * 相邻同值合并:返回每行在该列上的 rowSpan,0 表示该行不渲染这个单元格。
 *
 * 只合并相邻的相同取值,因此排序或筛选改变行序后结果自然跟着变——这正是
 * 不把 rowSpan 预先算进数据里的理由。空值不参与合并:两行都没有取值不能
 * 推出它们属于同一组。
 */
export function mergeSpans(
  rows: readonly AlignedTableRow[],
  field: string | undefined
): number[] {
  const spans = rows.map(() => 1);
  if (field === undefined) return spans;

  let anchor = -1;
  let previous: FieldValue | undefined;
  rows.forEach((row, index) => {
    const value = row.main[field];
    if (value == null) {
      anchor = -1;
      previous = undefined;
      return;
    }
    if (anchor >= 0 && sameCell(previous, value)) {
      spans[anchor] += 1;
      spans[index] = 0;
      return;
    }
    anchor = index;
    previous = value;
  });
  return spans;
}

function sameCell(left: FieldValue | undefined, right: FieldValue): boolean {
  return left === right;
}
