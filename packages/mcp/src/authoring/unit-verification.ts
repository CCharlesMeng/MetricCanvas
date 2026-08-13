import type {
  EffectiveQuery,
  QueryFieldDefinition,
  Row
} from '@metriccanvas/page';
import { parseValueDomain, type DataContextSnapshot } from '../data-context';
import type { ExecutedDataRequestUnit } from './assemble-page';

/**
 * 创作期取数单元验真(ADR-0032):清单校验 → 真实执行 → 回传输出字段与样例行。
 *
 * 闭集分层:指标名、维度名、维度取值与时间粒度必须取自数据上下文;
 * 查询表达式(formula)是有意保留的开放面,允许生成但必须留痕。
 * 清单校验失败一律不执行;真实执行经由平台注入的查询执行端口,
 * 与统一运行时共用同一份结果归一化能力,本模块不感知 HTTP、端点与凭据。
 */

/**
 * 失败四段分类(ADR-0032):发现 / 生成 / 执行 / 呈现。
 * 词汇与平台侧步骤事件契约(step_failed.stage)一致;它描述创作期
 * 未能形成可用查询的原因,与运行期查询错误分类并列而不混用。
 */
export const FAILURE_STAGES = [
  'discovery',
  'generation',
  'execution',
  'presentation'
] as const;
export type FailureStage = (typeof FAILURE_STAGES)[number];

/** 单次运行(同一 MCP server 实例)允许的真实执行次数上限。 */
export const MAX_UNIT_EXECUTIONS_PER_RUN = 6;

/** 成功结果回传的样例行数量上限。 */
export const UNIT_SAMPLE_ROW_LIMIT = 20;

/** 创作期查询执行端口的返回:归一化数据行与可选总条数。 */
export interface UnitQueryExecutionResult {
  rows: Row[];
  totalCount?: number;
}

/**
 * 创作期查询执行端口(按意图命名):执行取数单元派生的生效查询。
 * 端口形状与数据网关的执行能力对齐,由平台注入实现;执行失败时
 * 按运行期查询错误抛出(携带字符串 code 的 Error)。
 */
export type ExecuteDataRequestUnitQuery = (
  query: EffectiveQuery
) => Promise<UnitQueryExecutionResult>;

/**
 * 验真输入:取数单元。复用 ExecutedDataRequestUnit 的同一份声明
 * (真元归一),只取验真所需的数据源名、结果字段契约与查询定义;
 * question 为问题原文,是自由生成 formula 留痕的组成部分(ADR-0032)。
 */
export interface DataRequestUnitInput
  extends Pick<ExecutedDataRequestUnit, 'dataSourceId' | 'fields' | 'query'> {
  question?: string;
}

/** 清单校验违规:逐条附数据上下文内的候选名称或取值。 */
export interface ManifestViolation {
  code:
    | 'UNIT_QUERY_SHAPE_INVALID'
    | 'METRIC_NOT_IN_DATA_CONTEXT'
    | 'DIMENSION_NOT_IN_DATA_CONTEXT'
    | 'DIMENSION_VALUE_NOT_IN_DATA_CONTEXT'
    | 'TIME_GRANULARITY_NOT_IN_DATA_CONTEXT'
    | 'FORMULA_QUESTION_MISSING';
  /** 违规的名称、取值或查询体位置。 */
  subject: string;
  message: string;
  candidates: string[];
}

/** 创作期失败:stage 为四段分类,code 为结构化错误码。 */
export interface AuthoringFailure {
  stage: FailureStage;
  code: string;
  message: string;
  /** 清单校验被拒绝时的违规明细。 */
  violations?: ManifestViolation[];
}

/** 自由生成 formula 的留痕(ADR-0032):问题原文、表达式、引用到的指标名。 */
export interface FormulaTrace {
  question: string;
  expression: string;
  referencedMetrics: string[];
}

/**
 * 回传的输出字段:全部来自结果字段契约的声明
 * (不从返回样例行推断字段类型与语义,ADR-0032)。
 */
