import { Ajv, type ErrorObject } from 'ajv';
import {
  isInlineDataSource,
  isQueryDataSource,
  resolveDataSourceFields,
  type DataSource,
  type QueryDataSource
} from './data-source';
import {
  computeOutputFields,
  isFoldingOperator,
  type ComputeOperator
} from './compute';
import type { TypedError } from './errors';
import {
  fieldName as fieldNameOf,
  hasQueryFieldMapping,
  type FieldBinding,
  type FieldDefinition,
  type FieldValue
} from './field';
import {
  isRelativeTimeExpression,
  isTimeRangeValue,
  validateCalendarTimeRange,
  validateTimePointValue,
  type FilterDeclaration
} from './filter';
import {
  deriveComponentCapabilities,
  type Component,
  type ComponentAction,
  type ComponentData,
  type Page,
  type PageSection,
  type TableColumnNode
} from './page';
import {
  walkComponents,
  walkDocumentComponents,
  walkPageComponents
} from './component-walk';
import { compositeCardChildTypes } from './schema/component';
import { materializePageDocument } from './materialize';
import { pageParamErrors, type PageParamDeclaration } from './page-param';
import type { TextValueResolution } from './text-value';
import {
  matchesFieldValue,
  validateContractRows,
  type RowContractIssue
} from './result-field-contract';
import { barForecastBoundaryIssues } from './bar-forecast-boundary';
import { pageSchema } from './schema';
import { capabilityFloorErrors, versionErrors } from './version';

const ajv = new Ajv({ allErrors: true, strict: false });
const validateStructure = ajv.compile(pageSchema);

export type PageParseResult =
  | { ok: true; page: Page; errors: [] }
  | { ok: false; errors: TypedError[] };

export interface PageParseOptions {
  /**
   * 本次打开的页面参数取值与展示格式化。缺省时按校验期代入处理:
   * 必需参数代入默认值或占位符,可选参数按缺席处理(见 `validationResolution`)。
   */
  textValues?: TextValueResolution;
}

/** 不可信文档通过结构、字段分组、引用、字段契约和能力校验后才可视为 Page。 */
export function parsePage(
  document: unknown,
  options: PageParseOptions = {}
): PageParseResult {
  if (!validateStructure(document)) {
    const structural = (validateStructure.errors ?? []).map(toTypedError);
    const guided = [...versionErrors(document), ...compositeCardStructureErrors(document)];
    if (guided.length > 0) {
      return { ok: false, errors: [...guided, ...withoutGuidedPaths(structural, guided)] };
    }
    return { ok: false, errors: structural };
  }

  // 能力下限与页面参数判定都必须跑在文本取值替换之前:替换会把引用消解掉,
  // 拿解析产物去判会漏掉「声明 5.0 却引用了页面参数」这类文档。
  const declarations = pageParamDeclarations(document);
  const documentErrors = [
    ...capabilityFloorErrors(document),
    ...pageParamErrors(
      declarations,
      new Set(filterDeclarations(document).map((filter) => filter.id)),
      document
    )
  ];
  if (documentErrors.length > 0) return { ok: false, errors: documentErrors };

  const materialized = materializePageDocument(document, options.textValues);
  if (materialized.errors.length > 0) {
    return { ok: false, errors: materialized.errors };
  }
  if (!validateStructure(materialized.document)) {
    const structural = (validateStructure.errors ?? []).map(toTypedError);
    return {
      ok: false,
      errors: declarations.some((declaration) => !declaration.required)
        ? [...structural, optionalParamHint()]
        : structural
    };
  }

  const page = materialized.document as Page;
  const errors = invariantErrors(page);
  return errors.length === 0
    ? { ok: true, page, errors: [] }
    : { ok: false, errors };
}

/**
 * 少数几处形状由结构自己说不清楚:版本枚举失配读起来像「取值不在允许范围」,
 * 判别联合失配在 ajv 侧摊成一堆 anyOf 分支错误。这些位置先给出定位到位的
 * 引导错误,再把它们已经解释过的那段结构噪声去掉。
 */
function withoutGuidedPaths(
  structural: TypedError[],
  guided: TypedError[]
): TypedError[] {
  return structural.filter(
    (error) =>
      !guided.some(
        (hint) => error.path === hint.path || error.path.startsWith(`${hint.path}/`)
      )
  );
}

/**
 * 组合卡的四条结构不变量(ADR-0053)。它们都在结构校验的接缝上判定,读的是
 * **原始文档**:白名单由判别联合表达,失配后 ajv 只会说某个分支不匹配,说不出
 * 「这个子组件类型不在白名单里」。
 *
 * 纯容器与至少一个子组件同样在这里,理由一致——`additionalProperties` 与
 * `minItems` 的原文都不解释为什么。
 */
