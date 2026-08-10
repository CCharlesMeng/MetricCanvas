import { Ajv, type ErrorObject } from 'ajv';
import {
  isInlineDataSource,
  isQueryDataSource,
  resolveDataSourceFields,
  type DataSource,
  type QueryDataSource
} from './data-source';
import type { TypedError } from './errors';
import type { FieldBinding, FieldDefinition, FieldValue } from './field';
import { validateCalendarTimeRange, type FilterDeclaration } from './filter';
import {
  deriveComponentCapabilities,
  derivePageCapabilities,
  type Component,
  type ComponentAction,
  type ComponentData,
  type Page,
  type TableColumnNode
} from './page';
import { materializePageDocument } from './materialize';
import { matchesFieldValue } from './query-rows';
import { barForecastBoundaryIssues } from './bar-forecast-boundary';
import { pageSchema } from './schema';
import { versionErrors } from './version';

const ajv = new Ajv({ allErrors: true, strict: false });
const validateStructure = ajv.compile(pageSchema);

export type PageParseResult =
  | { ok: true; page: Page; errors: [] }
  | { ok: false; errors: TypedError[] };

/** 不可信文档通过结构、字段分组、引用、字段契约和能力校验后才可视为 Page。 */
export function parsePage(document: unknown): PageParseResult {
  if (!validateStructure(document)) {
    const structural = (validateStructure.errors ?? []).map(toTypedError);
    const guided = versionErrors(document);
    if (guided.length > 0) {
      return {
        ok: false,
        errors: [...guided, ...structural.filter((error) => error.path !== '/schemaVersion')]
      };
    }
    return { ok: false, errors: structural };
  }

  const materialized = materializePageDocument(document);
  if (materialized.errors.length > 0) {
    return { ok: false, errors: materialized.errors };
  }
  if (!validateStructure(materialized.document)) {
    return {
      ok: false,
      errors: (validateStructure.errors ?? []).map(toTypedError)
    };
  }

  const page = materialized.document as Page;
  const errors = invariantErrors(page);
  return errors.length === 0
    ? { ok: true, page, errors: [] }
    : { ok: false, errors };
}

export function validate(document: unknown): TypedError[] {
  return parsePage(document).errors;
}