export interface UnitOutputField {
  fieldId: string;
  queryField: string;
  type: QueryFieldDefinition['type'];
  role: QueryFieldDefinition['role'];
  label?: string;
  unit?: string;
}

export type DataRequestUnitVerificationResult =
  | {
      ok: true;
      dataSourceId: string;
      outputFields: UnitOutputField[];
      sampleRows: Row[];
      /** 本次执行返回的数据行总数(样例行是它的前若干行)。 */
      returnedRowCount: number;
      totalCount?: number;
      formulaTraces: FormulaTrace[];
      executionsUsed: number;
      executionsRemaining: number;
    }
  | {
      ok: false;
      dataSourceId: string;
      failure: AuthoringFailure;
      executionsUsed: number;
      executionsRemaining: number;
    };

export interface DataRequestUnitVerificationDependencies {
  dataContext: { current(): Promise<DataContextSnapshot> };
  executeDataRequestUnitQuery: ExecuteDataRequestUnitQuery;
}

export type DataRequestUnitVerification = (
  unit: DataRequestUnitInput
) => Promise<DataRequestUnitVerificationResult>;

/**
 * 创建取数单元验真能力。执行次数计数随本实例存续:一次 MCP server
 * 运行实例内最多真实执行 MAX_UNIT_EXECUTIONS_PER_RUN 次,超限返回
 * 明确失败而不是静默;清单校验失败不执行,也不消耗执行次数。
 */
export function createDataRequestUnitVerification(
  dependencies: DataRequestUnitVerificationDependencies
): DataRequestUnitVerification {
  let executionsUsed = 0;
  const budget = () => ({
    executionsUsed,
    executionsRemaining: MAX_UNIT_EXECUTIONS_PER_RUN - executionsUsed
  });

  return async (unit) => {
    const snapshot = await dependencies.dataContext.current();
    const manifest = validateUnitManifest(snapshot, unit);
    if (manifest.violations.length > 0) {
      return {
        ok: false,
        dataSourceId: unit.dataSourceId,
        failure: {
          stage: 'generation',
          code: 'UNIT_MANIFEST_REJECTED',
          message: '清单校验未通过,未执行查询',
          violations: manifest.violations
        },
        ...budget()
      };
    }

    if (executionsUsed >= MAX_UNIT_EXECUTIONS_PER_RUN) {
      return {
        ok: false,
        dataSourceId: unit.dataSourceId,
        failure: {
          stage: 'execution',
          code: 'UNIT_EXECUTION_LIMIT_REACHED',
          message: `单次运行的真实执行次数已达上限 ${MAX_UNIT_EXECUTIONS_PER_RUN} 次,本次未执行`
        },
        ...budget()
      };
    }

    executionsUsed += 1;
    try {
      // 验真执行默认查询状态:不施加筛选值与分页(ADR-0020 的默认查询状态)。
      const result = await dependencies.executeDataRequestUnitQuery({
        language: 'dqe',
        body: unit.query.body,
        fieldMappings: unit.fields,
        filterValues: []
      });
      return {
        ok: true,
        dataSourceId: unit.dataSourceId,
        outputFields: declaredOutputFields(unit.fields),
        sampleRows: result.rows.slice(0, UNIT_SAMPLE_ROW_LIMIT),
        returnedRowCount: result.rows.length,
        ...(result.totalCount === undefined ? {} : { totalCount: result.totalCount }),
        formulaTraces: manifest.formulaTraces,
        ...budget()
      };
    } catch (cause) {
      return {
        ok: false,
        dataSourceId: unit.dataSourceId,
        failure: failureFromExecutionError(cause),
        ...budget()
      };
    }
  };
}

/**
 * 运行期查询错误码 → 创作期四段分类的映射。两套分类并列而不混用:
 * 运行期错误码原样保留在 failure.code,stage 只做创作期归因。
 * - 生成:查询定义或筛选绑定未能形成一次合法执行请求;
 * - 执行:请求合法但真实执行不可达或被执行环境拒绝;
 * - 呈现:执行有输出,但输出无法按结果字段契约归一化回传输出字段与样例行。
 */