function compositeCardStructureErrors(document: unknown): TypedError[] {
  const errors: TypedError[] = [];
  walkDocumentComponents(document, (component, path) => {
    if (component.type !== 'compositeCard') return;
    if (component.data !== undefined) {
      errors.push(
        schemaError(
          `${path}/data`,
          '组合卡是纯容器，自己不承载数据，不得声明 data；数据由子组件各自声明'
        )
      );
    }
    const props = component.props as Record<string, unknown> | undefined;
    if (props?.actions !== undefined) {
      errors.push(
        schemaError(
          `${path}/props/actions`,
          '组合卡是纯容器，不承载交互，不得声明 actions；卡里哪个数字可点由那个数字所属的子组件自己声明'
        )
      );
    }
    const children = props?.components;
    if (!Array.isArray(children)) return;
    if (children.length === 0) {
      errors.push(schemaError(`${path}/props/components`, '组合卡至少要有一个子组件'));
      return;
    }
    children.forEach((candidate, index) => {
      const childType = (candidate as { type?: unknown } | null)?.type;
      if (typeof childType !== 'string') return;
      if (childType === 'compositeCard' || childType === 'tabContainer') {
        errors.push(
          schemaError(
            `${path}/props/components/${index}`,
            `组合卡内不得再嵌套容器组件:${childType}；页面树最深到「分区 → 组合卡 → 组件」三层`
          )
        );
        return;
      }
      if (!compositeCardChildTypes.includes(childType)) {
        errors.push(
          schemaError(
            `${path}/props/components/${index}`,
            `组合卡子组件不在白名单内:${childType}；当前只准入 ${compositeCardChildTypes.join(' / ')}`
          )
        );
      }
    });
  });
  return errors;
}

/**
 * 可选参数缺失时引用处整体消失,必填文本属性因此不能引用可选参数。
 * 这条规则不需要一张按位置枚举的必填性表:代入可选参数缺席后再做一次
 * 结构复检,缺了必填属性的文档自然过不去,这里只补上原因。
 */
function optionalParamHint(): TypedError {
  return schemaError(
    '/params',
    '可选页面参数缺失时引用处整体消失；必填文本属性只能引用必需参数'
  );
}

function pageParamDeclarations(document: unknown): PageParamDeclaration[] {
  const params = (document as { params?: unknown } | null)?.params;
  return Array.isArray(params) ? (params as PageParamDeclaration[]) : [];
}

function filterDeclarations(document: unknown): FilterDeclaration[] {
  const filters = (document as { filters?: unknown } | null)?.filters;
  return Array.isArray(filters) ? (filters as FilterDeclaration[]) : [];
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
    errors.push(...filterDeclarationErrors(filter, index, `/filters/${index}`));
  });
  errors.push(...filterDependsOnErrors(filters));

  for (const [sourceId, dataSource] of Object.entries(page.dataSources)) {
    const path = `/dataSources/${escapePointer(sourceId)}`;
    errors.push(...computeErrors(dataSource, path));
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
    errors.push(...sectionLayerErrors(section, sectionIndex));

    walkComponents(section.components, `/sections/${sectionIndex}/components`, (component, path) => {
      if (componentIds.has(component.id)) {
        errors.push(schemaError(`${path}/id`, `component id 重复:${component.id}`));
      }
      componentIds.add(component.id);
      errors.push(...componentErrors(page, component, path, filterIds));
    });
  });
  errors.push(...queryPaginationErrors(page));

  return errors;
}

/**
 * 叠放层是分区内的层次声明，因此三条边界都由分区自己决定：`backdrop`
 * 只能出现在分区顶层（Tab 内没有分区可铺满）、一个分区最多一个、且
 * 分区必须还有别的组件叠在它上面，否则叠放本身没有意义。外观由
 * `container: plain` 承载——分区自带外壳时铺满的组件会被壳裁掉。
 */
function sectionLayerErrors(section: PageSection, sectionIndex: number): TypedError[] {
  const errors: TypedError[] = [];
  const basePath = `/sections/${sectionIndex}/components`;

  walkComponents(section.components, basePath, (component, path) => {
    if (component.layout.layer === undefined) return;
    const topLevel = /^\/sections\/\d+\/components\/\d+$/.test(path);
    if (!topLevel) {
      errors.push(
        schemaError(`${path}/layout/layer`, 'layout.layer 只能声明在内容分区的顶层组件上')
      );
    }
  });

  const backdrops = section.components.filter(
    (component) => component.layout.layer === 'backdrop'
  );
  if (backdrops.length === 0) return errors;

  if (backdrops.length > 1) {
    section.components.forEach((component, index) => {
      if (component.layout.layer !== 'backdrop') return;
      errors.push(
        schemaError(
          `${basePath}/${index}/layout/layer`,
          `内容分区 ${section.id} 声明了 ${backdrops.length} 个 backdrop，最多允许一个`
        )
      );
    });
  }
  if (section.components.length === backdrops.length) {
    errors.push(
      schemaError(
        `/sections/${sectionIndex}/components`,
        `内容分区 ${section.id} 只有 backdrop 组件，没有可叠放其上的组件`
      )
    );
  }
  if (section.container !== 'plain') {
    errors.push(
      schemaError(
        `/sections/${sectionIndex}/container`,
        `声明 backdrop 的内容分区必须使用 container: plain，当前为 ${
          section.container ?? '缺省'
        }`
      )
    );
  }
  return errors;
}

