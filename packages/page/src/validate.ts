import { Ajv, type ErrorObject } from 'ajv';
import { pageSchema } from './schema';
import { placeholderDimension } from './interaction';
import { versionErrors } from './version';
import { isChartWidget, isDataWidget, type ChartWidget, type Page, type TableWidget } from './page';
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

    // 文本组件无查询:只校验链接 carryFilters 的页内引用完整性(目标页存在性归 CLI 跨文档校验)
    if (widget.type === 'text') {
      (widget.links ?? []).forEach((link, j) => {
        (link.carryFilters ?? []).forEach((filterId, k) => {
          if (!filterIds.has(filterId)) {
            errors.push({
              type: 'SCHEMA_ERROR',
              path: `/widgets/${i}/links/${j}/carryFilters/${k}`,
              message: `carryFilters 引用了本页未声明的筛选器:${filterId}`
            });
          }
        });
      });
      return;
    }

    (widget.query.filters?.subscribe ?? []).forEach((filterId, j) => {
      if (!filterIds.has(filterId)) {
        errors.push({
          type: 'SCHEMA_ERROR',
          path: `/widgets/${i}/query/filters/subscribe/${j}`,
          message: `订阅了未声明的筛选器:${filterId}`
        });
      }
    });

    if (widget.type === 'metricCard' && widget.query.metrics.length > 1) {
      errors.push({
        type: 'SCHEMA_ERROR',
        path: `/widgets/${i}/query/metrics`,
        message: `指标卡只支持单指标,收到 ${widget.query.metrics.length} 个`
      });
    }

    // 饼图/地图是单指标组件(占比切分/区域着色):多指标无语义,报错而非静默取第一个
    if ((widget.type === 'pieChart' || widget.type === 'mapChart') && widget.query.metrics.length > 1) {
      errors.push({
        type: 'SCHEMA_ERROR',
        path: `/widgets/${i}/query/metrics`,
        message: `${widget.type === 'pieChart' ? '饼图' : '地图'}只支持单指标,收到 ${widget.query.metrics.length} 个`
      });
    }

    if (widget.type === 'mapChart') {
      const dimensionCount = widget.query.dimensions?.length ?? 0;
      if (dimensionCount !== 1) {
        errors.push({
          type: 'SCHEMA_ERROR',
          path: `/widgets/${i}/query/dimensions`,
          message: `地图的结构化查询必须恰好声明一个维度,收到 ${dimensionCount} 个`
        });
      }
    }

    if (widget.type === 'table') {
      errors.push(...tableErrors(widget, i));
    }

    // nameMap 多个维度值映射同一底图区域名:着色与点击回写相互覆盖,报错而非静默取后写者
    if (widget.type === 'mapChart') {
      const mappedBy = new Map<string, string>();
      for (const [from, to] of Object.entries(widget.display.nameMap ?? {})) {
        const prior = mappedBy.get(to);
        if (prior !== undefined) {
          errors.push({
            type: 'SCHEMA_ERROR',
            path: `/widgets/${i}/display/nameMap`,
            message: `nameMap 目标值重复:维度值 ${prior} 与 ${from} 都映射到底图区域名 ${to}`
          });
        } else {
          mappedBy.set(to, from);
        }
      }
    }

    if (isChartWidget(widget)) {
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

/**
 * 表格 widget 的不变式:
 * - 单指标:数据服务是指标行式表,多指标透视行由多条原始行拼成,@limit/@offset 的
 *   行级分页会切开透视行,盲翻语义不成立(多指标列是 P1,需协议层支持后再放开);
 * - 列 field 引用查询的维度或指标(否则该列必然无数据),且页内不重复;
 * - 表头筛选列须为查询维度:筛选条件经运行时进 @where,指标值筛选是 having 语义,不支持。
 */
function tableErrors(widget: TableWidget, i: number): TypedError[] {
  const errors: TypedError[] = [];
  if (widget.query.metrics.length > 1) {
    errors.push({
      type: 'SCHEMA_ERROR',
      path: `/widgets/${i}/query/metrics`,
      message: `表格只支持单指标(行式指标表下多指标与盲翻分页语义冲突),收到 ${widget.query.metrics.length} 个`
    });
  }
  const dimensions = new Set(widget.query.dimensions ?? []);
  const queryFields = new Set([...dimensions, ...widget.query.metrics]);
  const seenFields = new Set<string>();
  widget.columns.forEach((column, j) => {
    if (!queryFields.has(column.field)) {
      errors.push({
        type: 'SCHEMA_ERROR',
        path: `/widgets/${i}/columns/${j}/field`,
        message: `列 field ${column.field} 未出现在查询的 dimensions/metrics 中,该列不会有数据`
      });
    }
    if (seenFields.has(column.field)) {
      errors.push({
        type: 'SCHEMA_ERROR',
        path: `/widgets/${i}/columns/${j}/field`,
        message: `表格列 field 重复:${column.field}`
      });
    }
    seenFields.add(column.field);
    if (column.filterable && !dimensions.has(column.field)) {
      errors.push({
        type: 'SCHEMA_ERROR',
        path: `/widgets/${i}/columns/${j}/filterable`,
        message: `表头筛选列 ${column.field} 须为查询的维度(筛选条件进 @where,指标值筛选不支持)`
      });
    }
  });
  return errors;
}

/** 取值占位引用的维度必须在本组件查询的 dimensions 中(writeFilter 与 navigate.setFilters 共用) */
function placeholderNotQueriedError(
  widget: ChartWidget,
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
    // 文本组件无查询,不参与语义校验
    if (!isDataWidget(widget)) return;
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