export const RUNTIME_QUERY_ERROR_STAGES: Readonly<Record<string, FailureStage>> = {
  DQE_CONFIG_ERROR: 'generation',
  DQE_FILTER_BINDING_ERROR: 'generation',
  DQE_CANCELLED: 'execution',
  DQE_AUTH_REQUIRED: 'execution',
  DQE_FORBIDDEN: 'execution',
  DQE_TIMEOUT: 'execution',
  DQE_QUERY_REJECTED: 'execution',
  DQE_TRANSPORT_ERROR: 'execution',
  DQE_ENVELOPE_ERROR: 'execution',
  DQE_ITEM_ERROR: 'execution',
  DQE_FIELD_MAPPING_ERROR: 'presentation',
  DQE_ROW_CONTRACT_ERROR: 'presentation'
};

function failureFromExecutionError(cause: unknown): AuthoringFailure {
  if (cause instanceof Error && typeof (cause as { code?: unknown }).code === 'string') {
    const code = (cause as unknown as { code: string }).code;
    return {
      stage: RUNTIME_QUERY_ERROR_STAGES[code] ?? 'execution',
      code,
      message: cause.message
    };
  }
  return {
    stage: 'execution',
    code: 'UNIT_EXECUTION_FAILED',
    message: cause instanceof Error ? cause.message : String(cause)
  };
}

/** 输出字段只回声结果字段契约的声明,不读样例值。 */
function declaredOutputFields(
  fields: Record<string, QueryFieldDefinition>
): UnitOutputField[] {
  return Object.entries(fields).map(([fieldId, definition]) => ({
    fieldId,
    queryField: definition.queryField,
    type: definition.type,
    role: definition.role,
    ...(definition.label === undefined ? {} : { label: definition.label }),
    ...(definition.role !== 'detail' && definition.unit !== undefined
      ? { unit: definition.unit }
      : {})
  }));
}

interface MetricClosedEntry {
  aliases: string[];
}

interface DimensionClosedEntry {
  aliases: string[];
  /** 声明了取值域受控句式时的封闭取值集合;未声明则不做取值闭集校验。 */
  values?: string[];
}

interface TimeDimensionClosedEntry {
  aliases: string[];
  granularities: string[];
}

interface ClosedSets {
  metrics: Map<string, MetricClosedEntry>;
  dimensions: Map<string, DimensionClosedEntry>;
  timeDimensions: Map<string, TimeDimensionClosedEntry>;
}

// 取值域受控句式的解析是数据上下文契约的一部分,唯一声明在
// ../data-context 的 parseValueDomain;时间粒度写在字段 granularity(逗号分隔)。
function closedSetsOf(snapshot: DataContextSnapshot): ClosedSets {
  const sets: ClosedSets = {
    metrics: new Map(),
    dimensions: new Map(),
    timeDimensions: new Map()
  };
  for (const environment of snapshot.executionEnvironments) {
    for (const schema of environment.schemas) {
      for (const object of schema.objects) {
        for (const field of object.fields) {
          const aliases = field.aliases ?? [];
          if (field.roleHints.includes('measure')) {
            mergeAliases(sets.metrics, field.name, aliases, () => ({ aliases: [] }));
          }
          if (field.roleHints.includes('time')) {
            const entry = mergeAliases(sets.timeDimensions, field.name, aliases, () => ({
              aliases: [],
              granularities: []
            }));
            for (const granularity of field.granularity?.split(',') ?? []) {
              const trimmed = granularity.trim();
              if (trimmed !== '' && !entry.granularities.includes(trimmed)) {
                entry.granularities.push(trimmed);
              }
            }
          } else if (field.roleHints.includes('dimension')) {
            const entry = mergeAliases(sets.dimensions, field.name, aliases, () => ({
              aliases: []
            }));
            const values = parseValueDomain(field.description);
            if (values !== undefined) {
              entry.values = [...new Set([...(entry.values ?? []), ...values])];
            }
          }
        }
      }
    }
  }
  return sets;
}

