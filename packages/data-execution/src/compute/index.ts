import { copyRowFallbacks, copyFieldFallback } from '@metriccanvas/page/internal';
import { timeFill, type ComputationContext } from './time-fill';
import { joinAggregate, ComputationError } from './join-aggregate';
import type {
  ComputeOperator,
  DataRow,
  FieldValue,
  GrandTotalOperator,
  GroupSubtotalOperator,
  PivotOperator,
  RatioScale,
  ScalarFieldValue
} from '@metriccanvas/page/internal';

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
  rows: ReadonlyArray<DataRow>,
  dependencies: ReadonlyMap<string, readonly DataRow[]> = new Map(),
  context?: ComputationContext
): DataRow[] {
  let current: DataRow[] = rows as DataRow[];
  for (const operator of operators) {
    current = operator.op === 'joinAggregate'
      ? joinAggregate(operator, current, dependencyRows(dependencies, operator.source))
      : operator.op === 'timeFill' ? timeFill(operator, current, context)
      : operator.op === 'selectField' ? selectField(operator, current, context)
      : applyOperator(operator, current);
  }
  return current;
}

function applyOperator(operator: Exclude<ComputeOperator, { op: 'joinAggregate' | 'timeFill' | 'selectField' }>, rows: DataRow[]): DataRow[] {
  switch (operator.op) {
    case 'sumFields':
      return rows.map(row => copyRowFallbacks(row, { ...row, [operator.output]: sumFields(operator, row) }));
    case 'cagr':
      return rows.map(row => {
        const beginning = numeric(row[operator.beginning]);
        const ending = numeric(row[operator.ending]);
        const periods = numeric(row[operator.periods]);
        return copyRowFallbacks(row, { ...row, [operator.output]: beginning === undefined || beginning <= 0 ||
          ending === undefined || ending < 0 || periods === undefined || periods <= 0
          ? null : finiteOrNull((Math.pow(ending / beginning, 1 / periods) - 1) * (operator.scale ?? 1)) });
      });
    case 'ratio':
      return rows.map((row) => copyRowFallbacks(row, {
        ...row,
        [operator.output]: ratio(
          numeric(row[operator.numerator]),
          numeric(row[operator.denominator]),
          operator.onZeroDenominator,
          operator.scale
        )
      }));
    case 'delta':
      return rows.map((row) => {
        const minuend = numeric(row[operator.minuend]);
        const subtrahend = numeric(row[operator.subtrahend]);
        return copyRowFallbacks(row, {
          ...row,
          [operator.output]:
            minuend === undefined || subtrahend === undefined ? null : finiteOrNull(minuend - subtrahend)
        });
      });
    case 'groupSubtotal':
      return groupSubtotal(operator, rows);
    case 'grandTotal':
      return grandTotal(operator, rows);
    case 'pivot':
      return pivot(operator, rows);
  }
}

function sumFields(operator: Extract<ComputeOperator, { op: 'sumFields' }>, row: DataRow): number | null {
  let total = 0;
  let present = false;
  for (const field of operator.fields) {
    const value = row[field];
    if (value == null) {
      if (operator.onMissing === 'null') return null;
      continue;
    }
    const number = numeric(value);
    if (number === undefined) {
      if (operator.onMissing !== 'ignore') return null;
      continue;
    }
    present = true;
    total += number;
  }
  return present || operator.onMissing === 'zero' ? finiteOrNull(total) : null;
}

/**
 * 分母为零或缺失时按声明的语义取空或取零;分子缺失一律取空。
 *
 * `scale` 只作用于真正算出来的商:取空与取零都是声明的替代取值,不是比值,
 * 刻度乘不到它们身上。缺省不乘,商与未声明刻度时逐值相同。
 */
function ratio(
  numerator: number | undefined,
  denominator: number | undefined,
  onZeroDenominator: 'null' | 'zero',
  scale: RatioScale | undefined
): number | null {
  if (denominator === undefined || denominator === 0) {
    return onZeroDenominator === 'zero' ? 0 : null;
  }
  if (numerator === undefined) return null;
  const quotient = numerator / denominator;
  return finiteOrNull(scale === undefined ? quotient : quotient * scale);
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
      ...sums(operator.measures, group, operator.allMissing),
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
      ...sums(operator.measures, details, operator.allMissing),
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
  if (operator.columns.some(column => column.valueField !== undefined)) {
    const seen = new Set<string>();
    for (const row of rows) {
      const key = JSON.stringify([...keyFields.map(field => row[field]), row[operator.categoryField]]);
      if (seen.has(key)) throw new ComputationError('透视源存在重复分组键与类别');
      seen.add(key);
    }
  }
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
      copyFieldFallback(group[0], field, result, field);
    }
    for (const column of operator.columns) {
      const match = firstCategoryRow(column.categories, operator, group);
      const field = column.valueField ?? operator.valueField;
      result[column.output] = (match?.[field] ?? null) as ScalarFieldValue;
      copyFieldFallback(match, field, result, column.output);
    }
    return result;
  });
}

function firstCategoryRow(categories: readonly string[], operator: PivotOperator, group: DataRow[]): DataRow | undefined {
  for (const category of categories) {
    const match = group.find(row => row[operator.categoryField] === category);
    if (match) return match;
  }
  return undefined;
}

/**
 * 明细行也要带上行类别字段:该字段已声明在结果字段契约里,
 * 缺席会让「契约里有、行里没有」这类差异只能靠肉眼发现。明细行取空。
 */
function withRowKind(row: DataRow, field: string): DataRow {
  return row[field] === undefined ? copyRowFallbacks(row, { ...row, [field]: null }) : row;
}

/** 折叠求和跳过缺失；整组缺失默认取空，仅显式zero策略返回0。 */
function sums(measures: readonly string[], group: DataRow[], allMissing: 'null' | 'zero' = 'null'): DataRow {
  const totals: DataRow = {};
  for (const measure of measures) {
    let total = 0;
    let seen = false;
    let invalid = false;
    for (const row of group) {
      const value = numeric(row[measure]);
      if (value === undefined) {
        if (row[measure] != null) invalid = true;
        continue;
      }
      total += value;
      seen = true;
    }
    totals[measure] = seen ? finiteOrNull(total) : allMissing === 'zero' && !invalid ? 0 : null;
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

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function dependencyRows(dependencies: ReadonlyMap<string, readonly DataRow[]>, id: string): readonly DataRow[] {
  const rows = dependencies.get(id);
  if (!rows) throw new ComputationError('缺少已完成的数据依赖');
  return rows;
}

function selectField(operator: Extract<ComputeOperator, { op: 'selectField' }>, rows: DataRow[], context?: ComputationContext): DataRow[] {
  const selected = context?.modes.get(operator.filter) ?? [];
  if (selected.length > 1) throw new ComputationError('字段模式仅允许单选');
  const mode = selected[0] ?? operator.defaultMode;
  if (!Object.hasOwn(operator.cases, mode)) throw new ComputationError('字段模式不在声明的闭集内');
  return rows.map(row => {
    const field = operator.cases[mode];
    const output = copyRowFallbacks(row, { ...row, [operator.output]: row[field] ?? null });
    copyFieldFallback(row, field, output, operator.output);
    return output;
  });
}