function invariantErrors(page: Page): TypedError[] {
  const errors: TypedError[] = [];
  const filters = page.filters ?? [];
  const filterIds = new Set<string>();
  const filtersById = new Map<string, FilterDeclaration>();

  filters.forEach((filter, index) => {
    if (filterIds.has(filter.id)) {
      errors.push(schemaError(`/filters/${index}/id`, `筛选器 id 重复:${filter.id}`));
    }
    filterIds.add(filter.id);
    filtersById.set(filter.id, filter);
    if (filter.type === 'timeRange') {
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
    if (isInlineDataSource(dataSource)) {
      errors.push(...inlineRowErrors(dataSource, path));
    } else if (isQueryDataSource(dataSource)) {
      errors.push(...queryContractErrors(dataSource, path, filtersById));
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
  errors.push(...queryPaginationErrors(page));

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
  if (!isInlineDataSource(dataSource)) return [];
  return rowContractErrors(
    dataSource.source.rows,
    dataSource.fields,
    `${sourcePath}/source/rows`
  );
}

function rowContractErrors(
  rows: ReadonlyArray<Record<string, FieldValue>>,
  fields: Record<string, FieldDefinition>,
  rowsPath: string
): TypedError[] {
  const errors: TypedError[] = [];
  rows.forEach((row, rowIndex) => {
    const rowPath = `${rowsPath}/${rowIndex}`;
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
      } else if (!matchesFieldValue(row[fieldName], field)) {
        errors.push(
          schemaError(fieldPath, `字段 ${fieldName} 的值不符合类型 ${field.type}`)
        );
      }
    }
  });
  return errors;
}

function queryContractErrors(
  dataSource: QueryDataSource,
  sourcePath: string,
  filtersById: ReadonlyMap<string, FilterDeclaration>
): TypedError[] {
  const errors: TypedError[] = [];
  const query = dataSource.source.query;
  const item = query.body.dsl_list[0];
  const dimensions = stringArray(item.output_dims);
  const metrics = dqeMetricNames(item.output_metrics);
  const outputs = new Set([...dimensions, ...metrics]);
  const mapped = new Map<string, string>();

  if (dataSource.source.initial) {
    if (Number.isNaN(Date.parse(dataSource.source.initial.capturedAt))) {
      errors.push(
        schemaError(
          `${sourcePath}/source/initial/capturedAt`,
          'capturedAt 必须是有效的 RFC 3339 日期时间'
        )
      );
    }
    errors.push(
      ...rowContractErrors(
        dataSource.source.initial.rows,
        dataSource.fields,
        `${sourcePath}/source/initial/rows`
      )
    );
  }

  for (const [fieldId, definition] of Object.entries(dataSource.fields)) {
    if (!('queryField' in definition) || typeof definition.queryField !== 'string') continue;
    const path = `${sourcePath}/fields/${escapePointer(fieldId)}/queryField`;
    const previous = mapped.get(definition.queryField);
    if (previous !== undefined) {
      errors.push(
        typedError(
          'QUERY_MAPPING_ERROR',
          path,
          `queryField ${definition.queryField} 已映射到页面字段 ${previous}`
        )
      );
    } else {
      mapped.set(definition.queryField, fieldId);
    }
    if (!outputs.has(definition.queryField)) {
      errors.push(
        typedError(
          'QUERY_MAPPING_ERROR',
          path,
          `queryField ${definition.queryField} 不在 DQE 输出字段中`
        )
      );
    } else if (
      dimensions.includes(definition.queryField) &&
      definition.role !== 'dimension'
    ) {
      errors.push(
        typedError(
          'QUERY_MAPPING_ERROR',
          `${sourcePath}/fields/${escapePointer(fieldId)}/role`,
          `DQE 维度 ${definition.queryField} 的 role 必须为 dimension`
        )
      );
    } else if (
      metrics.includes(definition.queryField) &&
      definition.role !== 'measure'
    ) {
      errors.push(
        typedError(
          'QUERY_MAPPING_ERROR',
          `${sourcePath}/fields/${escapePointer(fieldId)}/role`,
          `DQE 度量 ${definition.queryField} 的 role 必须为 measure`
        )
      );
    }
  }

  for (const output of outputs) {
    if (!mapped.has(output)) {
      errors.push(
        typedError(
          'QUERY_MAPPING_ERROR',
          `${sourcePath}/fields`,
          `DQE 输出字段 ${output} 缺少显式 queryField 映射`
        )
      );
    }
  }

  for (const [filterId, binding] of Object.entries(query.filterBindings ?? {})) {
    const filter = filtersById.get(filterId);
    const path = `${sourcePath}/source/query/filterBindings/${escapePointer(filterId)}`;
    if (filter === undefined) {
      errors.push(
        typedError(
          'FILTER_BINDING_ERROR',
          path,
          `筛选绑定引用了未知筛选器:${filterId}`
        )
      );
    } else if (binding.target === 'time' && filter.type !== 'timeRange') {
      errors.push(
        typedError(
          'FILTER_BINDING_ERROR',
          path,
          `time 目标必须绑定 timeRange 筛选器:${filterId}`
        )
      );
    } else if (binding.target === 'dimension' && filter.type !== 'dimension') {
      errors.push(
        typedError(
          'FILTER_BINDING_ERROR',
          path,
          `dimension 目标必须绑定维度筛选器:${filterId}`
        )
      );
    }
  }
  return errors;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function dqeMetricNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string') return [item];
    if (
      typeof item === 'object' &&
      item !== null &&
      !Array.isArray(item) &&
      'alias' in item &&
      typeof item.alias === 'string'
    ) {
      return [item.alias];
    }
    return [];
  });
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
    if (typeof binding !== 'string' && binding.match !== undefined) {
      const matchPath = `${path}/match`;
      const matched = resolveBinding(
        page,
        component,
        { data: binding.data, field: binding.match.field }
      );
      if ('error' in matched) {
        errors.push(schemaError(`${matchPath}/field`, matched.error));
      } else {
        if (matched.field.role !== 'dimension') {
          errors.push(
            schemaError(
              `${matchPath}/field`,
              `行匹配字段 ${matched.fieldName} 的 role 必须为 dimension`
            )
          );
        }
        if (!matchesFieldValue(binding.match.equals, matched.field)) {
          errors.push(
            schemaError(
              `${matchPath}/equals`,
              `匹配值不符合字段 ${matched.fieldName} 的类型 ${matched.field.type}`
            )
          );
        }
      }
    }
  };

  switch (component.type) {
    case 'reportHeader':
    case 'text':
      break;
    case 'aiSummary': {
      const terms = new Map<string, string>();
      for (const [relatedId, related] of Object.entries(component.props.relatedData)) {
        const relatedPath =
          `${componentPath}/props/relatedData/${escapePointer(relatedId)}`;
        const source = page.dataSources[related.source];
        if (!source) {
          errors.push(
            schemaError(
              `${relatedPath}/source`,
              `关联数据引用了未知数据源:${related.source}`
            )
          );
          continue;
        }
        const fields = resolveDataSourceFields(source);
        const seen = new Set<string>();
        related.fields.forEach((binding, fieldIndex) => {
          const fieldPath = `${relatedPath}/fields/${fieldIndex}`;
          if (!Object.hasOwn(fields, binding.field)) {
            errors.push(
              schemaError(
                `${fieldPath}/field`,
                `关联字段 ${binding.field} 不在数据源 ${related.source} 中`
              )
            );
          }
          if (seen.has(binding.field)) {
            errors.push(
              schemaError(`${fieldPath}/field`, `关联字段重复:${binding.field}`)
            );
          }
          seen.add(binding.field);
          const previous = terms.get(binding.field);
          if (previous !== undefined && previous !== binding.term) {
            errors.push(
              schemaError(
                `${fieldPath}/term`,
                `关联字段 ${binding.field} 的术语映射冲突:${previous}/${binding.term}`
              )
            );
          } else {
            terms.set(binding.field, binding.term);
          }
        });
      }
      break;
    }
    case 'metricCard':
      component.props.rows.forEach((row, rowIndex) => {
        check(row.valueField, `${componentPath}/props/rows/${rowIndex}/valueField`, 'measure');
        (row.changes ?? []).forEach((change, changeIndex) =>
          check(
            change.field,
            `${componentPath}/props/rows/${rowIndex}/changes/${changeIndex}/field`,
            'measure'
          )
        );
      });
      if (component.props.progress) {
        check(
          component.props.progress.valueField,
          `${componentPath}/props/progress/valueField`,
          'measure'
        );
      }
      errors.push(...actionErrors(component.props.actions, componentPath, page, component, filterIds, check));
      break;
    case 'barChart':
      check(component.props.categoryField, `${componentPath}/props/categoryField`, 'dimension');
      component.props.series.forEach((series, index) =>
        check(series.field, `${componentPath}/props/series/${index}/field`, 'measure')
      );
      {
        const sourceId = component.data.main;
        const source = page.dataSources[sourceId];
        if (source && isQueryDataSource(source) && source.source.initial) {
          for (const issue of barForecastBoundaryIssues(
            component.props,
            source.source.initial.rows,
            source.source.initial.capturedAt
          )) {
            errors.push(
              schemaError(
                `/dataSources/${escapePointer(sourceId)}/source/initial/rows/${issue.rowIndex}/${escapePointer(issue.field)}`,
                issue.message
              )
            );
          }
        }
      }
      errors.push(...actionErrors(component.props.actions, componentPath, page, component, filterIds, check));
      break;
    case 'lineChart':
      check(component.props.xField, `${componentPath}/props/xField`, 'dimension');
      component.props.series.forEach((series, index) =>
        check(series.field, `${componentPath}/props/series/${index}/field`, 'measure')
      );
      errors.push(...actionErrors(component.props.actions, componentPath, page, component, filterIds, check));
      break;
    case 'pieChart':
      check(component.props.categoryField, `${componentPath}/props/categoryField`, 'dimension');
      check(component.props.valueField, `${componentPath}/props/valueField`, 'measure');
      errors.push(...actionErrors(component.props.actions, componentPath, page, component, filterIds, check));
      break;
    case 'table':
      errors.push(...tableDataErrors(page, component, componentPath));
      errors.push(
        ...tableErrors(
          component.props.columns,
          componentPath,
          check,
          new Map((page.filters ?? []).map((filter) => [filter.id, filter]))
        )
      );
      errors.push(...actionErrors(component.props.actions, componentPath, page, component, filterIds, check));
      break;
    case 'mapChart':
      check(component.props.nameField, `${componentPath}/props/nameField`, 'dimension');
      check(component.props.valueField, `${componentPath}/props/valueField`, 'measure');
      errors.push(...actionErrors(component.props.actions, componentPath, page, component, filterIds, check));
      break;
    case 'rankingCard':
      check(component.props.nameField, `${componentPath}/props/nameField`, 'dimension');
      check(component.props.valueField, `${componentPath}/props/valueField`, 'measure');
      if (component.props.changeField) {
        check(component.props.changeField, `${componentPath}/props/changeField`, 'measure');
      }
      errors.push(...actionErrors(component.props.actions, componentPath, page, component, filterIds, check));
      break;
    case 'rankingDetailCard':
      check(component.props.nameField, `${componentPath}/props/nameField`, 'dimension');
      check(component.props.valueField, `${componentPath}/props/valueField`, 'measure');
      if (component.props.changeField) {
        check(component.props.changeField, `${componentPath}/props/changeField`, 'measure');
      }
      (component.props.badgeFields ?? []).forEach((field, index) =>
        check(field, `${componentPath}/props/badgeFields/${index}`, 'dimension')
      );
      if (component.props.descriptionField) {
        check(
          component.props.descriptionField,
          `${componentPath}/props/descriptionField`,
          'dimension'
        );
      }
      break;
  }
  return errors;
}

