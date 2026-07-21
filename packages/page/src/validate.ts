import { Ajv, type ErrorObject } from 'ajv';
import type { CatalogSnapshot } from './catalog';
import type { DataSource } from './data-source';
import type { TypedError } from './errors';
import type { FieldBinding, FieldDefinition, FieldValue } from './field';
import { validateCalendarTimeRange } from './filter';
import {
  deriveComponentCapabilities,
  derivePageCapabilities,
  type Component,
  type ComponentAction,
  type ComponentData,
  type Page,
  type TableColumnNode
} from './page';
import { pageSchema } from './schema';
import { versionErrors } from './version';

const ajv = new Ajv({ allErrors: true, strict: false });
const validateStructure = ajv.compile(pageSchema);

/** 不可信文档通过结构、引用、能力及可选 catalog 语义校验后才可视为 Page。 */
export function validate(document: unknown, catalog?: CatalogSnapshot): TypedError[] {
  if (!validateStructure(document)) {
    const structural = (validateStructure.errors ?? []).map(toTypedError);
    const guided = versionErrors(document);
    if (guided.length > 0) {
      return [...guided, ...structural.filter((error) => error.path !== '/schemaVersion')];
    }
    return structural;
  }

  const page = document as Page;
  return [...invariantErrors(page), ...(catalog ? semanticErrors(page, catalog) : [])];
}

function invariantErrors(page: Page): TypedError[] {
  const errors: TypedError[] = [];
  const filters = page.filters ?? [];
  const filterIds = new Set<string>();
  const timeRangeFilterIds = new Set<string>();

  filters.forEach((filter, index) => {
    if (filterIds.has(filter.id)) {
      errors.push(schemaError(`/filters/${index}/id`, `筛选器 id 重复:${filter.id}`));
    }
    filterIds.add(filter.id);
    if (filter.type === 'timeRange') {
      timeRangeFilterIds.add(filter.id);
      if (filter.default !== undefined && typeof filter.default !== 'string') {
        for (const issue of validateCalendarTimeRange(
          filter.default,
          filter.precision ?? 'date'
        )) {
          errors.push(
            schemaError(
              `/filters/${index}/default${issue.field === null ? '' : `/${issue.field}`}`,
              issue.message
            )
          );
        }
      }
    }
  });

  for (const [sourceId, dataSource] of Object.entries(page.dataSources)) {
    const path = `/dataSources/${escapePointer(sourceId)}`;
    if (dataSource.source.type === 'inline') {
      errors.push(...inlineRowErrors(dataSource, path));
    } else {
      errors.push(...queryContractErrors(dataSource, path, filterIds, timeRangeFilterIds));
    }
  }

  const sectionIds = new Set<string>();
  const componentIds = new Set<string>();
  page.sections.forEach((section, sectionIndex) => {
    if (sectionIds.has(section.id)) {
      errors.push(
        schemaError(`/sections/${sectionIndex}/id`, `section id 重复:${section.id}`)
      );
    }
    sectionIds.add(section.id);

    section.components.forEach((component, componentIndex) => {
      const path = `/sections/${sectionIndex}/components/${componentIndex}`;
      if (componentIds.has(component.id)) {
        errors.push(schemaError(`${path}/id`, `component id 重复:${component.id}`));
      }
      componentIds.add(component.id);
      errors.push(...componentErrors(page, component, path, filterIds));
    });
  });

  const capabilities = derivePageCapabilities(page);
  if (capabilities.static && filters.length > 0) {
    errors.push(
      schemaError(
        '/filters',
        '仅含 inline 数据源的静态页面不得声明 filters；筛选不会触发任何数据变化'
      )
    );
  }
  return errors;
}

function inlineRowErrors(dataSource: DataSource, sourcePath: string): TypedError[] {
  if (dataSource.source.type !== 'inline') return [];
  const errors: TypedError[] = [];
  const fields = dataSource.fields;

  dataSource.source.rows.forEach((row, rowIndex) => {
    const rowPath = `${sourcePath}/source/rows/${rowIndex}`;
    for (const key of Object.keys(row)) {
      if (!Object.hasOwn(fields, key)) {
        errors.push(
          schemaError(`${rowPath}/${escapePointer(key)}`, `行包含未声明字段:${key}`)
        );
      }
    }
    for (const [fieldName, field] of Object.entries(fields)) {
      const fieldPath = `${rowPath}/${escapePointer(fieldName)}`;
      if (!Object.hasOwn(row, fieldName)) {
        errors.push(schemaError(fieldPath, `行缺少字段:${fieldName}`));
      } else if (!matchesFieldType(row[fieldName], field)) {
        errors.push(
          schemaError(fieldPath, `字段 ${fieldName} 的值不符合类型 ${field.type}`)
        );
      }
    }
  });
  return errors;
}