function mergeAliases<Entry extends { aliases: string[] }>(
  entries: Map<string, Entry>,
  name: string,
  aliases: string[],
  create: () => Entry
): Entry {
  const entry = entries.get(name) ?? create();
  for (const alias of aliases) {
    if (!entry.aliases.includes(alias)) entry.aliases.push(alias);
  }
  entries.set(name, entry);
  return entry;
}

/** 未命中时给出候选:别名精确命中优先,其次名称包含关系,兜底列出闭集名称。 */
function candidateNames(
  unknown: string,
  entries: ReadonlyMap<string, { aliases: string[] }>,
  limit = 5
): string[] {
  const names = [...entries.keys()];
  const aliasHits = names.filter((name) =>
    entries.get(name)!.aliases.includes(unknown)
  );
  if (aliasHits.length > 0) return aliasHits.slice(0, limit);
  const partialHits = names.filter(
    (name) => name.includes(unknown) || unknown.includes(name)
  );
  if (partialHits.length > 0) return partialHits.slice(0, limit);
  return names.slice(0, limit);
}

interface ManifestOutcome {
  violations: ManifestViolation[];
  formulaTraces: FormulaTrace[];
}

/**
 * 清单校验(ADR-0032):名称层封闭——指标名、维度名、维度取值与时间粒度
 * 必须取自数据上下文;表达式层开放——formula 允许生成,但必须携带问题
 * 原文留痕。这里只做闭集裁决,查询字段映射与行级契约仍由执行时的
 * 结果归一化能力裁决,不重复实现。
 */
export function validateUnitManifest(
  snapshot: DataContextSnapshot,
  unit: DataRequestUnitInput
): ManifestOutcome {
  const sets = closedSetsOf(snapshot);
  const violations: ManifestViolation[] = [];
  const formulaTraces: FormulaTrace[] = [];
  const item: Record<string, unknown> = unit.query.body.dsl_list[0];

  validateOutputMetrics(item.output_metrics, unit, sets, violations, formulaTraces);
  validateOutputDims(item.output_dims, sets, violations);
  validateFilter(item.filter, sets, violations);

  return { violations, formulaTraces };
}

function validateOutputMetrics(
  value: unknown,
  unit: DataRequestUnitInput,
  sets: ClosedSets,
  violations: ManifestViolation[],
  formulaTraces: FormulaTrace[]
): void {
  if (!Array.isArray(value) || value.length === 0) {
    violations.push({
      code: 'UNIT_QUERY_SHAPE_INVALID',
      subject: 'output_metrics',
      message: 'DQE 查询项的 output_metrics 必须是非空数组',
      candidates: []
    });
    return;
  }
  value.forEach((entry, index) => {
    if (typeof entry === 'string') {
      if (!sets.metrics.has(entry)) {
        violations.push({
          code: 'METRIC_NOT_IN_DATA_CONTEXT',
          subject: entry,
          message: `指标名「${entry}」不在数据上下文内`,
          candidates: candidateNames(entry, sets.metrics)
        });
      }
      return;
    }
    if (isRecord(entry) && typeof entry.formula === 'string' && entry.formula.trim() !== '') {
      const question = unit.question?.trim();
      if (question === undefined || question === '') {
        violations.push({
          code: 'FORMULA_QUESTION_MISSING',
          subject: entry.formula,
          message: '自由生成的 formula 必须随取数单元提供问题原文以完成留痕',
          candidates: []
        });
        return;
      }
      formulaTraces.push({
        question,
        expression: entry.formula,
        referencedMetrics: [...sets.metrics.keys()].filter((name) =>
          (entry.formula as string).includes(name)
        )
      });
      return;
    }
    violations.push({
      code: 'UNIT_QUERY_SHAPE_INVALID',
      subject: `output_metrics[${index}]`,
      message: 'output_metrics 项必须是指标名,或携带 formula 表达式的对象',
      candidates: []
    });
  });
}