function tableDataErrors(
  page: Page,
  component: Extract<Component, { type: 'table' }>,
  componentPath: string
): TypedError[] {
  const slots = Object.entries(component.data);
  if (slots.length <= 1) return [];
  const rowKey = component.props.rowKey;
  if (!rowKey) {
    return [
      schemaError(
        `${componentPath}/props/rowKey`,
        '多数据槽表格必须声明 rowKey'
      )
    ];
  }

  const errors: TypedError[] = [];
  let expectedType: FieldDefinition['type'] | undefined;
  for (const [slot, sourceId] of slots) {
    const source = page.dataSources[sourceId];
    if (!source) continue;
    const field = resolveDataSourceFields(source)[rowKey];
    const path = `${componentPath}/data/${escapePointer(slot)}`;
    if (!field) {
      errors.push(
        schemaError(path, `数据槽 ${slot} 的数据源 ${sourceId} 缺少 rowKey 字段:${rowKey}`)
      );
      continue;
    }
    if (field.role !== 'dimension') {
      errors.push(schemaError(path, `rowKey 字段 ${rowKey} 的 role 必须为 dimension`));
    }
    if (expectedType === undefined) expectedType = field.type;
    else if (field.type !== expectedType) {
      errors.push(
        schemaError(path, `rowKey 字段 ${rowKey} 的类型必须一致:${expectedType}/${field.type}`)
      );
    }
  }
  return errors;
}