function queryContractErrors(
  dataSource: DataSource,
  sourcePath: string,
  filterIds: ReadonlySet<string>,
  timeRangeFilterIds: ReadonlySet<string>
): TypedError[] {
  if (dataSource.source.type !== 'query') return [];
  const errors: TypedError[] = [];
  const query = dataSource.source.query;
  const queryPath = `${sourcePath}/source/query`;
  const dimensions = new Set(query.dimensions ?? []);
  const metrics = new Set(query.metrics);
  const outputFields = new Set([...dimensions, ...metrics]);

  for (const [fieldName, field] of Object.entries(dataSource.fields)) {
    const fieldPath = `${sourcePath}/fields/${escapePointer(fieldName)}`;
    if (!outputFields.has(fieldName)) {
      errors.push(
        schemaError(fieldPath, `字段 ${fieldName} 不在 query 的 dimensions/metrics 输出中`)
      );
    } else if (dimensions.has(fieldName) && field.role !== 'dimension') {
      errors.push(schemaError(`${fieldPath}/role`, `查询维度 ${fieldName} 的 role 必须为 dimension`));
    } else if (metrics.has(fieldName) && field.role !== 'metric') {
      errors.push(schemaError(`${fieldPath}/role`, `查询指标 ${fieldName} 的 role 必须为 metric`));
    }
  }
  for (const fieldName of outputFields) {
    if (!Object.hasOwn(dataSource.fields, fieldName)) {
      errors.push(
        schemaError(
          `${sourcePath}/fields/${escapePointer(fieldName)}`,
          `query 输出字段 ${fieldName} 缺少字段契约`
        )
      );
    }
  }

  (query.filters?.subscribe ?? []).forEach((filterId, index) => {
    if (!filterIds.has(filterId)) {
      errors.push(
        schemaError(
          `${queryPath}/filters/subscribe/${index}`,
          `订阅了未声明的筛选器:${filterId}`
        )
      );
    }
  });
  if (query.time !== undefined) {
    if (!timeRangeFilterIds.has(query.time.filter)) {
      errors.push(
        schemaError(
          `${queryPath}/time/filter`,
          `time.filter 须引用已声明的 timeRange 筛选器:${query.time.filter}`
        )
      );
    } else if (!(query.filters?.subscribe ?? []).includes(query.time.filter)) {
      errors.push(
        schemaError(
          `${queryPath}/time/filter`,
          `time.filter ${query.time.filter} 必须同时出现在 filters.subscribe 中`
        )
      );
    }
  }

  const seenOrderFields = new Set<string>();
  (query.orderBy ?? []).forEach((rule, index) => {
    const path = `${queryPath}/orderBy/${index}/field`;
    if (!outputFields.has(rule.field)) {
      errors.push(schemaError(path, `orderBy 字段 ${rule.field} 不在 query 输出中`));
    }
    if (seenOrderFields.has(rule.field)) {
      errors.push(schemaError(path, `orderBy 字段重复:${rule.field}`));
    }
    seenOrderFields.add(rule.field);
  });
  return errors;
}