function validateOutputDims(
  value: unknown,
  sets: ClosedSets,
  violations: ManifestViolation[]
): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    violations.push({
      code: 'UNIT_QUERY_SHAPE_INVALID',
      subject: 'output_dims',
      message: 'DQE 查询项的 output_dims 必须是字符串数组',
      candidates: []
    });
    return;
  }
  for (const name of value as string[]) {
    if (!sets.dimensions.has(name) && !sets.timeDimensions.has(name)) {
      violations.push({
        code: 'DIMENSION_NOT_IN_DATA_CONTEXT',
        subject: name,
        message: `维度名「${name}」不在数据上下文内`,
        candidates: candidateNames(
          name,
          new Map([...sets.dimensions, ...sets.timeDimensions])
        )
      });
    }
  }
}

function validateFilter(
  value: unknown,
  sets: ClosedSets,
  violations: ManifestViolation[]
): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    violations.push({
      code: 'UNIT_QUERY_SHAPE_INVALID',
      subject: 'filter',
      message: 'DQE 查询项的 filter 必须是对象',
      candidates: []
    });
    return;
  }
  validateFilterDims(value.dims, sets, violations);
  validateFilterTime(value.time, sets, violations);
}

function validateFilterDims(
  value: unknown,
  sets: ClosedSets,
  violations: ManifestViolation[]
): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    violations.push({
      code: 'UNIT_QUERY_SHAPE_INVALID',
      subject: 'filter.dims',
      message: 'DQE 查询项的 filter.dims 必须是数组',
      candidates: []
    });
    return;
  }
  value.forEach((entry, index) => {
    if (!isRecord(entry) || typeof entry.dim_name !== 'string') {
      violations.push({
        code: 'UNIT_QUERY_SHAPE_INVALID',
        subject: `filter.dims[${index}]`,
        message: '维度筛选必须携带字符串 dim_name',
        candidates: []
      });
      return;
    }
    const name = entry.dim_name;
    if (sets.timeDimensions.has(name)) {
      violations.push({
        code: 'DIMENSION_NOT_IN_DATA_CONTEXT',
        subject: name,
        message: `「${name}」是时间维度,时间范围应使用 filter.time 表达`,
        candidates: []
      });
      return;
    }
    const dimension = sets.dimensions.get(name);
    if (dimension === undefined) {
      violations.push({
        code: 'DIMENSION_NOT_IN_DATA_CONTEXT',
        subject: name,
        message: `筛选维度「${name}」不在数据上下文内`,
        candidates: candidateNames(name, sets.dimensions)
      });
      return;
    }
    if (dimension.values === undefined || !Array.isArray(entry.dim_value_list)) {
      return;
    }
    for (const candidate of entry.dim_value_list) {
      const literal = typeof candidate === 'string' ? candidate : String(candidate);
      if (!dimension.values.includes(literal)) {
        violations.push({
          code: 'DIMENSION_VALUE_NOT_IN_DATA_CONTEXT',
          subject: `${name}=${literal}`,
          message: `维度「${name}」的取值「${literal}」不在数据上下文声明的取值域内`,
          candidates: dimension.values
        });
      }
    }
  });
}

function validateFilterTime(
  value: unknown,
  sets: ClosedSets,
  violations: ManifestViolation[]
): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    violations.push({
      code: 'UNIT_QUERY_SHAPE_INVALID',
      subject: 'filter.time',
      message: 'DQE 查询项的 filter.time 必须是对象',
      candidates: []
    });
    return;
  }
  const period = value.period;
  if (period === undefined) return;
  const granularities = [
    ...new Set(
      [...sets.timeDimensions.values()].flatMap((entry) => entry.granularities)
    )
  ];
  if (typeof period !== 'string' || !granularities.includes(period)) {
    violations.push({
      code: 'TIME_GRANULARITY_NOT_IN_DATA_CONTEXT',
      subject: String(period),
      message: `时间粒度「${String(period)}」不在数据上下文声明的粒度内`,
      candidates: granularities
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