function queryPaginationErrors(page: Page): TypedError[] {
  const errors: TypedError[] = [];
  const references = new Map<string, string[]>();
  const queryTables: Array<{
    sourceId: string;
    componentPath: string;
  }> = [];

  const addReference = (sourceId: string, path: string) => {
    const paths = references.get(sourceId) ?? [];
    paths.push(path);
    references.set(sourceId, paths);
  };

  page.sections.forEach((section, sectionIndex) => {
    section.components.forEach((component, componentIndex) => {
      const componentPath = `/sections/${sectionIndex}/components/${componentIndex}`;
      for (const [slot, sourceId] of Object.entries(component.data ?? {})) {
        addReference(sourceId, `${componentPath}/data/${escapePointer(slot)}`);
      }
      if (component.type === 'aiSummary') {
        for (const [name, related] of Object.entries(component.props.relatedData)) {
          addReference(
            related.source,
            `${componentPath}/props/relatedData/${escapePointer(name)}/source`
          );
        }
      }
      if (component.type !== 'table') return;
      const pagination = component.props.pagination;
      const sourceId = component.data.main;
      const source = page.dataSources[sourceId];
      if (pagination?.mode === 'local' && source?.source.type !== 'inline') {
        errors.push(
          schemaError(
            `${componentPath}/props/pagination/mode`,
            `pagination.mode='local' 只允许绑定 inline 数据源:${sourceId}`
          )
        );
      }
      if (pagination?.mode !== 'query') return;
      if (source?.source.type !== 'query') {
        errors.push(
          schemaError(
            `${componentPath}/props/pagination/mode`,
            `pagination.mode='query' 只允许绑定 query 数据源:${sourceId}`
          )
        );
        return;
      }
      queryTables.push({ sourceId, componentPath });
      const item = source.source.query.body.dsl_list[0];
      const order = jsonRecord(item.order);
      if (!order || order.offset !== 0) {
        errors.push(
          schemaError(
            `/dataSources/${escapePointer(sourceId)}/source/query/body/dsl_list/0/order/offset`,
            '查询分页要求 DQE order.offset 为 0'
          )
        );
      }
      if (!order || !Number.isInteger(order.limit) || Number(order.limit) <= 0) {
        errors.push(
          schemaError(
            `/dataSources/${escapePointer(sourceId)}/source/query/body/dsl_list/0/order/limit`,
            '查询分页要求 DQE order.limit 为正整数'
          )
        );
      }
      const initial = source.source.initial;
      if (initial) {
        if (initial.totalCount === undefined) {
          errors.push(
            schemaError(
              `/dataSources/${escapePointer(sourceId)}/source/initial/totalCount`,
              '查询分页的内嵌初始行必须声明 totalCount'
            )
          );
        } else if (
          order &&
          Number.isInteger(order.limit) &&
          initial.rows.length !== Math.min(Number(order.limit), initial.totalCount)
        ) {
          errors.push(
            schemaError(
              `/dataSources/${escapePointer(sourceId)}/source/initial/rows`,
              '查询分页的内嵌初始行必须是完整第一页'
            )
          );
        }
      }
      rejectQueryTableViewColumns(component.props.columns, componentPath, errors);
    });
  });

  for (const { sourceId, componentPath } of queryTables) {
    const usages = references.get(sourceId) ?? [];
    if (usages.length !== 1) {
      errors.push(
        schemaError(
          `${componentPath}/data/main`,
          `查询分页表格必须独占页面数据源 ${sourceId}，当前引用 ${usages.length} 次`
        )
      );
    }
  }
  return errors;
}