function componentErrors(
  page: Page,
  component: Component,
  componentPath: string,
  filterIds: ReadonlySet<string>
): TypedError[] {
  const errors: TypedError[] = [];
  for (const [slot, sourceId] of Object.entries(component.data ?? {})) {
    if (!Object.hasOwn(page.dataSources, sourceId)) {
      errors.push(
        schemaError(
          `${componentPath}/data/${escapePointer(slot)}`,
          `数据槽 ${slot} 引用了未知数据源:${sourceId}`
        )
      );
    }
  }

  const check = (
    binding: FieldBinding,
    path: string,
    expectedRole?: FieldDefinition['role']
  ) => {
    const resolved = resolveBinding(page, component, binding);
    if ('error' in resolved) {
      errors.push(schemaError(path, resolved.error));
      return;
    }
    if (expectedRole !== undefined && resolved.field.role !== expectedRole) {
      errors.push(
        schemaError(
          path,
          `字段 ${resolved.fieldName} 的 role 为 ${resolved.field.role}，此处要求 ${expectedRole}`
        )
      );
    }
  };

  switch (component.type) {
    case 'reportHeader':
    case 'text':
      break;
    case 'metricCard':
      component.props.rows.forEach((row, rowIndex) => {
        check(row.valueField, `${componentPath}/props/rows/${rowIndex}/valueField`, 'metric');
        (row.changes ?? []).forEach((change, changeIndex) =>
          check(
            change.field,
            `${componentPath}/props/rows/${rowIndex}/changes/${changeIndex}/field`,
            'metric'
          )
        );
      });
      errors.push(...actionErrors(component.props.actions, componentPath, page, component, filterIds, check));
      break;
    case 'barChart':
      check(component.props.categoryField, `${componentPath}/props/categoryField`, 'dimension');
      component.props.series.forEach((series, index) =>
        check(series.field, `${componentPath}/props/series/${index}/field`, 'metric')
      );
      errors.push(...actionErrors(component.props.actions, componentPath, page, component, filterIds, check));
      break;
    case 'lineChart':
      check(component.props.xField, `${componentPath}/props/xField`, 'dimension');
      component.props.series.forEach((series, index) =>
        check(series.field, `${componentPath}/props/series/${index}/field`, 'metric')
      );
      errors.push(...actionErrors(component.props.actions, componentPath, page, component, filterIds, check));
      break;
    case 'pieChart':
      check(component.props.categoryField, `${componentPath}/props/categoryField`, 'dimension');
      check(component.props.valueField, `${componentPath}/props/valueField`, 'metric');
      errors.push(...actionErrors(component.props.actions, componentPath, page, component, filterIds, check));
      break;
    case 'table':
      errors.push(...tableErrors(component.props.columns, componentPath, check));
      errors.push(...actionErrors(component.props.actions, componentPath, page, component, filterIds, check));
      if (
        component.props.pagination?.mode === 'paged' &&
        !deriveComponentCapabilities(page, component).live
      ) {
        errors.push(
          schemaError(
            `${componentPath}/props/pagination`,
            'paged 远程分页只允许绑定 query 数据源的组件'
          )
        );
      }
      if (
        component.props.pagination?.mode === 'none' &&
        component.props.pagination.pageSize !== undefined
      ) {
        errors.push(
          schemaError(
            `${componentPath}/props/pagination/pageSize`,
            `pagination.mode='none' 时不得声明 pageSize`
          )
        );
      }
      break;
    case 'mapChart':
      check(component.props.nameField, `${componentPath}/props/nameField`, 'dimension');
      check(component.props.valueField, `${componentPath}/props/valueField`, 'metric');
      errors.push(...actionErrors(component.props.actions, componentPath, page, component, filterIds, check));
      break;
    case 'rankingCard':
      check(component.props.nameField, `${componentPath}/props/nameField`, 'dimension');
      check(component.props.valueField, `${componentPath}/props/valueField`, 'metric');
      if (component.props.changeField) {
        check(component.props.changeField, `${componentPath}/props/changeField`, 'metric');
      }
      errors.push(...actionErrors(component.props.actions, componentPath, page, component, filterIds, check));
      break;
  }
  return errors;
}

type BindingCheck = (
  binding: FieldBinding,
  path: string,
  expectedRole?: FieldDefinition['role']
) => void;

function tableErrors(
  columns: TableColumnNode[],
  componentPath: string,
  check: BindingCheck
): TypedError[] {
  const errors: TypedError[] = [];
  const seen = new Set<string>();
  const visit = (column: TableColumnNode, path: string) => {
    if (column.kind === 'group') {
      column.children.forEach((child, index) => visit(child, `${path}/children/${index}`));
      return;
    }
    check(column.field, `${path}/field`);
    const key = bindingKey(column.field);
    if (seen.has(key)) {
      errors.push(schemaError(`${path}/field`, `表格列字段绑定重复:${key}`));
    }
    seen.add(key);
    if (column.filterable) check(column.field, `${path}/filterable`, 'dimension');
  };
  columns.forEach((column, index) =>
    visit(column, `${componentPath}/props/columns/${index}`)
  );
  return errors;
}

function actionErrors(
  actions: ComponentAction[] | undefined,
  componentPath: string,
  page: Page,
  component: Component,
  filterIds: ReadonlySet<string>,
  check: BindingCheck
): TypedError[] {
  if (!actions) return [];
  const errors: TypedError[] = [];
  if (!deriveComponentCapabilities(page, component).live) {
    errors.push(
      schemaError(
        `${componentPath}/props/actions`,
        'actions 只允许绑定 query 数据源的组件；inline 数据不会响应交互'
      )
    );
  }
  actions.forEach((action, index) => {
    const path = `${componentPath}/props/actions/${index}`;
    if ('writeFilter' in action) {
      const target = (page.filters ?? []).find((filter) => filter.id === action.writeFilter);
      if (!target) {
        errors.push(
          schemaError(`${path}/writeFilter`, `回写了未声明的筛选器:${action.writeFilter}`)
        );
      } else if (target.type !== 'dimension') {
        errors.push(
          schemaError(`${path}/writeFilter`, `回写目标必须是 dimension 筛选器:${action.writeFilter}`)
        );
      }
      check(action.field, `${path}/field`, 'dimension');
      return;
    }
    (action.navigate.carryFilters ?? []).forEach((filterId, filterIndex) => {
      if (!filterIds.has(filterId)) {
        errors.push(
          schemaError(
            `${path}/navigate/carryFilters/${filterIndex}`,
            `carryFilters 引用了未声明的筛选器:${filterId}`
          )
        );
      }
    });
    for (const [filterId, binding] of Object.entries(action.navigate.setFilters ?? {})) {
      check(binding, `${path}/navigate/setFilters/${escapePointer(filterId)}`, 'dimension');
    }
  });
  return errors;
}