function filterDeclarationErrors(
  filter: FilterDeclaration,
  _index: number,
  path: string
): TypedError[] {
  const errors: TypedError[] = [];
  if (filter.type === 'timeRange') {
    if (filter.default !== undefined && typeof filter.default !== 'string') {
      if (isTimeRangeValue(filter.default)) {
        for (const issue of validateCalendarTimeRange(
          filter.default,
          filter.precision ?? 'date'
        )) {
          errors.push(
            schemaError(
              `${path}/default${issue.field === null ? '' : `/${issue.field}`}`,
              issue.message
            )
          );
        }
      } else if (isRelativeTimeExpression(filter.default) && filter.default.anchor) {
        const issue = validateTimePointValue(filter.default.anchor, 'date');
        if (issue) errors.push(schemaError(`${path}/default/anchor`, issue));
      }
    }
  } else if (filter.type === 'timePoint' && filter.default !== undefined) {
    const issue = validateTimePointValue(filter.default, filter.granularity);
    if (issue) errors.push(schemaError(`${path}/default`, issue));
  } else if (filter.type === 'numberRange' && filter.default) {
    const { from, to } = filter.default;
    if (from === undefined && to === undefined) {
      errors.push(schemaError(`${path}/default`, '数值区间至少要有一端'));
    } else if (from !== undefined && to !== undefined && from > to) {
      errors.push(schemaError(`${path}/default`, '数值区间 from 不得大于 to'));
    }
  } else if (filter.type === 'dimension') {
    const hierarchy = filter.hierarchy ?? [];
    const levelIds = new Set<string>();
    hierarchy.forEach((level, levelIndex) => {
      if (levelIds.has(level.id)) {
        errors.push(schemaError(`${path}/hierarchy/${levelIndex}/id`, `层级 id 重复:${level.id}`));
      }
      levelIds.add(level.id);
    });
    if (filter.defaultLevel) {
      if (hierarchy.length === 0) {
        errors.push(schemaError(`${path}/defaultLevel`, 'defaultLevel 只能用于声明了 hierarchy 的维度筛选器'));
      } else if (!levelIds.has(filter.defaultLevel)) {
        errors.push(
          schemaError(`${path}/defaultLevel`, `defaultLevel 引用了未知层级:${filter.defaultLevel}`)
        );
      }
    }
  }
  return errors;
}

function filterDependsOnErrors(filters: FilterDeclaration[]): TypedError[] {
  const errors: TypedError[] = [];
  const byId = new Map(filters.map((filter) => [filter.id, filter]));
  filters.forEach((filter, index) => {
    if (filter.type !== 'dimension' || !filter.dependsOn) return;
    const path = `/filters/${index}/dependsOn`;
    if (filter.dependsOn === filter.id) {
      errors.push(schemaError(path, '筛选器不能依赖自己'));
      return;
    }
    const upstream = byId.get(filter.dependsOn);
    if (!upstream) {
      errors.push(schemaError(path, `dependsOn 引用了未声明的筛选器:${filter.dependsOn}`));
      return;
    }
    if (upstream.type !== 'dimension') {
      errors.push(schemaError(path, `级联上游必须是 dimension 筛选器:${filter.dependsOn}`));
      return;
    }
    if (hasDependsOnCycle(filter.id, byId)) {
      errors.push(schemaError(path, `筛选器级联存在循环:${filter.id}`));
    }
  });
  return errors;
}

function hasDependsOnCycle(
  startId: string,
  byId: ReadonlyMap<string, FilterDeclaration>
): boolean {
  const seen = new Set<string>();
  let current: string | undefined = startId;
  while (current) {
    if (seen.has(current)) return true;
    seen.add(current);
    const filter = byId.get(current);
    current = filter?.type === 'dimension' ? filter.dependsOn : undefined;
  }
  return false;
}

function inlineRowErrors(dataSource: DataSource, sourcePath: string): TypedError[] {
  if (!isInlineDataSource(dataSource)) return [];
  return rowContractErrors(
    dataSource.source.rows,
    inputFields(dataSource),
    `${sourcePath}/source/rows`
  );
}

/**
 * 算子的输入字段契约:结果字段契约减去算子产出字段。数据行是算子的输入,
 * 产出字段既不该在行里出现,也不该被要求出现。
 */
function inputFields<Field extends FieldDefinition>(dataSource: {
  fields: Record<string, Field>;
  compute?: ComputeOperator[];
}): Record<string, Field> {
  const produced = new Set(computeOutputFields(dataSource.compute ?? []));
  if (produced.size === 0) return dataSource.fields;
  return Object.fromEntries(
    Object.entries(dataSource.fields).filter(([fieldId]) => !produced.has(fieldId))
  ) as Record<string, Field>;
}