function rejectQueryTableViewColumns(
  columns: TableColumnNode[],
  componentPath: string,
  errors: TypedError[]
): void {
  const visit = (column: TableColumnNode, path: string) => {
    if (column.kind === 'group') {
      column.children.forEach((child, index) => visit(child, `${path}/children/${index}`));
      return;
    }
    if (column.sortable) {
      errors.push(schemaError(`${path}/sortable`, '查询分页暂不支持排序'));
    }
    if (column.filterable) {
      errors.push(schemaError(`${path}/filterable`, '查询分页暂不支持表头筛选'));
    }
  };
  columns.forEach((column, index) =>
    visit(column, `${componentPath}/props/columns/${index}`)
  );
}

function jsonRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

type BindingCheck = (
  binding: FieldBinding,
  path: string,
  expectedRole?: FieldDefinition['role']
) => void;

function tableErrors(
  columns: TableColumnNode[],
  componentPath: string,
  check: BindingCheck,
  filters: ReadonlyMap<string, FilterDeclaration>
): TypedError[] {
  const errors: TypedError[] = [];
  const seen = new Set<string>();
  const visit = (column: TableColumnNode, path: string) => {
    if (column.kind === 'group') {
      column.children.forEach((child, index) => visit(child, `${path}/children/${index}`));
      return;
    }
    check(column.field, `${path}/field`);
    if (column.secondaryField) check(column.secondaryField, `${path}/secondaryField`);
    if (column.badgeField) check(column.badgeField, `${path}/badgeField`);
    for (const [filterId, write] of Object.entries(column.selection?.writes ?? {})) {
      const target = filters.get(filterId);
      if (!target) {
        errors.push(
          schemaError(`${path}/selection/writes/${escapePointer(filterId)}`, `写入了未声明的筛选器:${filterId}`)
        );
      } else if (target.type !== 'dimension') {
        errors.push(
          schemaError(
            `${path}/selection/writes/${escapePointer(filterId)}`,
            `单元格选择只能写入 dimension 筛选器:${filterId}`
          )
        );
      }
      if ('field' in write) {
        check(write.field, `${path}/selection/writes/${escapePointer(filterId)}/field`);
      }
    }
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
  const field = resolveDataSourceFields(source)[fieldName];
  if (field === undefined) {
    return { error: `字段 ${fieldName} 不在数据槽 ${slot} 的数据源 ${sourceId} 中` };
  }
  return { field, fieldName };
}

function bindingKey(binding: FieldBinding): string {
  return typeof binding === 'string' ? `main:${binding}` : `${binding.data}:${binding.field}`;
}

function schemaError(path: string, message: string): TypedError {
  return { type: 'SCHEMA_ERROR', path, message };
}

function typedError(
  type: TypedError['type'],
  path: string,
  message: string
): TypedError {
  return { type, path, message };
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
