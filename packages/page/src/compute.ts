/**
 * 受控计算(ADR-0046):页面数据源的一个可选阶段。
 *
 * 输入是该数据源查询执行并归一化后的行集,输出仍是同一个数据源的数据快照。
 * 计算阶段没有独立 id、没有独立修订、不参与发布治理,数据源仍是数据源。
 *
 * 只提供封闭的具名算子,不提供通用 arithmetic、公式字段或任何表达式:
 * 算子的参数是字段引用与封闭枚举,不是可求值的字符串。跨数据源关联通过显式依赖、组合键与封闭聚合方式声明。
 */

/** 折叠已返回数据行的算子写入的行类别取值;表格按它套用呈现档位。 */
export const rowKinds = ['subtotal', 'total'] as const;
export type RowKind = (typeof rowKinds)[number];

/** 分母为零(或缺失)时的语义;必须逐处显式声明,默认值会静默改数。 */
export type ZeroDenominatorSemantics = 'null' | 'zero';

export interface RowKindMark {
  field: string;
  value: RowKind;
}

/**
 * 比值的输出刻度。`ratio` 本身产出 `numerator / denominator`,是 0–1 分数;
 * 而仓内 `percent-*` 展示格式按原值加 `%`,存量页面的百分比字段都存 0–100。
 * `scale: 100` 让算子直接产出 0–100,省掉「算出 0.42 却显示 0.42%」这类
 * 只能靠肉眼发现的偏差。
 *
 * 闭集只有 `100`:开放数值等于在算子里引入一个乘法表达式,而 ADR-0046 的
 * 立场是算子的参数只能是字段引用与封闭枚举,不能是可求值的东西。真出现
 * 第二个刻度(千分比之类)时按闭集新增成员放开,那是纯增量。
 */
export type RatioScale = 100;

export interface RatioOperator {
  op: 'ratio';
  numerator: string;
  denominator: string;
  output: string;
  onZeroDenominator: ZeroDenominatorSemantics;
  /** 输出刻度;缺省产出 0–1 分数,`100` 产出 0–100。 */
  scale?: RatioScale;
}

export interface DeltaOperator {
  op: 'delta';
  minuend: string;
  subtrahend: string;
  output: string;
}

export interface GroupSubtotalOperator {
  op: 'groupSubtotal';
  groupBy: string;
  /** 被折叠的度量字段;每个都必须在结果字段契约上声明 collapsible。 */
  measures: string[];
  rowKind: RowKindMark;
  /** 追加在分组取值后的字面后缀(例如「合计」);不是模板,不含占位符。 */
  labelSuffix?: string;
}

export interface GrandTotalOperator {
  op: 'grandTotal';
  measures: string[];
  rowKind: RowKindMark;
  /** 合计行的标签:写入哪个字段、写什么字面量。 */
  label: { field: string; value: string };
}

export interface PivotColumn {
  output: string;
  /** 有序类别取值,取第一个命中的;择一逻辑就地显式声明,不引入条件。 */
  categories: string[];
}

export interface PivotOperator {
  op: 'pivot';
  categoryField: string;
  valueField: string;
  columns: PivotColumn[];
  /** 透视后保留的分组键;缺省时整个行集折成一行。 */
  keyFields?: string[];
}

/** 左关联：依赖已计算的完整行集，成功但缺行输出 null，源失败单独传播。 */
export interface JoinAggregateOperator {
  op: 'joinAggregate';
  source: string;
  keys: Array<{ local: string; foreign: string }>;
  values: Array<{ field: string; output: string; aggregate: 'unique' | 'sum' }>;
  onMissing: 'null';
}

export function computeDependencies(operators: readonly ComputeOperator[]): string[] {
  return [...new Set(operators.flatMap(operator => operator.op === 'joinAggregate' ? [operator.source] : []))];
}

/** 字段相加，缺项策略逐消费者声明；没有任意表达式。 */
export interface SumFieldsOperator {
  op: 'sumFields';
  fields: string[];
  output: string;
  onMissing: 'null' | 'ignore';
}

/** 复合增长率；期数来自已声明字段，不猜测年份差。 */
export interface CagrOperator {
  op: 'cagr';
  beginning: string;
  ending: string;
  periods: string;
  output: string;
  scale?: RatioScale;
}

/** 日/月日历补齐；只补 null，不把缺期解释成零。 */
export interface TimeFillOperator {
  op: 'timeFill';
  timeField: string;
  granularity: 'day' | 'month';
  format: 'iso' | 'compact';
  range: { from: string; to: string } | { currentYearOffset: number } | { filter: string };
  measures: string[];
  groupBy?: string[];
}

/** 有限模式选择已返回字段，不改变查询形状，不执行表达式。 */
export interface SelectFieldOperator {
  op: 'selectField';
  filter: string;
  cases: Record<string, string>;
  defaultMode: string;
  output: string;
}

export type ComputeOperator =
  | TimeFillOperator
  | SelectFieldOperator
  | SumFieldsOperator
  | CagrOperator
  | JoinAggregateOperator
  | RatioOperator
  | DeltaOperator
  | GroupSubtotalOperator
  | GrandTotalOperator
  | PivotOperator;

/** 折叠已返回数据行的算子;它们要求被折叠字段显式声明可折叠。 */
export function isFoldingOperator(
  operator: ComputeOperator
): operator is GroupSubtotalOperator | GrandTotalOperator {
  return operator.op === 'groupSubtotal' || operator.op === 'grandTotal';
}

/**
 * 算子产出的页面字段 id(去重)。它们必须就地声明在同一份结果字段契约里,
 * 也因此不得出现在 inline 数据行或内嵌初始行中——那些行是算子的输入。
 * 行类别字段由折叠算子共同写入,多个折叠算子指向同一个字段是常态。
 */
export function computeOutputFields(operators: readonly ComputeOperator[]): string[] {
  const outputs = new Set<string>();
  for (const operator of operators) {
    switch (operator.op) {
      case 'selectField':
      case 'sumFields':
      case 'cagr':
      case 'ratio':
      case 'delta':
        outputs.add(operator.output);
        break;
      case 'groupSubtotal':
      case 'grandTotal':
        outputs.add(operator.rowKind.field);
        break;
      case 'joinAggregate':
        for (const value of operator.values) outputs.add(value.output);
        break;
      case 'pivot':
        for (const column of operator.columns) outputs.add(column.output);
        break;
    }
  }
  return [...outputs];
}
