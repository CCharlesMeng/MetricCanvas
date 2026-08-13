import type {
  DqeRequestBody,
  JsonObject,
  QueryFieldDefinition
} from '@metriccanvas/page';
import type { DomainSemanticSurface } from '@metriccanvas/mcp';
import type { DimensionFilter } from '../session/step-event';
import type { AskDataRequestUnitState, AskUnitMetric } from './ports';

/**
 * 取数单元 → 可执行派生物的确定性转换(ADR-0032:查询定义与结果字段契约
 * 是取数单元经语义面声明派生的,不由模型手写)。
 *
 * - 名称经语义面别名归一为规范名;归一不掉的名称原样保留,交由取数单元
 *   验真的清单校验裁决(闭集裁决只有一份,#64)。
 * - 结果字段契约的类型、角色、标签、单位与可空性全部来自语义面字段声明,
 *   不从返回样例推断;formula 字段的标签与单位由生成时显式声明。
 */

export interface DerivedExecutableUnit {
  /** 结果字段契约(含查询字段映射),键为稳定页面字段 id。 */
  fields: Record<string, QueryFieldDefinition>;
  /** DQE 原始请求体。 */
  body: DqeRequestBody;
  /** 口径卡的生效范围呈现内容。 */
  scope: {
    timeRange: string;
    granularity: string;
    filters: DimensionFilter[];
  };
}

/** 把取数单元内的名称按语义面别名归一为规范名(维度含时间维度)。 */
export function canonicalizeUnit(
  unit: AskDataRequestUnitState,
  surfaces: readonly DomainSemanticSurface[]
): AskDataRequestUnitState {
  const surface = surfaces.find((entry) => entry.businessDomain === unit.businessDomain);
  if (!surface) return unit;
  const metricByAlias = aliasIndex(surface.metrics);
  const dimensionByAlias = aliasIndex([...surface.dimensions, ...surface.timeDimensions]);
  return {
    ...unit,
    metrics: unit.metrics.map((metric) =>
      metric.kind === 'metric'
        ? { kind: 'metric', name: metricByAlias.get(metric.name) ?? metric.name }
        : metric
    ),
    groupBy: unit.groupBy.map((name) => dimensionByAlias.get(name) ?? name),
    filters: unit.filters.map((filter) => ({
      ...filter,
      dimension: dimensionByAlias.get(filter.dimension) ?? filter.dimension
    }))
  };
}

export function deriveExecutableUnit(
  unit: AskDataRequestUnitState,
  surfaces: readonly DomainSemanticSurface[]
): DerivedExecutableUnit {
  const surface = surfaces.find((entry) => entry.businessDomain === unit.businessDomain);

  const fields: Record<string, QueryFieldDefinition> = {};
  let fieldIndex = 0;
  const addField = (definition: QueryFieldDefinition): void => {
    fieldIndex += 1;
    fields[`field-${fieldIndex}`] = definition;
  };

  for (const dimensionName of unit.groupBy) {
    addField(dimensionFieldDefinition(dimensionName, surface, unit.time?.granularity));
  }
  for (const metric of unit.metrics) {
    addField(metricFieldDefinition(metric, surface));
  }

  const body: DqeRequestBody = {
    dsl_list: [
      {
        output_dims: [...unit.groupBy],
        output_metrics: unit.metrics.map(outputMetric),
        filter: {
          ...(unit.time === null
            ? {}
            : {
                time: {
                  period: unit.time.granularity,
                  start: unit.time.start,
                  end: unit.time.end
                }
              }),
          dims: unit.filters.map((filter) => ({
            dim_name: filter.dimension,
            dim_value_list: [...filter.values]
          })),
          metrics: []
        },
        order: {}
      }
    ]
  };

  return {
    fields,
    body,
    scope: {
      timeRange:
        unit.time === null ? '不限定时间范围' : `${unit.time.start} ~ ${unit.time.end}`,
      granularity: unit.time?.granularity ?? '未指定',
      filters: unit.filters.map((filter) => ({
        dimension: filter.dimension,
        values: [...filter.values]
      }))
    }
  };
}

function outputMetric(metric: AskUnitMetric): string | JsonObject {
  if (metric.kind === 'metric') return metric.name;
  // 页面协议以 alias 声明 formula 项的输出字段名(validate.ts 的 DQE 输出推导)。
  return { formula: metric.expression, alias: metric.label };
}

function dimensionFieldDefinition(
  name: string,
  surface: DomainSemanticSurface | undefined,
  granularity: string | undefined
): QueryFieldDefinition {
  const timeDimension = surface?.timeDimensions.find((entry) => entry.name === name);
  if (timeDimension) {
    return {
      queryField: name,
      // 时间维度按查询粒度展开:day 粒度输出完整日历日期(date);
      // month 等粗粒度输出周期字面(如 2026-01),按 string 契约声明。
      type: granularity === 'day' ? 'date' : 'string',
      role: 'dimension',
      label: name,
      nullable: false
    };
  }
  const dimension = surface?.dimensions.find((entry) => entry.name === name);
  return {
    queryField: name,
    type: dimension?.type ?? 'string',
    role: 'dimension',
    label: name,
    nullable: dimension?.nullable ?? false
  };
}

function metricFieldDefinition(
  metric: AskUnitMetric,
  surface: DomainSemanticSurface | undefined
): QueryFieldDefinition {
  if (metric.kind === 'formula') {
    return {
      queryField: metric.label,
      type: 'number',
      role: 'measure',
      label: metric.label,
      ...(metric.unit === undefined ? {} : { unit: metric.unit }),
      nullable: false
    };
  }
  const declared = surface?.metrics.find((entry) => entry.name === metric.name);
  return {
    queryField: metric.name,
    type: declared?.type ?? 'number',
    role: 'measure',
    label: metric.name,
    ...(declared?.unit === undefined ? {} : { unit: declared.unit }),
    nullable: declared?.nullable ?? false
  };
}

function aliasIndex(
  entries: ReadonlyArray<{ name: string; aliases: readonly string[] }>
): Map<string, string> {
  const index = new Map<string, string>();
  for (const entry of entries) {
    index.set(entry.name, entry.name);
    for (const alias of entry.aliases) {
      if (!index.has(alias)) index.set(alias, entry.name);
    }
  }
  return index;
}
