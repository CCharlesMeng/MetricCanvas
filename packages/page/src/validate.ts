import { Ajv, type ErrorObject } from 'ajv';
import { pageSchema } from './schema';
import { placeholderDimension } from './interaction';
import { versionErrors } from './version';
import type { Page } from './page';
import type { CatalogSnapshot } from './catalog';
import type { TypedError } from './errors';

const ajv = new Ajv({ allErrors: true, strict: false });
const validateStructure = ajv.compile(pageSchema);

/**
 * 两级校验入口:结构校验(JSON Schema + 布局/唯一性不变式)+ 语义校验(对元数据快照)。
 * 文档进、页面出:输入是不可信的页面文档,通过后才可视为 Page(ADR-0007)。
 * catalog 缺省时只做结构校验;结构不过时不做语义校验,避免对坏文档级联报错。
 */
export function validate(document: unknown, catalog?: CatalogSnapshot): TypedError[] {
  if (!validateStructure(document)) {
    const structural = (validateStructure.errors ?? []).map(toTypedError);
    // 不受支持的版本换成版本判定的结果:同一事实只报一条,且带迁移指引(版本策略是唯一真源)
    const guided = versionErrors(document);
    if (guided.length > 0) {
      return [...guided, ...structural.filter((error) => error.path !== '/formatVersion')];
    }
    return structural;
  }
  const page = document as unknown as Page;
  const errors = invariantErrors(page);
  if (catalog) {
    errors.push(...semanticErrors(page, catalog));
  }
  return errors;
}

function toTypedError(err: ErrorObject): TypedError {
  if (err.keyword === 'required') {
    const missing = (err.params as { missingProperty: string }).missingProperty;
    // Ajv 将缺失字段定位到父节点,拼上字段名使定位可直接使用
    return {
      type: 'SCHEMA_ERROR',
      path: `${err.instancePath}/${missing}`,
      message: `缺少必填字段 ${missing}`
    };
  }
  return { type: 'SCHEMA_ERROR', path: err.instancePath || '/', message: describe(err) };
}

function describe(err: ErrorObject): string {
  if (err.keyword === 'additionalProperties') {
    return `存在未定义字段 ${(err.params as { additionalProperty: string }).additionalProperty}(拼写错误?)`;
  }
  if (err.keyword === 'enum') {
    return `取值不在允许范围:${JSON.stringify((err.params as { allowedValues: unknown[] }).allowedValues)}`;
  }
  return err.message ?? '结构不合法';
}

/**
 * JSON Schema 表达不了的页面不变式:12 列网格越界、widget/筛选器 id 唯一、
 * 筛选订阅与交互回写的引用完整性(联动只通过已声明的筛选状态传递)。
 */
function invariantErrors(page: Page): TypedError[] {
  const errors: TypedError[] = [];
  const filters = page.filters ?? [];

  const filterIds = new Set<string>();
  filters.forEach((filter, i) => {
    if (filterIds.has(filter.id)) {
      errors.push({
        type: 'SCHEMA_ERROR',
        path: `/filters/${i}/id`,
        message: `筛选器 id 重复:${filter.id}`
      });
    }
    filterIds.add(filter.id);
  });
  const dimensionFiltersById = new Map(
    filters.flatMap((filter) => (filter.type === 'dimension' ? [[filter.id, filter] as const] : []))
  );

  const seen = new Set<string>();
  page.widgets.forEach((widget, i) => {
    const { x, w } = widget.position;
    if (x + w > page.layout.columns) {
      errors.push({
        type: 'SCHEMA_ERROR',
        path: `/widgets/${i}/position`,
        message: `布局越界:x(${x}) + w(${w}) 超出 ${page.layout.columns} 列网格`
      });
    }
    if (seen.has(widget.id)) {
      errors.push({
        type: 'SCHEMA_ERROR',
        path: `/widgets/${i}/id`,
        message: `widget id 重复:${widget.id}`
      });
    }
    seen.add(widget.id);

    (widget.query.filters?.subscribe ?? []).forEach((filterId, j) => {
      if (!filterIds.has(filterId)) {
        errors.push({
          type: 'SCHEMA_ERROR',
          path: `/widgets/${i}/query/filters/subscribe/${j}`,
          message: `订阅了未声明的筛选器:${filterId}`
        });
      }
    });

    if (widget.type === 'barChart') {
      (widget.interactions ?? []).forEach((interaction, j) => {
        if ('navigate' in interaction) {
          // 跨页下钻的页内可校验部分;目标页存在性与目标筛选器有效性属仓库知识,归 validate CLI(navigateErrors)
          const { carryFilters, setFilters } = interaction.navigate;
          (carryFilters ?? []).forEach((filterId, k) => {
            if (!filterIds.has(filterId)) {
              errors.push({
                type: 'SCHEMA_ERROR',
                path: `/widgets/${i}/interactions/${j}/navigate/carryFilters/${k}`,
                message: `carryFilters 引用了本页未声明的筛选器:${filterId}`
              });
            }
          });
          for (const [targetId, placeholder] of Object.entries(setFilters ?? {})) {
            const notQueried = placeholderNotQueriedError(
              widget,
              placeholder,
              `/widgets/${i}/interactions/${j}/navigate/setFilters/${targetId}`
            );
            if (notQueried) errors.push(notQueried);
          }
          return;
        }

        const target = dimensionFiltersById.get(interaction.writeFilter);
        if (!target) {
          errors.push({
            type: 'SCHEMA_ERROR',
            path: `/widgets/${i}/interactions/${j}/writeFilter`,
            message: `回写目标须为已声明的 dimension 型筛选器:${interaction.writeFilter}`
          });
        }
        const code = placeholderDimension(interaction.value);
        const notQueried = placeholderNotQueriedError(
          widget,
          interaction.value,
          `/widgets/${i}/interactions/${j}/value`
        );
        if (notQueried) errors.push(notQueried);
        // 占位维度须与目标筛选器约束的维度一致,否则运行时会把 A 维度的值写进 B 维度的条件
        if (target && code !== target.dimension) {
          errors.push({
            type: 'SCHEMA_ERROR',
            path: `/widgets/${i}/interactions/${j}/value`,
            message: `取值占位的维度 ${code} 与回写目标筛选器 ${target.id} 约束的维度 ${target.dimension} 不一致`
          });
        }
      });
    }
  });
  return errors;
}