function rowContractErrors(
  rows: ReadonlyArray<Record<string, FieldValue>>,
  fields: Record<string, FieldDefinition>,
  rowsPath: string
): TypedError[] {
  const result = validateContractRows(rows, fields);
  if (result.ok) return [];
  return result.issues.map((issue) => rowContractError(issue, rowsPath));
}

/** 共享校验的结构化问题 → 指向页面文档数据行的定位错误。 */
function rowContractError(issue: RowContractIssue, rowsPath: string): TypedError {
  switch (issue.code) {
    case 'ROWS_NOT_ARRAY':
      return schemaError(rowsPath, '数据行必须是数组');
    case 'ROW_NOT_OBJECT':
      return schemaError(`${rowsPath}/${issue.rowIndex}`, '数据行必须是对象');
  }
  const fieldPath = `${rowsPath}/${issue.rowIndex}/${escapePointer(issue.fieldId)}`;
  switch (issue.code) {
    case 'UNDECLARED_FIELD':
      return schemaError(fieldPath, `行包含未声明字段:${issue.fieldId}`);
    case 'MISSING_FIELD':
      return schemaError(fieldPath, `行缺少字段:${issue.fieldId}`);
    case 'NULL_NOT_ALLOWED':
      return schemaError(
        fieldPath,
        `字段 ${issue.fieldId} 声明 nullable=false,不允许为 null`
      );
    case 'TYPE_MISMATCH':
      return schemaError(
        fieldPath,
        `字段 ${issue.fieldId} 的值不符合类型 ${issue.expectedType}`
      );
    case 'DETAIL_LIST_TOO_LARGE':
      return schemaError(
        fieldPath,
        `嵌套明细字段 ${issue.fieldId} 最多允许 ${issue.maximum} 项，实际 ${issue.actualLength} 项`
      );
    case 'SEMANTIC_HTML_TOO_LARGE':
      return schemaError(
        fieldPath,
        `语义 HTML 字段 ${issue.fieldId} 最多允许 ${issue.maximum} 字符，实际 ${issue.actualLength} 字符`
      );
    case 'DETAIL_ITEM_NOT_OBJECT':
      return schemaError(
        `${fieldPath}/${issue.itemIndex}`,
        `嵌套明细字段 ${issue.fieldId} 的第 ${issue.itemIndex + 1} 项必须是对象`
      );
    case 'DETAIL_UNDECLARED_FIELD':
      return schemaError(
        `${fieldPath}/${issue.itemIndex}/${escapePointer(issue.itemFieldId)}`,
        `嵌套明细项包含未声明字段:${issue.itemFieldId}`
      );
    case 'DETAIL_MISSING_FIELD':
      return schemaError(
        `${fieldPath}/${issue.itemIndex}/${escapePointer(issue.itemFieldId)}`,
        `嵌套明细项缺少字段:${issue.itemFieldId}`
      );
    case 'DETAIL_NULL_NOT_ALLOWED':
      return schemaError(
        `${fieldPath}/${issue.itemIndex}/${escapePointer(issue.itemFieldId)}`,
        `嵌套明细项字段 ${issue.itemFieldId} 声明 nullable=false,不允许为 null`
      );
    case 'DETAIL_TYPE_MISMATCH':
      return schemaError(
        `${fieldPath}/${issue.itemIndex}/${escapePointer(issue.itemFieldId)}`,
        `嵌套明细项字段 ${issue.itemFieldId} 的值不符合类型 ${issue.expectedType}`
      );
  }
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
        inputFields(dataSource),
        `${sourcePath}/source/initial/rows`
      )
    );
  }

  const produced = new Set(computeOutputFields(dataSource.compute ?? []));
  for (const [fieldId, definition] of Object.entries(dataSource.fields)) {
    if (!hasQueryFieldMapping(definition)) {
      // 没有 queryField 的字段只能是计算阶段产出;否则它永远拿不到值。
      if (!produced.has(fieldId)) {
        errors.push(
          typedError(
            'QUERY_MAPPING_ERROR',
            `${sourcePath}/fields/${escapePointer(fieldId)}`,
            `页面字段 ${fieldId} 既没有 queryField 映射，也不是计算阶段产出字段`
          )
        );
      }
      continue;
    }
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
    } else if (definition.role === 'detail') {
      if (definition.type === 'recordList') {
        const itemMappings = new Map<string, string>();
        for (const [itemFieldId, itemDefinition] of Object.entries(definition.items.fields)) {
          const itemPath =
            `${sourcePath}/fields/${escapePointer(fieldId)}/items/fields/` +
            `${escapePointer(itemFieldId)}/queryField`;
          const previousItem = itemMappings.get(itemDefinition.queryField);
          if (previousItem !== undefined) {
            errors.push(
              typedError(
                'QUERY_MAPPING_ERROR',
                itemPath,
                `嵌套明细 queryField ${itemDefinition.queryField} 已映射到页面字段 ${previousItem}`
              )
            );
          } else {
            itemMappings.set(itemDefinition.queryField, itemFieldId);
          }
        }
      }
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

/**
 * 受控计算阶段的判定(ADR-0046):算子输入字段存在且角色相容、产出字段已在
 * 结果字段契约中声明且不来自外部响应、折叠类算子的可折叠声明齐全、
 * 产出字段之间不重名。算子按声明顺序作用,后一个算子可以消费前一个的产出。
 */
function computeErrors(dataSource: DataSource, sourcePath: string): TypedError[] {
  const operators = dataSource.compute ?? [];
  if (operators.length === 0) return [];

  const errors: TypedError[] = [];
  const fields = dataSource.fields as Record<string, FieldDefinition>;
  const produced = new Set<string>();
  const rowKindFields = new Set<string>();

  const declared = (
    fieldId: string,
    path: string,
    expectedRole?: FieldDefinition['role']
  ): FieldDefinition | undefined => {
    const field = fields[fieldId];
    if (!field) {
      errors.push(schemaError(path, `算子引用了未声明的字段:${fieldId}`));
      return undefined;
    }
    if (expectedRole !== undefined && field.role !== expectedRole) {
      errors.push(
        schemaError(path, `字段 ${fieldId} 的 role 为 ${field.role}，此处要求 ${expectedRole}`)
      );
    }
    return field;
  };

  const numericInput = (fieldId: string, path: string) => {
    const field = declared(fieldId, path, 'measure');
    if (field && field.type !== 'number' && field.type !== 'money') {
      errors.push(schemaError(path, `字段 ${fieldId} 的类型 ${field.type} 不能参与数值算子`));
    }
  };

  const output = (fieldId: string, path: string, expectedRole: FieldDefinition['role']) => {
    if (produced.has(fieldId)) {
      errors.push(schemaError(path, `算子产出字段重复:${fieldId}`));
    }
    produced.add(fieldId);
    const field = declared(fieldId, path, expectedRole);
    if (field && 'queryField' in field) {
      errors.push(
        schemaError(path, `算子产出字段 ${fieldId} 不来自外部响应，不得声明 queryField`)
      );
    }
  };

  const collapsibleMeasures = (measures: string[], path: string) => {
    measures.forEach((fieldId, index) => {
      const measurePath = `${path}/${index}`;
      const field = declared(fieldId, measurePath, 'measure');
      if (field && field.role === 'measure' && field.collapsible !== true) {
        errors.push(
          schemaError(
            measurePath,
            `折叠算子只能作用于显式声明 collapsible 的度量字段:${fieldId}`
          )
        );
      }
    });
  };

  const rowKind = (mark: { field: string }, path: string) => {
    rowKindFields.add(mark.field);
    const field = declared(mark.field, `${path}/field`, 'dimension');
    if (field && field.type !== 'string') {
      errors.push(
        schemaError(`${path}/field`, `行类别字段 ${mark.field} 必须是 string 类型`)
      );
    }
    if (field && field.nullable === false) {
      errors.push(
        schemaError(
          `${path}/field`,
          `行类别字段 ${mark.field} 在明细行上没有取值，必须允许为空`
        )
      );
    }
  };

  operators.forEach((operator, index) => {
    const path = `${sourcePath}/compute/${index}`;
    switch (operator.op) {
      case 'ratio':
        numericInput(operator.numerator, `${path}/numerator`);
        numericInput(operator.denominator, `${path}/denominator`);
        output(operator.output, `${path}/output`, 'measure');
        break;
      case 'delta':
        numericInput(operator.minuend, `${path}/minuend`);
        numericInput(operator.subtrahend, `${path}/subtrahend`);
        output(operator.output, `${path}/output`, 'measure');
        break;
      case 'groupSubtotal':
        declared(operator.groupBy, `${path}/groupBy`, 'dimension');
        collapsibleMeasures(operator.measures, `${path}/measures`);
        rowKind(operator.rowKind, `${path}/rowKind`);
        break;
      case 'grandTotal':
        collapsibleMeasures(operator.measures, `${path}/measures`);
        rowKind(operator.rowKind, `${path}/rowKind`);
        declared(operator.label.field, `${path}/label/field`, 'dimension');
        break;
      case 'pivot': {
        declared(operator.categoryField, `${path}/categoryField`, 'dimension');
        declared(operator.valueField, `${path}/valueField`, 'measure');
        (operator.keyFields ?? []).forEach((fieldId, keyIndex) =>
          declared(fieldId, `${path}/keyFields/${keyIndex}`, 'dimension')
        );
        const categories = new Set<string>();
        operator.columns.forEach((column, columnIndex) => {
          const columnPath = `${path}/columns/${columnIndex}`;
          output(column.output, `${columnPath}/output`, 'measure');
          column.categories.forEach((category, categoryIndex) => {
            if (categories.has(category)) {
              errors.push(
                schemaError(
                  `${columnPath}/categories/${categoryIndex}`,
                  `类别取值已映射到其它目标列:${category}`
                )
              );
            }
            categories.add(category);
          });
        });
        break;
      }
    }
  });

  // 行类别字段由多个折叠算子共同写入,不算重复产出;这里补回它的产出身份。
  for (const fieldId of rowKindFields) produced.add(fieldId);

  const rows =
    dataSource.source.type === 'inline'
      ? { rows: dataSource.source.rows, path: `${sourcePath}/source/rows` }
      : dataSource.source.initial
        ? { rows: dataSource.source.initial.rows, path: `${sourcePath}/source/initial/rows` }
        : undefined;
  if (rows) {
    rows.rows.forEach((row, rowIndex) => {
      for (const fieldId of Object.keys(row)) {
        if (!produced.has(fieldId)) continue;
        errors.push(
          schemaError(
            `${rows.path}/${rowIndex}/${escapePointer(fieldId)}`,
            `算子产出字段 ${fieldId} 不得出现在数据行中，它由计算阶段产出`
          )
        );
      }
    });
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
    expectedRole?: FieldDefinition['role'],
    allowedDetailType?: FieldDefinition['type']
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
    } else if (
      expectedRole === undefined &&
      resolved.field.role === 'detail' &&
      resolved.field.type !== allowedDetailType
    ) {
      errors.push(
        schemaError(
          path,
          allowedDetailType === undefined
            ? `嵌套明细字段 ${resolved.fieldName} 只能由显式支持 detail 的组件属性消费`
            : `此组件属性只支持 ${allowedDetailType} 类型的 detail 字段:${resolved.fieldName}`
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
    /*
     * 组合卡自己没有可判的东西:子组件由 `walkComponents` 单独走到,
     * 结构不变量在解析接缝由 `compositeCardStructureErrors` 判定,
     * 卡内禁 `layout.layer` 归 `sectionLayerErrors`(与 Tab 同一条规则)。
     */
    case 'compositeCard':
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
          } else if (fields[binding.field]?.role === 'detail') {
            errors.push(
              schemaError(
                `${fieldPath}/field`,
                `AI 总结暂不支持嵌套明细字段:${binding.field}`
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
      errors.push(...tablePresentationErrors(page, component, componentPath));
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
    case 'keyValuePanel':
      component.props.items.forEach((item, index) =>
        check(item.field, `${componentPath}/props/items/${index}/field`)
      );
      break;
    case 'categoryBreakdown':
      check(component.props.categoryField, `${componentPath}/props/categoryField`, 'dimension');
      component.props.columns.forEach((column, index) =>
        check(column.field, `${componentPath}/props/columns/${index}/field`, 'measure')
      );
      errors.push(...categorySwatchErrors(page, component, componentPath));
      break;
    case 'fieldText': {
      const path = `${componentPath}/props/field`;
      check(component.props.field, path, undefined, 'semanticHtml');
      break;
    }
    case 'mapChart':
      check(component.props.nameField, `${componentPath}/props/nameField`, 'dimension');
      check(component.props.valueField, `${componentPath}/props/valueField`, 'measure');
      (component.props.tooltipFields ?? []).forEach((item, index) =>
        check(item.field, `${componentPath}/props/tooltipFields/${index}/field`)
      );
      errors.push(...mapLegendErrors(component, componentPath));
      errors.push(...mapHierarchyErrors(page, component, componentPath, check));
      errors.push(...actionErrors(component.props.actions, componentPath, page, component, filterIds, check));
      break;
    case 'gauge':
      check(component.props.valueField, `${componentPath}/props/valueField`, 'measure');
      errors.push(...actionErrors(component.props.actions, componentPath, page, component, filterIds, check));
      break;
    case 'tabContainer': {
      const tabIds = new Set<string>();
      component.props.tabs.forEach((tab, tabIndex) => {
        if (tabIds.has(tab.id)) {
          errors.push(
            schemaError(`${componentPath}/props/tabs/${tabIndex}/id`, `Tab id 重复:${tab.id}`)
          );
        }
        tabIds.add(tab.id);
      });
      if (
        component.props.defaultTab !== undefined &&
        !tabIds.has(component.props.defaultTab)
      ) {
        errors.push(
          schemaError(
            `${componentPath}/props/defaultTab`,
            `defaultTab 不是已声明的 Tab:${component.props.defaultTab}`
          )
        );
      }
      break;
    }
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
      if (component.props.semanticDescriptionField) {
        const path = `${componentPath}/props/semanticDescriptionField`;
        check(component.props.semanticDescriptionField, path, 'detail');
        const resolved = resolveBinding(
          page,
          component,
          component.props.semanticDescriptionField
        );
        if (!('error' in resolved) && resolved.field.type !== 'semanticHtml') {
          errors.push(
            schemaError(
              path,
              `语义 HTML 说明必须绑定 semanticHtml 字段:${resolved.fieldName}`
            )
          );
        }
      }
      if (component.props.details) {
        const detailsPath = `${componentPath}/props/details`;
        const details = component.props.details;
        check(details.field, `${detailsPath}/field`, 'detail');
        const resolved = resolveBinding(page, component, details.field);
        if (!('error' in resolved)) {
          if (resolved.field.type !== 'recordList') {
            errors.push(
              schemaError(
                `${detailsPath}/field`,
                `结构化明细必须绑定 recordList 字段:${resolved.fieldName}`
              )
            );
            break;
          }
          const itemFields = resolved.field.items.fields;
          const detailFieldName = resolved.fieldName;
          checkDetailItemField(
            details.titleField,
            `${detailsPath}/titleField`,
            'dimension'
          );
          if (details.valueField) {
            checkDetailItemField(
              details.valueField.field,
              `${detailsPath}/valueField/field`,
              'measure'
            );
          }
          if (details.descriptionField) {
            checkDetailItemField(
              details.descriptionField,
              `${detailsPath}/descriptionField`,
              'dimension'
            );
          }

          function checkDetailItemField(
            fieldName: string,
            path: string,
            expectedRole: 'dimension' | 'measure'
          ): void {
            const field = itemFields[fieldName];
            if (!field) {
              errors.push(
                schemaError(
                  path,
                  `嵌套明细字段 ${detailFieldName} 不包含项字段:${fieldName}`
                )
              );
            } else if (field.role !== expectedRole) {
              errors.push(
                schemaError(
                  path,
                  `嵌套明细项字段 ${fieldName} 的 role 为 ${field.role}，此处要求 ${expectedRole}`
                )
              );
            }
          }
        }
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

/**
 * 表格呈现能力的判定(ADR-0049)。
 *
 * 行类别字段在计算层与表格之间是一份跨层契约:算子产出什么标记、表格认
 * 哪些标记,两侧必须同时校验,否则会出现「算出了合计行却渲染成普通明细行」
 * 这种只能靠肉眼发现的偏差。因此这里要求行类别字段确由该数据源上的折叠
 * 算子写入,而不只是「存在这么一个字段」。
 */
function tablePresentationErrors(
  page: Page,
  component: Extract<Component, { type: 'table' }>,
  componentPath: string
): TypedError[] {
  const errors: TypedError[] = [];
  const source = page.dataSources[component.data.main];
  if (!source) return errors;
  const fields = resolveDataSourceFields(source);

  const { rowKindField, mergeBy } = component.props;
  if (rowKindField !== undefined) {
    const path = `${componentPath}/props/rowKindField`;
    const field = fields[rowKindField];
    if (!field) {
      errors.push(
        schemaError(path, `行类别字段 ${rowKindField} 不在数据源 ${component.data.main} 中`)
      );
    } else {
      const written = (source.compute ?? []).some(
        (operator) => isFoldingOperator(operator) && operator.rowKind.field === rowKindField
      );
      if (!written) {
        errors.push(
          schemaError(
            path,
            `行类别字段 ${rowKindField} 没有任何折叠算子写入；小计与合计由计算阶段产出，表格只识别不计算`
          )
        );
      }
    }
  }

  if (mergeBy !== undefined) {
    const path = `${componentPath}/props/mergeBy`;
    const merged = buildTableLeafFields(component.props.columns);
    if (!merged.includes(mergeBy)) {
      errors.push(schemaError(path, `mergeBy 必须是表格已声明的列字段:${mergeBy}`));
    }
  }
  return errors;
}

function buildTableLeafFields(columns: TableColumnNode[]): string[] {
  return columns.flatMap((column) =>
    column.kind === 'group'
      ? buildTableLeafFields(column.children)
      : [fieldNameOf(column.field)]
  );
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

  walkPageComponents(page, (component, componentPath) => {
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
  expectedRole?: FieldDefinition['role'],
  allowedDetailType?: FieldDefinition['type']
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
    check(column.field, `${path}/field`, undefined, 'semanticHtml');
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

/**
 * 分类明细的「同色同序」在协议侧的判定(ADR-0053)。
 *
 * 页面文档只声明两处的类别字段,颜色不进页面文档;色点因此按**类别取值**
 * 在页面共享的类别配色中查得,不按行序或扇区序号查得。开启色点却没有一个
 * 绑同一个类别字段的饼图,「同色」就没有对照物——两边各自按调色板顺序取色
 * 只是「看起来对上了」,数据换一次行序就静默错位。
 */
function categorySwatchErrors(
  page: Page,
  component: Extract<Component, { type: 'categoryBreakdown' }>,
  componentPath: string
): TypedError[] {
  if (component.props.swatches !== true) return [];
  const own = categoryDomainKey(page, component, component.props.categoryField);
  // 绑定本身有错时不再叠加这条,错误已由字段绑定判定给出。
  if (own === undefined) return [];

  let shared = false;
  walkPageComponents(page, (candidate) => {
    if (candidate.type !== 'pieChart') return;
    if (categoryDomainKey(page, candidate, candidate.props.categoryField) === own) {
      shared = true;
    }
  });
  if (shared) return [];
  return [
    schemaError(
      `${componentPath}/props/swatches`,
      `色点按类别取值取色，要求同页有饼图绑定同一个类别字段:${own} 没有配对的饼图；` +
        '不需要与扇区同色时去掉 swatches'
    )
  ];
}

/** 类别域的同一性:同一个页面数据源上的同一个字段才算同一批类别取值。 */
function categoryDomainKey(
  page: Page,
  component: Component,
  binding: FieldBinding
): string | undefined {
  const resolved = resolveBinding(page, component, binding);
  if ('error' in resolved) return undefined;
  const slot = typeof binding === 'string' ? 'main' : binding.data;
  const sourceId = (component.data as ComponentData | undefined)?.[slot];
  return sourceId === undefined ? undefined : `${sourceId}.${resolved.fieldName}`;
}

/**
 * 分档图例是着色契约:每档只声明取值下界,上界由下一档隐含,最后一档开口
 * 向上。下界必须严格递增,否则「某个取值属于哪一档」没有唯一答案。
 */
function mapLegendErrors(
  component: Extract<Component, { type: 'mapChart' }>,
  componentPath: string
): TypedError[] {
  const bands = component.props.legend?.bands;
  if (!bands) return [];
  const errors: TypedError[] = [];
  bands.forEach((band, index) => {
    const previous = bands[index - 1];
    if (previous !== undefined && band.from <= previous.from) {
      errors.push(
        schemaError(
          `${componentPath}/props/legend/bands/${index}/from`,
          `图例档位下界必须严格递增:第 ${index + 1} 档 ${band.from} 不大于第 ${index} 档 ${previous.from}`
        )
      );
    }
  });
  return errors;
}

function mapHierarchyErrors(
  page: Page,
  component: Extract<Component, { type: 'mapChart' }>,
  componentPath: string,
  check: BindingCheck
): TypedError[] {
  const errors: TypedError[] = [];
  const filterId = component.props.hierarchyFilter;
  if (filterId === undefined) {
    if (component.props.levelField) {
      errors.push(
        schemaError(`${componentPath}/props/levelField`, 'levelField 只能与 hierarchyFilter 一起使用')
      );
    }
    if (component.props.parentField) {
      errors.push(
        schemaError(
          `${componentPath}/props/parentField`,
          'parentField 只能与 hierarchyFilter 一起使用'
        )
      );
    }
    if (component.props.levelMaps) {
      errors.push(
        schemaError(`${componentPath}/props/levelMaps`, 'levelMaps 只能与 hierarchyFilter 一起使用')
      );
    }
    return errors;
  }
  const target = (page.filters ?? []).find((filter) => filter.id === filterId);
  if (!target) {
    errors.push(
      schemaError(
        `${componentPath}/props/hierarchyFilter`,
        `地图下钻引用了未声明的筛选器:${filterId}`
      )
    );
    return errors;
  }
  if (target.type !== 'dimension' || !target.hierarchy || target.hierarchy.length === 0) {
    errors.push(
      schemaError(
        `${componentPath}/props/hierarchyFilter`,
        `地图下钻目标必须是声明了 hierarchy 的维度筛选器:${filterId}`
      )
    );
  }
  if (component.props.levelField) {
    check(component.props.levelField, `${componentPath}/props/levelField`, 'dimension');
  }
  if (component.props.parentField) {
    check(component.props.parentField, `${componentPath}/props/parentField`, 'dimension');
  }
  if (component.props.codeField) {
    check(component.props.codeField, `${componentPath}/props/codeField`, 'dimension');
  }
  if (target.type === 'dimension' && target.hierarchy && component.props.levelMaps) {
    const levelIds = new Set(target.hierarchy.map((level) => level.id));
    for (const levelId of Object.keys(component.props.levelMaps)) {
      if (!levelIds.has(levelId)) {
        errors.push(
          schemaError(
            `${componentPath}/props/levelMaps/${escapePointer(levelId)}`,
            `levelMaps 引用了筛选器 ${filterId} 未声明的层级:${levelId}`
          )
        );
      }
    }
  }
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
    const hasNonNavigate = actions.some((action) => !('navigate' in action));
    if (hasNonNavigate) {
      errors.push(
        schemaError(
          `${componentPath}/props/actions`,
          'writeFilter 只允许绑定 query 数据源的组件；navigate 可以挂在 inline 组件上'
        )
      );
    }
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
    for (const [paramId, binding] of Object.entries(action.navigate.setParams ?? {})) {
      check(binding, `${path}/navigate/setParams/${escapePointer(paramId)}`);
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
  const fieldName = fieldNameOf(binding);
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