function resolveBinding(
  page: Page,
  component: Component,
  binding: FieldBinding
):
  | { field: FieldDefinition; fieldName: string }
  | { error: string } {
  const slot = typeof binding === 'string' ? 'main' : binding.data;
  const fieldName = typeof binding === 'string' ? binding : binding.field;
  const sourceId = (component.data as ComponentData | undefined)?.[slot];
  if (sourceId === undefined) {
    return { error: `字段绑定引用了组件未声明的数据槽:${slot}` };
  }
  const source = page.dataSources[sourceId];
  if (source === undefined) {
    return { error: `字段绑定的数据槽 ${slot} 指向未知数据源:${sourceId}` };
  }
  const field = source.fields[fieldName];
  if (field === undefined) {
    return { error: `字段 ${fieldName} 不在数据槽 ${slot} 的数据源 ${sourceId} 中` };
  }
  return { field, fieldName };
}

function semanticErrors(page: Page, catalog: CatalogSnapshot): TypedError[] {
  const errors: TypedError[] = [];
  const metricsByCode = new Map(catalog.metrics.map((metric) => [metric.code, metric]));
  const dimensions = new Set(catalog.dimensions.map((dimension) => dimension.code));

  for (const [sourceId, dataSource] of Object.entries(page.dataSources)) {
    if (dataSource.source.type !== 'query') continue;
    const query = dataSource.source.query;
    const path = `/dataSources/${escapePointer(sourceId)}/source/query`;
    const knownMetrics = query.metrics.flatMap((code) => metricsByCode.get(code) ?? []);

    query.metrics.forEach((code, index) => {
      if (!metricsByCode.has(code)) {
        errors.push({
          type: 'METRIC_GAP',
          path: `${path}/metrics/${index}`,
          message: `指标 ${code} 不存在于元数据快照`
        });
      }
    });
    (query.dimensions ?? []).forEach((code, index) => {
      if (!dimensions.has(code)) {
        errors.push(schemaError(`${path}/dimensions/${index}`, `维度 ${code} 不存在于元数据快照`));
        return;
      }
      for (const metric of knownMetrics) {
        if (!metric.availableDimensions.includes(code)) {
          errors.push(
            schemaError(
              `${path}/dimensions/${index}`,
              `维度 ${code} 不可用于指标 ${metric.code}`
            )
          );
        }
      }
    });
    if (query.aggregation !== undefined) {
      for (const metric of knownMetrics) {
        if (!metric.availableAggregations.includes(query.aggregation)) {
          errors.push(
            schemaError(
              `${path}/aggregation`,
              `聚合方式 ${query.aggregation} 对指标 ${metric.code} 不合法`
            )
          );
        }
      }
    }
  }
  return errors;
}

function matchesFieldType(value: FieldValue, field: FieldDefinition): boolean {
  if (value === null) return true;
  if (field.type === 'date') {
    return typeof value === 'string' && isCalendarDate(value);
  }
  if (field.type === 'datetime') {
    return (
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(value)
    );
  }
  return typeof value === field.type;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return validateCalendarTimeRange({ from: value, to: value }, 'date').length === 0;
}

function bindingKey(binding: FieldBinding): string {
  return typeof binding === 'string' ? `main:${binding}` : `${binding.data}:${binding.field}`;
}

function schemaError(path: string, message: string): TypedError {
  return { type: 'SCHEMA_ERROR', path, message };
}

function toTypedError(error: ErrorObject): TypedError {
  if (error.keyword === 'required') {
    const missing = (error.params as { missingProperty: string }).missingProperty;
    return schemaError(`${error.instancePath}/${escapePointer(missing)}`, `缺少必填字段 ${missing}`);
  }
  if (error.keyword === 'additionalProperties') {
    const extra = (error.params as { additionalProperty: string }).additionalProperty;
    return schemaError(
      `${error.instancePath}/${escapePointer(extra)}`,
      `存在未定义字段 ${extra}(拼写错误?)`
    );
  }
  if (error.keyword === 'enum') {
    return schemaError(
      error.instancePath || '/',
      `取值不在允许范围:${JSON.stringify(
        (error.params as { allowedValues: unknown[] }).allowedValues
      )}`
    );
  }
  return schemaError(error.instancePath || '/', error.message ?? '结构不合法');
}

function escapePointer(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}