/** 取值占位引用的维度必须在本组件查询的 dimensions 中(writeFilter 与 navigate.setFilters 共用) */
function placeholderNotQueriedError(
  widget: Page['widgets'][number],
  placeholder: string,
  path: string
): TypedError | null {
  const code = placeholderDimension(placeholder);
  if ((widget.query.dimensions ?? []).includes(code)) return null;
  return {
    type: 'SCHEMA_ERROR',
    path,
    message: `取值占位引用的维度 ${code} 不在本组件查询的 dimensions 中`
  };
}

/**
 * 语义校验:结构化查询引用的指标/维度/聚合须在元数据快照(供给侧清单)允许范围内。
 * 分型原则:指标不存在是 METRIC_GAP(需求与供给的差集,走 metric-gap 需求通道);
 * 维度不存在、维度不可用于指标、聚合不合法都是"写错了"(SCHEMA_ERROR)。
 */
function semanticErrors(page: Page, catalog: CatalogSnapshot): TypedError[] {
  const metricsByCode = new Map(catalog.metrics.map((m) => [m.code, m]));
  const dimensionCodes = new Set(catalog.dimensions.map((d) => d.code));
  const errors: TypedError[] = [];

  page.widgets.forEach((widget, i) => {
    const queryPath = `/widgets/${i}/query`;
    // 快照中存在的指标才参与维度/聚合的组合校验,缺失指标只报一次 METRIC_GAP
    const knownMetrics = widget.query.metrics.flatMap((code) => metricsByCode.get(code) ?? []);

    widget.query.metrics.forEach((code, j) => {
      if (!metricsByCode.has(code)) {
        errors.push({
          type: 'METRIC_GAP',
          path: `${queryPath}/metrics/${j}`,
          message: `指标 ${code} 不存在于元数据快照:若为业务新需求,请走 metric-gap 需求通道,而非修改页面文档`
        });
      }
    });

    (widget.query.dimensions ?? []).forEach((code, j) => {
      if (!dimensionCodes.has(code)) {
        errors.push({
          type: 'SCHEMA_ERROR',
          path: `${queryPath}/dimensions/${j}`,
          message: `维度 ${code} 不存在于元数据快照(拼写错误?)`
        });
        return;
      }
      for (const metric of knownMetrics) {
        if (!metric.availableDimensions.includes(code)) {
          errors.push({
            type: 'SCHEMA_ERROR',
            path: `${queryPath}/dimensions/${j}`,
            message: `维度 ${code} 不可用于指标 ${metric.code}(可用维度:${metric.availableDimensions.join('、')})`
          });
        }
      }
    });

    const aggregation = widget.query.aggregation;
    if (aggregation !== undefined) {
      for (const metric of knownMetrics) {
        if (!metric.availableAggregations.includes(aggregation)) {
          errors.push({
            type: 'SCHEMA_ERROR',
            path: `${queryPath}/aggregation`,
            message: `聚合方式 ${aggregation} 对指标 ${metric.code} 不合法(可用聚合:${metric.availableAggregations.join('、')})`
          });
        }
      }
    }
  });

  return errors;
}
