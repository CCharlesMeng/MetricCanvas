import type {
  ComputeOperator,
  DataRow,
  FieldValue,
  GrandTotalOperator,
  GroupSubtotalOperator,
  PivotOperator,
  ScalarFieldValue
} from '@metriccanvas/page';

/**
 * 受控计算阶段的求值(ADR-0046)。
 *
 * 输入是已按 `queryField` 归一化为稳定页面字段的行集,输出仍是行集。
 * 算子按声明顺序作用,后一个算子看到的是前一个算子的产出。
 *
 * 这里是纯函数:不读取筛选状态、不发起查询、不认识页面结构。inline 与
 * query 两条路径都在数据快照成型的同一处调用它,不允许只有一条路径过算子。
 */
export function applyComputation(
  operators: readonly ComputeOperator[],
  rows: ReadonlyArray<DataRow>
): DataRow[] {
  let current: DataRow[] = rows as DataRow[];
  for (const operator of operators) {
    current = applyOperator(operator, current);
  }
  return current;
}

function applyOperator(operator: ComputeOperator, rows: DataRow[]): DataRow[] {
  switch (operator.op) {
    case 'ratio':
      return rows.map((row) => ({
        ...row,
        [operator.output]: ratio(
          numeric(row[operator.numerator]),
          numeric(row[operator.denominator]),
          operator.onZeroDenominator
        )
      }));
    case 'delta':
      return rows.map((row) => {
        const minuend = numeric(row[operator.minuend]);
        const subtrahend = numeric(row[operator.subtrahend]);
        return {
          ...row,
          [operator.output]:
            minuend === undefined || subtrahend === undefined ? null : minuend - subtrahend
        };
      });
    case 'groupSubtotal':
      return groupSubtotal(operator, rows);
    case 'grandTotal':
      return grandTotal(operator, rows);
    case 'pivot':
      return pivot(operator, rows);
  }
}

/** 分母为零或缺失时按声明的语义取空或取零;分子缺失一律取空。 */
function ratio(
  numerator: number | undefined,
  denominator: number | undefined,
  onZeroDenominator: 'null' | 'zero'
): number | null {
  if (denominator === undefined || denominator === 0) {
    return onZeroDenominator === 'zero' ? 0 : null;
  }
  if (numerator === undefined) return null;
  return numerator / denominator;
}

/**
 * 按分组字段折叠:每组明细行原序保留,其后追加一行小计。
 * 分组顺序取首次出现顺序;被折叠字段之外的字段在小计行上取空。
 */
function groupSubtotal(operator: GroupSubtotalOperator, rows: DataRow[]): DataRow[] {
  if (rows.length === 0) return rows;
  const groups = new Map<string, DataRow[]>();
  for (const row of rows) {
    const key = groupKey([row[operator.groupBy]]);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const blank = blankRow(rows);
  const result: DataRow[] = [];
  for (const group of groups.values()) {
    result.push(...group.map((row) => withRowKind(row, operator.rowKind.field)));
    const label = group[0]?.[operator.groupBy];
    result.push({
      ...blank,
      [operator.groupBy]:
        typeof label === 'string' && operator.labelSuffix !== undefined
          ? `${label}${operator.labelSuffix}`
          : (label as ScalarFieldValue),
      ...sums(operator.measures, group),
      [operator.rowKind.field]: operator.rowKind.value
    });
  }
  return result;
}

/**
 * 全局合计:只累加明细行。已被前一个折叠算子标记的行(小计行)不参与,
 * 否则同一笔金额会被计两次。
 */
function grandTotal(operator: GrandTotalOperator, rows: DataRow[]): DataRow[] {
  if (rows.length === 0) return rows;
  const details = rows.filter((row) => row[operator.rowKind.field] == null);
  return [
    ...rows.map((row) => withRowKind(row, operator.rowKind.field)),
    {
      ...blankRow(rows),
      ...sums(operator.measures, details),
      [operator.label.field]: operator.label.value,
      [operator.rowKind.field]: operator.rowKind.value
    }
  ];
}

/**
 * 行转列:把「一行一个类别」的结果集按类别字段折成「一行多列」。
 * 每个目标列声明一个有序类别取值列表,取第一个命中的;都不命中取空。
 * 产出行只含分组键与目标列——类别字段与取值字段已被消费掉。
 */
function pivot(operator: PivotOperator, rows: DataRow[]): DataRow[] {
  if (rows.length === 0) return rows;
  const keyFields = operator.keyFields ?? [];
  const groups = new Map<string, DataRow[]>();
  for (const row of rows) {
    const key = groupKey(keyFields.map((field) => row[field]));
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => {
    const result: DataRow = {};
    for (const field of keyFields) {
      result[field] = (group[0]?.[field] ?? null) as ScalarFieldValue;
    }
    for (const column of operator.columns) {
      result[column.output] = firstMatchingCategory(column.categories, operator, group);
    }
    return result;
  });
}

function firstMatchingCategory(
  categories: readonly string[],
  operator: PivotOperator,
  group: DataRow[]
): ScalarFieldValue {
  for (const category of categories) {
    const match = group.find((row) => row[operator.categoryField] === category);
    if (match) return (match[operator.valueField] ?? null) as ScalarFieldValue;
  }
  return null;
}

/**
 * 明细行也要带上行类别字段:该字段已声明在结果字段契约里,
 * 缺席会让「契约里有、行里没有」这类差异只能靠肉眼发现。明细行取空。
 */
function withRowKind(row: DataRow, field: string): DataRow {
  return row[field] === undefined ? { ...row, [field]: null } : row;
}

/** 折叠求和:空值视为 0 参与累加;整组都没有数值时取空。 */
function sums(measures: readonly string[], group: DataRow[]): DataRow {
  const totals: DataRow = {};
  for (const measure of measures) {
    let total = 0;
    let seen = false;
    for (const row of group) {
      const value = numeric(row[measure]);
      if (value === undefined) continue;
      total += value;
      seen = true;
    }
    totals[measure] = seen ? total : null;
  }
  return totals;
}

/** 折叠行的其余字段取空:折叠后它们没有确定取值,留空比留旧值诚实。 */
function blankRow(rows: DataRow[]): DataRow {
  const blank: DataRow = {};
  for (const row of rows) {
    for (const key of Object.keys(row)) blank[key] = null;
  }
  return blank;
}

function groupKey(values: ReadonlyArray<FieldValue | undefined>): string {
  return JSON.stringify(values.map((value) => value ?? null));
}

function numeric(value: FieldValue | undefined): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  return undefined;
}
